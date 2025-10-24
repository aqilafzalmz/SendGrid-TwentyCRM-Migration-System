# 📊 Migration Monitoring Dashboard

A beautiful, real-time web-based dashboard for monitoring your SendGrid → Twenty CRM migration progress.

## 🎯 What You Get

### Real-time Monitoring
- **Live Progress Bar**: Visual progress with percentage completion
- **Statistics Dashboard**: Processed, Created, Updated, Failed counts
- **Rate Monitoring**: Contacts processed per second
- **ETA Calculation**: Estimated time to completion
- **Status Indicators**: Visual status (Running, Completed, Error)

### Error Tracking
- **Failed Contacts**: List of contacts that failed to migrate
- **Error Details**: Specific error messages for each failure
- **CSV Export**: Failed contacts saved to `logs/failed-contacts.csv`

### System Monitoring
- **Memory Usage**: Current memory consumption
- **Uptime**: How long the migration has been running
- **Node Version**: Node.js version information
- **Platform Info**: Operating system details

### Live Logs
- **Real-time Logs**: Live log entries with timestamps
- **Color-coded Levels**: INFO (blue), WARN (yellow), ERROR (red)
- **Auto-refresh**: Updates every 10 seconds
- **Recent Entries**: Last 100 log entries

## 🚀 Quick Start

### Option 1: Start with Monitor (Recommended)
```bash
# Install dependencies
npm install

# Start migration with monitoring dashboard
npm run monitor:start

# Dashboard available at http://localhost:3000
```

### Option 2: Demo the Monitor
```bash
# Run demo simulation to test the monitor
npm run demo

# Open http://localhost:3000 to see the dashboard
```

### Option 3: Monitor Only
```bash
# Start just the monitoring dashboard
npm run monitor

# Then run migration in another terminal
npm start
```

## 📱 Dashboard Features

### Responsive Design
- **Desktop**: Full-featured dashboard
- **Tablet**: Optimized layout
- **Mobile**: Touch-friendly interface
- **Real-time**: WebSocket updates every 5 seconds

### Visual Indicators
- 🟢 **Green**: Migration running normally
- 🟡 **Yellow**: Migration in progress
- 🔴 **Red**: Migration failed or error
- ⚪ **Gray**: Migration not started

### Progress Tracking
- **Progress Bar**: Visual representation of completion
- **Percentage**: Exact completion percentage
- **Counters**: Processed/Total contacts
- **Rate**: Contacts processed per second
- **ETA**: Estimated time to completion

### Error Management
- **Failed Contacts**: List of failed contacts
- **Error Messages**: Specific error details
- **CSV Export**: Download failed contacts
- **Retry Logic**: Automatic retry for transient failures

## 🔧 Configuration

### Environment Variables
```bash
# Monitor server port (default: 3000)
MONITOR_PORT=3000

# Enable debug mode
DEBUG=1
```

### Customization
- **Colors**: Modify CSS in `public/index.html`
- **Layout**: Adjust grid system and card layout
- **Features**: Add custom functionality
- **API**: Extend API endpoints in `monitor-server.mjs`

## 📡 Technical Details

### Architecture
- **Frontend**: HTML, CSS, JavaScript (no frameworks)
- **Backend**: Express.js server
- **Real-time**: WebSocket connections
- **Data**: File-based (logs, progress files)

### API Endpoints
- `GET /api/status` - Current migration status
- `GET /api/logs` - Recent log entries
- `WebSocket /` - Real-time updates

### File Structure
```
├── monitor-server.mjs          # Express server + WebSocket
├── start-with-monitor.mjs      # Startup script
├── demo-monitor.mjs            # Demo simulation
├── public/
│   └── index.html              # Dashboard UI
└── logs/
    ├── migration-YYYY-MM-DD.log
    ├── migration-progress.json
    └── failed-contacts.csv
```

## 🎨 Dashboard Screenshots

### Main Dashboard
- **Status Cards**: Migration status, progress, statistics
- **Progress Bar**: Visual progress with percentage
- **Statistics**: Processed, Created, Updated, Failed
- **System Info**: Memory, uptime, Node version

### Error Monitoring
- **Failed Contacts**: List of failed contacts
- **Error Details**: Specific error messages
- **CSV Export**: Download failed contacts

### Log Viewer
- **Real-time Logs**: Live log entries
- **Color-coded**: INFO, WARN, ERROR levels
- **Timestamps**: Precise timing information
- **Auto-refresh**: Updates every 10 seconds

## 🛠️ Troubleshooting

### Dashboard Not Loading
1. Check if monitor server is running: `npm run monitor`
2. Verify port 3000 is available
3. Check browser console for errors
4. Try: `http://localhost:3000`

### No Real-time Updates
1. Check WebSocket connection status (top-right indicator)
2. Verify monitor server is running
3. Check network connectivity
4. Refresh the page

### Missing Data
1. Ensure migration is running
2. Check log files exist in `logs/` directory
3. Verify API endpoints are accessible
4. Check browser network tab

### Performance Issues
1. Reduce update frequency in `monitor-server.mjs`
2. Limit log entries displayed
3. Check system resources
4. Close other browser tabs

## 🔒 Security

- **Local Only**: No external network access
- **No Authentication**: Local use only
- **No Sensitive Data**: Logs don't expose API keys
- **WebSocket Security**: Local connections only

## 📈 Performance

### Recommended Settings
- **Small datasets** (< 1,000 contacts): Default settings
- **Medium datasets** (1,000-10,000 contacts): Monitor every 10 seconds
- **Large datasets** (> 10,000 contacts): Monitor every 30 seconds

### Memory Usage
- **Monitor server**: ~20MB
- **Dashboard**: ~5MB
- **Total overhead**: ~25MB

### Network Usage
- **WebSocket**: ~1KB per update
- **API calls**: ~2KB per request
- **Total**: ~5KB per minute

## 🚀 Deployment

### Local Development
```bash
npm run monitor:start
```

### Production
```bash
# Start monitor in background
nohup npm run monitor &

# Start migration
npm start
```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["npm", "run", "monitor:start"]
```

## 🎯 Best Practices

1. **Keep Dashboard Open**: Monitor progress in real-time
2. **Check Failed Contacts**: Review failed contacts regularly
3. **Monitor System Resources**: Watch memory and CPU usage
4. **Review Logs**: Check logs for any issues
5. **Backup Progress**: Progress is automatically saved

## 🔄 Integration

The monitor automatically integrates with your migration by:
- Reading log files from `logs/` directory
- Parsing progress information
- Monitoring system resources
- Tracking failed contacts
- Providing real-time updates

**No code changes to your migration script are required!**

## 📊 Demo

Try the demo to see the monitoring dashboard in action:

```bash
# Run demo simulation
npm run demo

# Open http://localhost:3000
# Watch the real-time progress simulation
```

## 🎉 Features Summary

✅ **Real-time Progress Monitoring**  
✅ **Error Tracking and Management**  
✅ **System Resource Monitoring**  
✅ **Live Log Viewer**  
✅ **WebSocket Real-time Updates**  
✅ **Responsive Design**  
✅ **No Code Changes Required**  
✅ **Easy Setup and Configuration**  
✅ **Production Ready**  
✅ **Comprehensive Documentation**  

Your migration monitoring is now enterprise-grade with beautiful, real-time visibility into every aspect of the migration process!


