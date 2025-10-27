import 'dotenv/config';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import pLimit from 'p-limit';
import fs from 'node:fs/promises';
import path from 'node:path';

const {
  SENDGRID_API_KEY,
  SENDGRID_LIST_IDS = '',
  SENDGRID_SEGMENT_IDS = '',
  TWENTY_BASE_URL,
  TWENTY_API_TOKEN,
  TWENTY_CREATE_PERSON_PATH = '/rest/people',
  TWENTY_UPDATE_PERSON_PATH = '/rest/people',
  TWENTY_SEARCH_PERSON_PATH = '/rest/people/search',
  TWENTY_CREATE_COMPANY_PATH = '/rest/companies',
  TWENTY_UPDATE_COMPANY_PATH = '/rest/companies',
  TWENTY_SEARCH_COMPANY_PATH = '/rest/companies/search',
  CONCURRENCY = '5',
  BATCH_SIZE = '100',
  DRY_RUN
} = process.env;

// Enhanced validation
function validateConfig() {
  const required = {
    SENDGRID_API_KEY: 'SendGrid API key is required',
    TWENTY_BASE_URL: 'Twenty CRM base URL is required',
    TWENTY_API_TOKEN: 'Twenty CRM API token is required'
  };
  
  for (const [key, message] of Object.entries(required)) {
    if (!process.env[key]) {
      throw new Error(`Configuration Error: ${message}`);
    }
  }
  
  // Validate URL format
  try {
    new URL(TWENTY_BASE_URL);
  } catch {
    throw new Error('Configuration Error: TWENTY_BASE_URL must be a valid URL');
  }
  
  // Validate numeric values
  const concurrency = Number(CONCURRENCY);
  if (isNaN(concurrency) || concurrency < 1 || concurrency > 50) {
    throw new Error('Configuration Error: CONCURRENCY must be between 1 and 50');
  }
  
  const batchSize = Number(BATCH_SIZE);
  if (isNaN(batchSize) || batchSize < 10 || batchSize > 1000) {
    throw new Error('Configuration Error: BATCH_SIZE must be between 10 and 1000');
  }
  
  console.log('✓ Configuration validated');
}

// API response validation
function validateApiResponse(response, expectedFields = []) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid API response: not an object');
  }
  
  for (const field of expectedFields) {
    if (!(field in response)) {
      log(`Warning: Missing expected field '${field}' in API response`, 'WARN');
    }
  }
  
  return response;
}

validateConfig();

const concurrency = Math.max(1, Number(CONCURRENCY));
const batchSize = Math.max(10, Number(BATCH_SIZE));
const logsDir = path.resolve('logs');
await fs.mkdir(logsDir, { recursive: true });
const failedCsvPath = path.join(logsDir, 'failed-contacts.csv');
const logPath = path.join(logsDir, `migration-${new Date().toISOString().split('T')[0]}.log`);
const progressPath = path.join(logsDir, 'migration-progress.json');

// Enhanced logging
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  // Write to log file asynchronously
  fs.appendFile(logPath, logMessage + '\n', 'utf8').catch(() => {});
}

// Progress tracking and resume capability
async function saveProgress(progress) {
  try {
    await fs.writeFile(progressPath, JSON.stringify(progress, null, 2), 'utf8');
  } catch (error) {
    log(`Failed to save progress: ${error.message}`, 'WARN');
  }
}

