# Setup

## Prerequisites
- Node.js ≥ 18
- SendGrid account with Marketing API access
- Twenty CRM instance with API access

## Installation
```bash
# Clone or download the project
cd sendgrid-to-twenty-system

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

## Configuration
Edit `.env` file with your credentials:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_LIST_IDS=12345,67890  # Optional: specific list IDs
SENDGRID_SEGMENT_IDS=segment1,segment2  # Optional: specific segment IDs

# Twenty CRM Configuration
TWENTY_BASE_URL=https://your-twenty-instance.com
TWENTY_API_TOKEN=your_twenty_api_token_here

# Performance Settings (optional)
CONCURRENCY=5  # Number of concurrent API calls
BATCH_SIZE=100  # Batch size for processing
```

## Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Dry Run
```bash
# Test the migration without making changes
npm run dry
```

## Production Run
```bash
# Run the actual migration
npm start
```