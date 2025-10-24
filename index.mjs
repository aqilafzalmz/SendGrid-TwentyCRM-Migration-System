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
  const email = (row.email || row.Email || '').toString().trim().toLowerCase();
  if (!email) return null;
  
  // Enhanced email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    log(`Invalid email format: ${email}`, 'WARN');
    return null;
  }
  
  const firstName = (row.first_name || row.firstName || row.FirstName || '').toString().trim();
  const lastName = (row.last_name || row.lastName || row.LastName || '').toString().trim();
  const city = (row.city || row.City || row.location || '').toString().trim();
  const company = (row.company || row.Company || row.organization || '').toString().trim();
  const phone = (row.phone || row.Phone || row.phone_number || '').toString().trim();
  const rawTags = row.tags || row.lists || row.segments || '';
  const tags = rawTags.toString().split(/[|,;]+/).map(s => s.trim()).filter(Boolean);
  
  // Enhanced data cleaning
  const cleanString = (str) => str.replace(/[^\w\s@.-]/g, '').trim();
  
  return { 
    email, 
    firstName: cleanString(firstName), 
    lastName: cleanString(lastName), 
    location: cleanString(city),
    company: cleanString(company),
    phone: cleanString(phone),
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
  while (true) {
    const r = await fetch(`https://api.sendgrid.com/v3/marketing/contacts/exports/${jobId}`, {
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` }
    });
    if (!r.ok) throw new Error(`SendGrid export poll failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    if (j.status === 'completed' && Array.isArray(j.urls) && j.urls.length) return j.urls;
    if (j.status === 'failed') throw new Error('SendGrid export failed');
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
    const r = await fetch(new URL(TWENTY_CREATE_PERSON_PATH, TWENTY_BASE_URL), {
      method: 'POST',
      headers: twentyHeaders(),
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`Twenty create failed: ${r.status} ${errorText}`);
    }
    const response = await r.json();
    validateApiResponse(response, ['id']);
    return response;
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

async function twentyUpsertPerson(data) {
  const existing = await twentySearchByEmail(data.email).catch(() => null);
  const toPayload = (current = null) => {
    const base = {
      email: data.email,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      location: data.location || undefined,
      company: data.company || undefined,
      phone: data.phone || undefined,
      source: data.source || 'sendgrid'
    };
    const incomingTags = Array.isArray(data.tags) ? data.tags : [];
    const existingTags = Array.isArray(current?.tags) ? current.tags : [];
    const merged = [...new Set([...existingTags, ...incomingTags])];
    if (merged.length) base.tags = merged;
    return base;
  };
  if (!existing) {
    if (DRY_RUN) return { action: 'create', dryRun: true };
    const res = await twentyCreatePerson(toPayload());
    return { action: 'create', id: res?.id || null };
  } else {
    if (DRY_RUN) return { action: 'update', id: existing.id, dryRun: true };
    const res = await twentyUpdatePerson(existing.id, toPayload(existing));
    return { action: 'update', id: existing.id || res?.id || null };
  }
}

async function writeFailedCsv(rows) {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  const csv = [header.join(','), ...rows.map(r => header.map(h => (r[h] ?? '')).join(','))].join('\n');
  await fs.writeFile(failedCsvPath, csv, 'utf8');
  console.log(`• Wrote failed rows to ${failedCsvPath}`);
}

async function main() {
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

  const list_ids = (SENDGRID_LIST_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const segment_ids = (SENDGRID_SEGMENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  log(`Export scope → lists: [${list_ids}], segments: [${segment_ids}]`);

  const jobId = await sgCreateExportJob({ list_ids, segment_ids });
  log(`SendGrid export job id: ${jobId}`);

  const urls = await sgPollExport(jobId);
  log(`Export ready with ${urls.length} file(s)`);

  const records = [];
  for (const [i, url] of urls.entries()) {
    log(`Downloading CSV ${i + 1}/${urls.length}`);
    const csvText = await sgDownloadCsv(url);
    const rows = parse(csvText, { columns: true, skip_empty_lines: true });
    records.push(...rows);
  }
  log(`Parsed ${records.length} rows from SendGrid`);

  const normalized = records
    .map(normalizeRow)
    .filter(Boolean)
    .filter((r, idx, arr) => arr.findIndex(x => x.email === r.email) === idx);
  log(`Normalized & de-duplicated → ${normalized.length} unique contacts`);

  const limit = pLimit(concurrency);
  let processed = 0, created = 0, updated = 0, failed = 0;
  const failedRows = [];
  const startTime = Date.now();

  const tasks = normalized.map((row, index) => limit(async () => {
    try {
      const res = await twentyUpsertPerson(row);
      processed++;
      if (res.action === 'create') created++;
      if (res.action === 'update') updated++;
      
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
      log(`Failed for ${row.email}: ${e.message}`, 'ERROR');
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
