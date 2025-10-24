# Troubleshooting

## Common Issues and Solutions

### Authentication Errors

#### 401/403 Errors
**Problem**: Authentication failed
**Solutions**:
- Verify your API keys are correct
- Check that your SendGrid API key has Marketing API permissions
- Ensure your Twenty CRM API token is valid and not expired
- Verify the Twenty CRM base URL is correct

#### SendGrid API Key Issues
```bash
# Test your SendGrid API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.sendgrid.com/v3/marketing/contacts
```

#### Twenty CRM API Token Issues
```bash
# Test your Twenty CRM API token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-twenty-instance.com/rest/people
```

### Network and Rate Limiting

#### Rate Limit Errors (429)
**Problem**: Too many requests per second
**Solutions**:
- Reduce `CONCURRENCY` in your `.env` file (try 1-3)
- Add delays between requests
- Contact SendGrid/Twenty CRM support for higher limits

#### Network Timeouts
**Problem**: Requests timing out
**Solutions**:
- Check your internet connection
- Verify firewall settings
- Try running from a different network
- Increase timeout values in the code

### Data Issues

#### Missing Contacts
**Problem**: Some contacts not migrated
**Solutions**:
- Check the `logs/failed-contacts.csv` file
- Verify email addresses are valid
- Check for duplicate emails in SendGrid
- Review Twenty CRM field mappings

#### Invalid Data Format
**Problem**: Data not mapping correctly
**Solutions**:
- Check the `normalizeRow` function in `index.mjs`
- Verify SendGrid export format
- Review Twenty CRM field requirements
- Test with a small dataset first

### Performance Issues

#### Slow Migration
**Problem**: Migration taking too long
**Solutions**:
- Increase `CONCURRENCY` (but watch for rate limits)
- Process in smaller batches
- Use `BATCH_SIZE` to control memory usage
- Monitor system resources

#### Memory Issues
**Problem**: Out of memory errors
**Solutions**:
- Reduce `BATCH_SIZE`
- Process contacts in smaller chunks
- Increase Node.js memory limit: `node --max-old-space-size=4096 index.mjs`

### API Endpoint Issues

#### 404/405 on Search Endpoints
**Problem**: REST search not available
**Solutions**:
- The system automatically falls back to GraphQL
- This is normal behavior, not an error
- Check Twenty CRM API documentation for available endpoints

#### GraphQL Errors
**Problem**: GraphQL queries failing
**Solutions**:
- Verify Twenty CRM GraphQL endpoint is accessible
- Check query syntax in the code
- Review Twenty CRM GraphQL schema

### Logging and Debugging

#### Enable Debug Logging
```bash
# Add to your .env file
DEBUG=1
```

#### Check Log Files
```bash
# View recent logs
ls -la logs/
tail -f logs/migration-$(date +%Y-%m-%d).log

# Check failed contacts
cat logs/failed-contacts.csv
```

#### Dry Run for Testing
```bash
# Test without making changes
DRY_RUN=1 npm start
```

### Environment Issues

#### Missing Environment Variables
**Problem**: Configuration errors
**Solutions**:
- Copy `.env.example` to `.env`
- Fill in all required variables
- Check for typos in variable names
- Restart the application after changes

#### Node.js Version Issues
**Problem**: Compatibility errors
**Solutions**:
- Ensure Node.js ≥ 18
- Update to latest LTS version
- Check for deprecated features

### SendGrid Specific Issues

#### Export Job Failures
**Problem**: SendGrid export not completing
**Solutions**:
- Check SendGrid account limits
- Verify list/segment IDs exist
- Wait for export to complete (can take time)
- Try exporting smaller datasets

#### CSV Download Issues
**Problem**: Cannot download exported CSV
**Solutions**:
- Check CSV URLs are accessible
- Verify network connectivity
- Try downloading manually first

### Twenty CRM Specific Issues

#### Field Mapping Problems
**Problem**: Data not appearing in correct fields
**Solutions**:
- Review Twenty CRM field names
- Check for required fields
- Verify data types match
- Test with a single contact first

#### Duplicate Handling
**Problem**: Creating duplicates instead of updating
**Solutions**:
- Check email matching logic
- Verify search functionality
- Review upsert logic
- Test with known existing contacts

## Getting Help

### Log Analysis
1. Check the main log file in `logs/` directory
2. Look for ERROR level messages
3. Review failed contacts CSV
4. Check network connectivity

### Support Resources
- SendGrid API Documentation
- Twenty CRM API Documentation
- Node.js Documentation
- Project GitHub Issues (if applicable)

### Debug Mode
```bash
# Run with verbose logging
DEBUG=1 npm start
```

### Test Individual Components
```bash
# Test configuration
node -e "console.log('Config test:', process.env.SENDGRID_API_KEY ? 'OK' : 'MISSING')"

# Test API connectivity
npm test
```