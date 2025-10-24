# 🚀 SendGrid → Twenty CRM Migration Tool

A comprehensive, production-ready migration tool for transferring SendGrid Marketing Contacts to Twenty CRM with real-time monitoring, error handling, and data validation.

## ✨ Features

- **🔄 Automatic Migration**: Exports SendGrid contacts and upserts them into Twenty CRM
- **📊 Real-time Monitoring**: Beautiful web-based dashboard with live progress tracking
- **🛡️ Error Handling**: Retry logic, rate limiting, and comprehensive error recovery
- **📈 Progress Tracking**: Real-time progress monitoring with resume capability
- **🔍 Data Validation**: Email validation, data cleaning, and field mapping
- **📝 Comprehensive Logging**: Structured logs with detailed error tracking
- **🧪 Testing Suite**: Full test coverage with unit and integration tests
- **⚡ Performance**: Configurable concurrency and batch processing
- **🔄 Resume Capability**: Resume interrupted migrations from where they left off

## 🎯 About This Project

**Biji-Biji Initiatives** presents a robust migration solution for businesses transitioning from SendGrid to Twenty CRM. This tool addresses the critical need for seamless contact data migration while maintaining data integrity and providing real-time visibility into the migration process.

### Why This Tool Exists

- **Data Migration Challenges**: Moving contact data between CRM systems is complex and error-prone
- **Business Continuity**: Ensures no data loss during CRM transitions
- **Real-time Monitoring**: Provides visibility into migration progress and issues
- **Production Ready**: Built with enterprise-grade features for reliability

### Key Benefits

- **Zero Data Loss**: Comprehensive error handling and retry mechanisms
- **Real-time Visibility**: Beautiful dashboard for monitoring migration progress
- **Resume Capability**: Can resume interrupted migrations
- **Data Validation**: Ensures data quality and integrity
- **Performance Optimized**: Handles large datasets efficiently

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Test the migration (dry run)
npm run dry

# Run with monitoring dashboard (recommended)
npm run monitor:start

# Or run migration only
npm start
```

## 📊 Monitoring Dashboard

A real-time web-based dashboard for monitoring your migration progress:

- **Live Progress**: Real-time progress bar and statistics
- **Error Monitoring**: Failed contacts and error details
- **System Info**: Memory usage, uptime, and performance
- **Log Viewer**: Live log entries with timestamps
- **WebSocket Updates**: Automatic real-time updates

### Start with Monitor
```bash
# Start migration with monitoring dashboard
npm run monitor:start

# Dashboard will be available at http://localhost:3000
```

### Monitor Only
```bash
# Start just the monitoring dashboard
npm run monitor
```

## 📋 Prerequisites

- Node.js ≥ 18
- SendGrid account with Marketing API access
- Twenty CRM instance with API access

## ⚙️ Configuration

Edit your `.env` file with the following variables:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_LIST_IDS=12345,67890  # Optional: specific list IDs
SENDGRID_SEGMENT_IDS=segment1,segment2  # Optional: specific segment IDs

# Twenty CRM Configuration
TWENTY_BASE_URL=https://your-twenty-instance.com
TWENTY_API_TOKEN=your_twenty_api_token_here

# Performance Settings
CONCURRENCY=5  # Number of concurrent API calls (1-50)
BATCH_SIZE=100  # Batch size for processing (10-1000)

# Optional: Resume interrupted migration
RESUME=1  # Set to 1 to resume from previous progress
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Lint code
npm run lint
```

## 📊 Data Mapping

The tool maps the following fields from SendGrid to Twenty CRM:

| SendGrid Field | Twenty CRM Field | Notes |
|----------------|------------------|-------|
| `email` | `email` | Required, validated |
| `first_name` | `firstName` | Cleaned and validated |
| `last_name` | `lastName` | Cleaned and validated |
| `city` | `location` | Cleaned and validated |
| `company` | `company` | Cleaned and validated |
| `phone` | `phone` | Cleaned and validated |
| `tags` | `tags` | Merged with existing tags |
| - | `source` | Set to 'sendgrid' |

## 🔧 Advanced Usage

### Resume Interrupted Migration

If a migration is interrupted, you can resume it:

```bash
# Resume from where it left off
RESUME=1 npm start
```

### Performance Tuning

For large datasets, adjust these settings:

```bash
# For high-performance systems
CONCURRENCY=10
BATCH_SIZE=500

# For rate-limited APIs
CONCURRENCY=2
BATCH_SIZE=50
```

### Dry Run Mode

Test the migration without making changes:

```bash
# Dry run (no actual API calls)
DRY_RUN=1 npm start
```

## 📁 Output Files

The tool creates several output files in the `logs/` directory:

- `migration-YYYY-MM-DD.log` - Detailed migration log
- `failed-contacts.csv` - Contacts that failed to migrate
- `migration-progress.json` - Progress tracking (for resume)

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Errors (401/403)**
   - Verify API keys are correct
   - Check API permissions
   - Ensure tokens are not expired

2. **Rate Limiting (429)**
   - Reduce `CONCURRENCY` setting
   - Add delays between requests
   - Contact API providers for higher limits

3. **Network Timeouts**
   - Check internet connection
   - Verify firewall settings
   - Try from different network

4. **Data Issues**
   - Check `logs/failed-contacts.csv`
   - Verify email formats
   - Review field mappings

### Debug Mode

Enable verbose logging:

```bash
DEBUG=1 npm start
```

## 📚 API Reference

### SendGrid API
- **Export**: `POST /v3/marketing/contacts/exports`
- **Poll**: `GET /v3/marketing/contacts/exports/{job_id}`

### Twenty CRM API
- **Create**: `POST /rest/people`
- **Update**: `PATCH /rest/people/{id}`
- **Search**: `GET/POST /rest/people/search`
- **GraphQL**: `POST /graphql/` (fallback)

## 🔒 Security

- API keys are stored in environment variables
- No sensitive data is logged
- All API calls use HTTPS
- Data is cleaned and validated before transmission

## 📈 Performance

Typical performance metrics:
- **Small datasets** (< 1,000 contacts): 1-2 minutes
- **Medium datasets** (1,000-10,000 contacts): 5-15 minutes
- **Large datasets** (> 10,000 contacts): 30+ minutes

Performance depends on:
- API rate limits
- Network speed
- Server response times
- Concurrency settings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:
1. Check the [troubleshooting guide](docs/troubleshooting.md)
2. Review the [API documentation](docs/api-reference.md)
3. Check the logs for error details
4. Open an issue on GitHub

## 🔄 Changelog

### v1.1.0
- Added comprehensive error handling
- Implemented progress tracking and resume capability
- Enhanced data validation and cleaning
- Added comprehensive testing suite
- Improved logging and monitoring
- Added performance optimizations
- Enhanced documentation
- Added real-time monitoring dashboard

### v1.0.0
- Initial release
- Basic SendGrid to Twenty CRM migration
- REST and GraphQL API support
- Basic error handling