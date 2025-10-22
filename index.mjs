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

if (!SENDGRID_API_KEY) throw new Error('Missing SENDGRID_API_KEY');
if (!TWENTY_BASE_URL) throw new Error('Missing TWENTY_BASE_URL');
if (!TWENTY_API_TOKEN) throw new Error('Missing TWENTY_API_TOKEN');

const concurrency = Math.max(1, Number(CONCURRENCY));
const batchSize = Math.max(10, Number(BATCH_SIZE));
const logsDir = path.resolve('logs');
await fs.mkdir(logsDir, { recursive: true });
const failedCsvPath = path.join(logsDir, 'failed-contacts.csv');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function twentyHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TWENTY_API_TOKEN}`
  };
}

function normalizeRow(row) {
  const email = (row.email || row.Email || '').toString().trim().toLowerCase();
  if (!email) return null;
  const firstName = row.first_name || row.firstName || row.FirstName || '';
  const lastName = row.last_name || row.lastName || row.LastName || '';
  const city = row.city || row.City || row.location || '';
  const rawTags = row.tags || row.lists || row.segments || '';
  const tags = rawTags.toString().split(/[|,;]+/).map(s => s.trim()).filter(Boolean);
  return { email, firstName, lastName, location: city, tags, source: 'sendgrid' };
}

async function sgCreateExportJob({ list_ids = [], segment_ids = [] } = {}) {
  const body = { list_ids, segment_ids, notifications: { email: false } };
  const r = await fetch('https://api.sendgrid.com/v3/marketing/contacts/exports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`SendGrid export create failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  if (!j.id) throw new Error('SendGrid export: missing job id');
  return j.id;
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
  const r = await fetch(new URL(TWENTY_CREATE_PERSON_PATH, TWENTY_BASE_URL), {
    method: 'POST',
    headers: twentyHeaders(),
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Twenty create failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function twentyUpdatePerson(id, payload) {
  const path = `${TWENTY_UPDATE_PERSON_PATH}/${encodeURIComponent(id)}`;
  const r = await fetch(new URL(path, TWENTY_BASE_URL), {
    method: 'PATCH',
    headers: twentyHeaders(),
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Twenty update failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function twentyUpsertPerson(data) {
  const existing = await twentySearchByEmail(data.email).catch(() => null);
  const toPayload = (current = null) => {
    const base = {
      email: data.email,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      location: data.location || undefined,
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
  console.log('→ Starting SendGrid → Twenty CRM migration');
  const list_ids = (SENDGRID_LIST_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const segment_ids = (SENDGRID_SEGMENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  console.log(`• Export scope → lists: [${list_ids}], segments: [${segment_ids}]`);

  const jobId = await sgCreateExportJob({ list_ids, segment_ids });
  console.log(`• SendGrid export job id: ${jobId}`);

  const urls = await sgPollExport(jobId);
  console.log(`• Export ready with ${urls.length} file(s)`);

  const records = [];
  for (const [i, url] of urls.entries()) {
    console.log(`  - downloading CSV ${i + 1}/${urls.length}`);
    const csvText = await sgDownloadCsv(url);
    const rows = parse(csvText, { columns: true, skip_empty_lines: true });
    records.push(...rows);
  }
  console.log(`• Parsed ${records.length} rows from SendGrid`);

  const normalized = records
    .map(normalizeRow)
    .filter(Boolean)
    .filter((r, idx, arr) => arr.findIndex(x => x.email === r.email) === idx);
  console.log(`• Normalized & de-duplicated → ${normalized.length} unique contacts`);

  const limit = pLimit(concurrency);
  let processed = 0, created = 0, updated = 0, failed = 0;
  const failedRows = [];

  const tasks = normalized.map(row => limit(async () => {
    try {
      const res = await twentyUpsertPerson(row);
      processed++;
      if (res.action === 'create') created++;
      if (res.action === 'update') updated++;
      if (processed % 50 === 0) console.log(`  … ${processed}/${normalized.length} processed`);
    } catch (e) {
      failed++;
      failedRows.push({ email: row.email, error: (e?.message || 'unknown') });
      console.error(`  ! Failed for ${row.email}: ${e.message}`);
    }
  }));

  await Promise.all(tasks);
  await writeFailedCsv(failedRows);

  console.log('— Migration done —');
  console.log(`Total processed: ${processed}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Failures: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