async function loadProgress() {
  try {
    const data = await fs.readFile(progressPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function clearProgress() {
  try {
    await fs.unlink(progressPath);
  } catch (error) {
    // File doesn't exist, that's fine
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Enhanced error handling with retry logic
async function withRetry(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable = error.message.includes('timeout') || 
                         error.message.includes('ECONNRESET') ||
                         error.message.includes('ENOTFOUND') ||
                         error.status >= 500;
      
      if (isLastAttempt || !isRetryable) {
        throw error;
      }
      
      console.warn(`  ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
      await wait(delay * attempt);
    }
  }
}

function twentyHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TWENTY_API_TOKEN}`
  };
}

function normalizeRow(row) {
  // Check for email in all common case variations (SendGrid uses UPPERCASE)
  const email = (row.EMAIL || row.email || row.Email || row['E-mail'] || '').toString().trim().toLowerCase();
  if (!email || email === '') {
    return null; // Skip rows without email
  }
  
  // Enhanced email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    log(`Invalid email format: ${email}`, 'WARN');
    return null;
  }
  
  // Extract names - use userName as primary, fallback to FIRST_NAME/LAST_NAME
  let firstName = '';
  let lastName = '';
  const userName = (row.userName || '').toString().trim();
  
  if (userName) {
    // Split userName into first/last if it contains a space
    const nameParts = userName.split(' ');
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  } else {
    // Fallback to separate fields
    firstName = (row.FIRST_NAME || row.first_name || row.firstName || row.FirstName || row['First Name'] || '').toString().trim();
    lastName = (row.LAST_NAME || row.last_name || row.lastName || row.LastName || row['Last Name'] || '').toString().trim();
  }
  
  const city = (row.CITY || row.city || row.City || row.location || row.Location || '').toString().trim();
  const company = (row.Organisation || row.organisation || row.organization || row.Organization || row.company || row.Company || '').toString().trim();
  const phone = (row.PHONE_NUMBER || row.phone_number || row.phone || row.Phone || row['Phone Number'] || '').toString().trim();
  const linkedin = (row.LinkedIn || row.linkedin || row.linked_in || '').toString().trim();
  const rawTags = row.tags || row.lists || row.segments || row.Source || '';
  const tags = rawTags ? rawTags.toString().split(/[|,;]+/).map(s => s.trim()).filter(Boolean) : [];
  
  // Enhanced data cleaning
  const cleanString = (str) => {
    if (!str) return '';
    return str.replace(/[^\w\s@.-]/g, '').trim();
  };
  
  return { 
    email, 
    firstName: cleanString(firstName), 
    lastName: cleanString(lastName), 
    location: cleanString(city),
    company: cleanString(company),
    phone: cleanString(phone),
    linkedin: cleanString(linkedin),
    tags, 
    source: 'sendgrid' 
  };
}

async function sgCreateExportJob({ list_ids = [], segment_ids = [] } = {}) {
  return await withRetry(async () => {
    const body = { list_ids, segment_ids, notifications: { email: false } };
    const r = await fetch('https://api.sendgrid.com/v3/marketing/contacts/exports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`SendGrid export create failed: ${r.status} ${errorText}`);
    }
    const j = await r.json();
    validateApiResponse(j, ['id']);
    if (!j.id) throw new Error('SendGrid export: missing job id');
    return j.id;
  });
}

async function sgPollExport(jobId, { intervalMs = 4000 } = {}) {
  let pollCount = 0;
  const maxPolls = 120; // 8 minutes max wait time
  
  while (true) {
    pollCount++;
    const r = await fetch(`https://api.sendgrid.com/v3/marketing/contacts/exports/${jobId}`, {
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` }
    });
    if (!r.ok) throw new Error(`SendGrid export poll failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    
    // Log status every 3 polls (every 12 seconds)
    if (pollCount % 3 === 0) {
      log(`Polling SendGrid export (${j.status})... (attempt ${pollCount})`);
    }
    
    // SendGrid uses 'ready' status when export is complete
    if (j.status === 'ready' || j.status === 'completed') {
      if (Array.isArray(j.urls) && j.urls.length) {
        log(`Export ready after ${pollCount} polls with ${j.urls.length} file(s)`);
        return j.urls;
      } else {
        log(`Export status is ${j.status} but no URLs found`, 'ERROR');
      }
    }
    
    if (j.status === 'failed') {
      log(`Export failed: ${JSON.stringify(j)}`, 'ERROR');
      throw new Error('SendGrid export failed');
    }
    
    // Safety timeout
    if (pollCount >= maxPolls) {
      log(`Export polling timeout after ${pollCount} attempts (status: ${j.status})`, 'ERROR');
      throw new Error(`SendGrid export polling timeout. Last status: ${j.status}`);
    }
    
    await wait(intervalMs);
  }
}

async function sgDownloadCsv(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`CSV download failed: ${r.status} ${await r.text()}`);
  return r.text();
}

async function twentyRestSearchByEmail(email) {
  const u = new URL(TWENTY_SEARCH_PERSON_PATH, TWENTY_BASE_URL);
  u.searchParams.set('query', email);
  let r = await fetch(u.toString(), { headers: twentyHeaders() });
  if (r.status === 405 || r.status === 404) {
    r = await fetch(new URL(TWENTY_SEARCH_PERSON_PATH, TWENTY_BASE_URL), {
      method: 'POST',
      headers: twentyHeaders(),
      body: JSON.stringify({ query: email })
    });
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Twenty REST search failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  if (Array.isArray(j)) return j.find((p) => (p.email || '').toLowerCase() === email) || null;
  if (Array.isArray(j.items)) return j.items.find((p) => (p.email || '').toLowerCase() === email) || null;
  return null;
}

async function twentyGraphQLFindByEmail(email) {
  const url = new URL('/graphql/', TWENTY_BASE_URL).toString();
  const query = `
    query FindPerson($email: String!) {
      people(filter: { email: { eq: $email } }, first: 1) {
        edges { node { id email firstName lastName tags } }
      }
    }
  `;
  const r = await fetch(url, {
    method: 'POST',
    headers: twentyHeaders(),
    body: JSON.stringify({ query, variables: { email } })
  });
  if (!r.ok) throw new Error(`Twenty GraphQL search failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const node = j?.data?.people?.edges?.[0]?.node || null;
  return node;
}

async function twentySearchByEmail(email) {
  try {
    const restFound = await twentyRestSearchByEmail(email);
    if (restFound) return restFound;
  } catch {}
  try {
    return await twentyGraphQLFindByEmail(email);
  } catch {
    return null;
  }
}

async function twentyCreatePerson(payload) {
  return await withRetry(async () => {
    console.log(`\n🔍 Creating person with payload:`, JSON.stringify(payload, null, 2));
    const r = await fetch(new URL(TWENTY_CREATE_PERSON_PATH, TWENTY_BASE_URL), {
      method: 'POST',
      headers: twentyHeaders(),
      body: JSON.stringify(payload)
    });
    const responseText = await r.text();
    console.log(`\n🔍 Response status:`, r.status);
    console.log(`\n🔍 Response body:`, responseText);
    
    if (!r.ok) {
      console.log(`\n❌ Failed to create person: ${r.status} - ${responseText}`);
      throw new Error(`Twenty create failed: ${r.status} ${responseText}`);
    }
    
    const response = JSON.parse(responseText);
    console.log(`\n✅ Person created! Response:`, JSON.stringify(response, null, 2));
    
    // Extract ID from nested structure
    const extractedId = response?.data?.createPerson?.id || response?.id;
    console.log(`\n🔍 Extracted ID:`, extractedId);
    
    if (!extractedId) {
      console.log(`\n⚠️ WARNING: No ID found in response`);
    }
    
    return { id: extractedId, response };
  });
}

async function twentyUpdatePerson(id, payload) {
  return await withRetry(async () => {
    const path = `${TWENTY_UPDATE_PERSON_PATH}/${encodeURIComponent(id)}`;
    const r = await fetch(new URL(path, TWENTY_BASE_URL), {
      method: 'PATCH',
      headers: twentyHeaders(),
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`Twenty update failed: ${r.status} ${errorText}`);
    }
    return r.json();
  });
}

async function twentyCreateCompany(payload) {
  return await withRetry(async () => {
    const r = await fetch(new URL(TWENTY_CREATE_COMPANY_PATH, TWENTY_BASE_URL), {
      method: 'POST',
      headers: twentyHeaders(),
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`Twenty create company failed: ${r.status} ${errorText}`);
    }
    const response = await r.json();
    validateApiResponse(response, ['id']);
    return response;
  });
}

async function twentyUpdateCompany(id, payload) {
  return await withRetry(async () => {
    const path = `${TWENTY_UPDATE_COMPANY_PATH}/${encodeURIComponent(id)}`;
    const r = await fetch(new URL(path, TWENTY_BASE_URL), {
      method: 'PATCH',
      headers: twentyHeaders(),
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`Twenty update company failed: ${r.status} ${errorText}`);
    }
    return r.json();
  });
}

async function twentyUpsertPerson(data) {
  const isCompany = global.destinationType === 'company';
  const existing = await twentySearchByEmail(data.email).catch(() => null);
  
  // Get list name(s) for this contact (for traceability)
  const listNames = global.listNames || ['SendGrid'];
  const sourceTag = `From: ${listNames.join(', ')}`;
  
  const toPayload = (current = null) => {
    // Minimal payload - send fields that Twenty CRM expects
    const payload = {};
    
    if (isCompany) {
      // For companies, use name field as a string (company name)
      const companyName = data.company || data.email || 'Company';
      payload.name = companyName;
      
      // That's it - keep company payload minimal to avoid metadata errors
    } else {
      // For people, use name as an object with firstName and lastName
      payload.name = {
        firstName: data.firstName || '',
        lastName: data.lastName || ''
      };
      
      // If no first/last name, use email as a fallback
      if (!data.firstName && !data.lastName) {
        // Use the name part of the email as firstName
        const emailName = data.email.split('@')[0] || 'Contact';
        payload.name = {
          firstName: emailName,
          lastName: ''
        };
      }
      
      // Twenty CRM expects emails as an array of objects
      payload.emails = {
        primaryEmail: data.email || '',
        additionalEmails: null
      };
      
      // Link to company if in comprehensive mode
      if (global.companyId) {
        payload.companyId = global.companyId;
      }
      
      // Log the payload being sent
      log(`DEBUG: Creating person with data: ${JSON.stringify(payload)}`, 'INFO');
      
      // Add phone if available
      if (data.phone) {
        payload.phones = {
          primaryPhoneNumber: data.phone,
          primaryPhoneCallingCode: '',
          primaryPhoneCountryCode: '',
          additionalPhones: null
        };
      }
      
      // Add city/location if available
      if (data.location) {
        payload.city = data.location;
      }
      
      // Add LinkedIn if available
      if (data.linkedin) {
        payload.linkedinLink = {
          primaryLinkLabel: 'LinkedIn',
          primaryLinkUrl: data.linkedin,
          secondaryLinks: null
        };
      }
    }
    
    return payload;
  };
  
  if (DRY_RUN) {
    return { action: 'create', dryRun: true, type: isCompany ? 'company' : 'person' };
  }
  
  if (isCompany) {
    // For companies, use the companies endpoint
    if (!existing) {
      const payload = toPayload();
      log(`Creating company record for: ${data.email}`);
      const res = await twentyCreateCompany(payload);
      return { action: 'create', id: res?.id || null };
    } else {
      const res = await twentyUpdateCompany(existing.id, toPayload(existing));
      return { action: 'update', id: existing.id || res?.id || null };
    }
  } else {
    // For people
    if (!existing) {
      const payload = toPayload();
      log(`Creating person with payload: ${JSON.stringify(payload)}`, 'INFO');
      const res = await twentyCreatePerson(payload);
      log(`Person creation response: ${JSON.stringify(res)}`, 'INFO');
      
      // Extract ID from the response structure
      const extractedId = res?.id || res?.response?.data?.createPerson?.id || res?.response?.id;
      
      return { action: 'create', id: extractedId || null };
    } else {
      const payload = toPayload(existing);
      const res = await twentyUpdatePerson(existing.id, payload);
      return { action: 'update', id: existing.id || res?.id || null };
    }
  }
}

async function writeFailedCsv(rows) {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const csv = [header.join(','), ...rows.map(r => header.map(h => (r[h] ?? '')).join(','))].join('\n');
  await fs.writeFile(failedCsvPath, csv, 'utf8');
  console.log(`• Wrote failed rows to ${failedCsvPath}`);
}

async function loadSelectedListsFromFile() {
  try {
    const selectedListsPath = path.join(logsDir, 'selected-lists.json');
    const data = await fs.readFile(selectedListsPath, 'utf8');
    const parsed = JSON.parse(data);
    return {
      listIds: parsed.listIds || [],
      listNames: parsed.listNames || [],
      destinationType: parsed.destinationType || 'people'
    };
  } catch (error) {
    return { listIds: [], listNames: [], destinationType: 'people' };
  }
}

async function main() {
  try {
    log('Starting SendGrid → Twenty CRM migration');
    
    // Check for existing progress
    const existingProgress = await loadProgress();
    if (existingProgress) {
      log(`Found existing progress: ${existingProgress.processed}/${existingProgress.total} processed`);
      const resume = process.env.RESUME === '1';
      if (resume) {
        log('Resuming from previous progress...');
        // Resume logic would go here
      } else {
        log('Starting fresh migration (use RESUME=1 to resume)');
        await clearProgress();
      }
    }

    // Try to load selected lists from file, fallback to environment variable
    const selectedConfig = await loadSelectedListsFromFile();
    let list_ids = selectedConfig.listIds.length > 0 ? selectedConfig.listIds : (SENDGRID_LIST_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    let list_names = selectedConfig.listNames.length > 0 ? selectedConfig.listNames : (process.env.SENDGRID_LIST_NAMES || '').split(',').filter(Boolean);
    const segment_ids = (SENDGRID_SEGMENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    
    // NEW MODE: When destination is 'company', we will:
    // 1. Create ONE company from the list name
    // 2. Create all contacts as PEOPLE linked to that company
    const useComprehensiveMode = selectedConfig.destinationType === 'company';
    const destinationType = useComprehensiveMode ? 'people' : (selectedConfig.destinationType || process.env.DESTINATION_TYPE || 'people');
    
    log(`Export scope → lists: [${list_ids.join(', ')}], segments: [${segment_ids.join(', ')}]`);
    log(`Migration mode: ${useComprehensiveMode ? 'COMPREHENSIVE (Company + People)' : destinationType}`);
    
    // Store destination type and list information globally
    global.destinationType = destinationType;
    global.listNames = list_names.length > 0 ? list_names : ['Unknown List'];
    global.useComprehensiveMode = useComprehensiveMode;

    const jobId = await sgCreateExportJob({ list_ids, segment_ids });
    log(`SendGrid export job id: ${jobId}`);

    const urls = await sgPollExport(jobId);
    log(`Export ready with ${urls.length} file(s)`);

    const records = [];
    for (const [i, url] of urls.entries()) {
      log(`Downloading CSV ${i + 1}/${urls.length}`);
      const csvText = await sgDownloadCsv(url);
      const rows = parse(csvText, { columns: true, skip_empty_lines: true });
      log(`CSV has ${rows.length} rows. First row keys: ${Object.keys(rows[0] || {}).join(', ')}`);
      records.push(...rows);
    }
    log(`Parsed ${records.length} rows from SendGrid`);

    const normalized = records
      .map(normalizeRow)
      .filter(Boolean)
      .filter((r, idx, arr) => arr.findIndex(x => x.email === r.email) === idx);
    log(`Normalized & de-duplicated → ${normalized.length} unique contacts`);
    
    if (normalized.length === 0 && records.length > 0) {
      log(`No valid contacts found. Sample CSV row: ${JSON.stringify(records[0])}`, 'WARN');
    }
    
    log(`Will migrate to: ${destinationType}`);

    // STEP 1: If comprehensive mode, create the company first
    let companyId = null;
    if (global.useComprehensiveMode && list_names.length > 0) {
      const companyName = list_names[0]; // Use first list name as company name
      log(`Creating company: ${companyName}`);
      
      try {
        const companyPayload = { name: companyName };
        const companyResponse = await twentyCreateCompany(companyPayload);
        companyId = companyResponse?.id || companyResponse?.data?.createCompany?.id;
        if (companyId) {
          log(`✓ Company created with ID: ${companyId}`);
          global.companyId = companyId;
        } else {
          log(`⚠ Company created but no ID returned`, 'WARN');
        }
      } catch (error) {
        log(`Failed to create company: ${error.message}`, 'ERROR');
        // Continue with people migration even if company creation fails
      }
    }

    const limit = pLimit(concurrency);
    let processed = 0, created = 0, updated = 0, failed = 0;
    const failedRows = [];
    const startTime = Date.now();

    const tasks = normalized.map((row, index) => limit(async () => {
      try {
        const res = await twentyUpsertPerson(row);
        processed++;
        if (res.action === 'create') {
          created++;
          // Log first 10 creations for verification
          if (created <= 10) {
            log(`✓ ${destinationType === 'company' ? 'Company' : 'Person'} created: ${row.email}`);
            log(`✓ Person ID: ${res.id || 'no ID returned'}`, 'INFO');
          }
        }
        if (res.action === 'update') {
          updated++;
          // Log first 10 updates for verification
          if (updated <= 10) {
            log(`↻ Updated: ${row.email}`);
          }
        }
        
        // Save progress every 100 contacts
        if (processed % 100 === 0) {
          await saveProgress({
            processed,
            total: normalized.length,
            created,
            updated,
            failed,
            startTime,
            lastUpdate: new Date().toISOString()
          });
        }
        
        if (processed % 50 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = processed / elapsed;
          const eta = (normalized.length - processed) / rate;
          log(`Progress: ${processed}/${normalized.length} (${Math.round(rate)}/s, ETA: ${Math.round(eta)}s)`);
        }
      } catch (e) {
        failed++;
        failedRows.push({ email: row.email, error: (e?.message || 'unknown') });
        
        // Log but don't stop migration on metadata errors
        const isMetadataError = e.message.includes('Field metadata') || e.message.includes('missing in object metadata');
        if (isMetadataError) {
          log(`⚠ Skipped ${row.email} (field metadata not configured)`, 'WARN');
        } else {
          log(`✗ Failed for ${row.email}: ${e.message}`, 'ERROR');
        }
      }
    }));

    await Promise.all(tasks);
    await writeFailedCsv(failedRows);
    await clearProgress(); // Clear progress file on completion

    const totalTime = (Date.now() - startTime) / 1000;
    log('Migration completed');
    log(`Total processed: ${processed}`);
    log(`Created: ${created}`);
    log(`Updated: ${updated}`);
    log(`Failures: ${failed}`);
    log(`Total time: ${Math.round(totalTime)}s`);
    log(`Average rate: ${Math.round(processed / totalTime)} contacts/second`);
    
    process.exit(0);
  } catch (error) {
    log(`Migration failed: ${error.message}`, 'ERROR');
    console.error('Migration error details:', error);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
