# Data Flow Overview

This document explains how the migration system works, where data is stored, and how it flows from SendGrid to Twenty CRM.

## Overview

The migration system follows this high-level flow:

```
SendGrid → Export Job → Download CSV → Parse & Normalize → Twenty CRM
```

## Step-by-Step Flow

### 1. **SendGrid Export** (Lines 208-225 in index.mjs)

- A job is created via SendGrid's Marketing API
- The job exports contacts from specified lists/segments
- **Data is NOT stored in the system yet** - SendGrid prepares the export in the cloud

**What happens:**
```javascript
const jobId = await sgCreateExportJob({ list_ids, segment_ids });
```

**Where the job is stored:** In SendGrid's cloud infrastructure

### 2. **Polling for Completion** (Lines 227-267 in index.mjs)

- The system polls SendGrid every 4 seconds to check if the export is ready
- When status becomes `ready` or `completed`, download URLs are provided
- **CSV files are still in SendGrid's cloud storage** at this point

**What happens:**
```javascript
const urls = await sgPollExport(jobId);
// urls = ['https://cdn.sendgrid.com/...csv']
```

### 3. **CSV Download** (Lines 269-273 in index.mjs)

- CSV files are downloaded from SendGrid's CDN
- Downloaded as text/string - **NOT saved to disk permanently**
- Files are temporarily in memory during processing

**What happens:**
```javascript
const csvText = await sgDownloadCsv(url);
// csvText contains the full CSV content as a string
```

**Key Point:** The CSV is **never saved to your local disk**. It's processed in memory only.

### 4. **CSV Parsing** (Lines 485-491 in index.mjs)

- CSV text is parsed into JavaScript objects (rows)
- Each row represents one contact from SendGrid
- Column headers are automatically detected

**What happens:**
```javascript
const rows = parse(csvText, { columns: true, skip_empty_lines: true });
// rows = [{ EMAIL: '...', FIRST_NAME: '...', ... }, ...]
```

### 5. **Data Normalization** (Lines 152-206 in index.mjs)

- Rows are cleaned and normalized to match Twenty CRM's expected format
- Email validation, name parsing, field mapping
- Duplicates are removed

**What happens:**
```javascript
const normalized = records
  .map(normalizeRow)  // Clean each row
  .filter(Boolean)    // Remove invalid rows
  .filter((r, idx, arr) => arr.findIndex(x => x.email === r.email) === idx); // Remove duplicates
```

**Example transformation:**
```javascript
// SendGrid format:
{ EMAIL: 'USER@EXAMPLE.COM', FIRST_NAME: 'John', LAST_NAME: 'Doe' }

// Normalized format:
{ email: 'user@example.com', firstName: 'John', lastName: 'Doe', source: 'sendgrid' }
```

### 6. **Upsert to Twenty CRM** (Lines 361-422 in index.mjs)

For each normalized contact:

1. **Search for existing contact** by email
   - Tries REST API search first
   - Falls back to GraphQL search if needed

2. **Create or Update**
   - If not found: Creates a new person/company
   - If found: Updates the existing record

**What happens:**
```javascript
const existing = await twentySearchByEmail(data.email);
if (!existing) {
  await twentyCreatePerson(payload);
} else {
  await twentyUpdatePerson(existing.id, payload);
}
```

### 7. **Logging and Error Handling** (Lines 424-430, 549-560 in index.mjs)

- Success/failure is logged to console and log files
- Failed contacts are tracked and saved to `logs/failed-contacts.csv`
- Progress is saved every 100 contacts

**Log file location:** `logs/migration-YYYY-MM-DD.log`
**Failed contacts file:** `logs/failed-contacts.csv`

## Where Data is Stored

### During Processing
1. **SendGrid Cloud:** Original data (export job, CSV files)
2. **Memory:** CSV text while downloading (temporary)
3. **Memory:** Parsed and normalized data (temporary)

### After Processing
1. **Twenty CRM:** Final migrated contacts (persistent)
2. **Logs Directory:** 
   - `logs/migration-YYYY-MM-DD.log` - Detailed operation log
   - `logs/failed-contacts.csv` - Contacts that failed to migrate
   - `logs/selected-lists.json` - Configuration of last migration
   - `logs/migration-progress.json` - Progress tracking (if interrupted)

**Important:** CSV files are **never saved to disk**. Only logs and failed contacts are saved locally.

## Why No CSV Files on Disk?

The system is designed to:
1. **Save disk space** - CSV files can be very large
2. **Process efficiently** - Stream processing is faster than disk I/O
3. **Maintain privacy** - No local copies of personal data
4. **Simplify cleanup** - No need to manually delete CSV files

## Verification

To verify that contacts reached Twenty CRM:

1. **Check the logs:**
   ```bash
   cat logs/migration-2025-10-26.log | grep "✓ Company created"
   ```

2. **Check failed contacts:**
   ```bash
   cat logs/failed-contacts.csv
   ```

3. **Check Twenty CRM directly:**
   - Log into your Twenty CRM instance
   - Navigate to People or Companies
   - Look for contacts with source "sendgrid"

## Common Questions

### Q: Where are the CSV files I see being prepared in SendGrid?
**A:** They're stored in SendGrid's cloud storage temporarily (usually for 24-48 hours). Our system downloads them directly into memory without saving to disk.

### Q: Why don't I see contacts in Twenty CRM?
**A:** Possible reasons:
- Check `logs/failed-contacts.csv` for errors
- Verify your Twenty CRM API token has write permissions
- Check if field metadata is properly configured in Twenty CRM
- Run the API connection test: `npm run test:api`

### Q: Can I save the CSV files for backup?
**A:** The system is designed to process and forget CSVs for privacy. If you need backups, you can:
1. Export directly from SendGrid UI and save manually
2. Modify the code to save CSV to disk (not recommended for privacy)

### Q: What happens if the migration is interrupted?
**A:** Progress is saved every 100 contacts. You can resume by running with `RESUME=1` environment variable, but the CSV download will restart (SendGrid deletes old CSV files after a few days).

## Running the Connection Test

To verify both APIs are working correctly:

```bash
npm run test:api
```

This will:
1. Test SendGrid API connectivity
2. Create a test export job
3. Verify download capability
4. Test Twenty CRM API connectivity
5. Test contact creation
6. Clean up test data

## Troubleshooting

If migration seems successful but contacts aren't in Twenty CRM:

1. **Run the connection test:**
   ```bash
   npm run test:api
   ```

2. **Check for field metadata errors:**
   - Look for "Field metadata" errors in logs
   - Twenty CRM may require certain fields to be configured in object metadata

3. **Verify API token permissions:**
   - Token must have read AND write permissions
   - Check token scope in Twenty CRM settings

4. **Try creating a single test contact:**
   ```bash
   DRY_RUN=1 npm start
   ```
   This shows what data would be sent without actually creating it.

