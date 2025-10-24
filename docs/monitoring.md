# Migration Monitoring Dashboard

A real-time web-based dashboard for monitoring your SendGrid → Twenty CRM migration progress.

## 🚀 Quick Start

### Option 1: Start with Monitor (Recommended)
```bash
# Install dependencies
npm install

# Start migration with monitoring dashboard
npm run monitor:start
```

### Option 2: Start Monitor Separately
```bash
# Terminal 1: Start the monitor
npm run monitor

# Terminal 2: Start the migration
npm start
```

## 📊 Dashboard Features

### Real-time Monitoring
- **Live Progress**: Real-time progress bar and statistics
- **WebSocket Updates**: Automatic updates every 5 seconds
- **Connection Status**: Visual indicator of connection status
- **Auto-reconnect**: Automatically reconnects if connection is lost

### Migration Status
- **Current State**: Running, Completed, Not Started, or Error
- **Progress Tracking**: Processed/Total contacts with percentage
- **Rate Monitoring**: Contacts processed per second
- **ETA Calculation**: Estimated time to completion

### Statistics Dashboard
- **Processed**: Total contacts processed
- **Created**: New contacts created in Twenty CRM
- **Updated**: Existing contacts updated
- **Failed**: Contacts that failed to migrate

### Error Monitoring
- **Failed Contacts**: List of contacts that failed to migrate
- **Error Details**: Specific error messages for failed contacts
- **CSV Export**: Failed contacts saved to `logs/failed-contacts.csv`

### System Information
- **Uptime**: How long the migration has been running
- **Memory Usage**: Current memory consumption
- **Node Version**: Node.js version information
- **Platform**: Operating system information

### Log Viewer
- **Real-time Logs**: Live log entries with timestamps
- **Log Levels**: Color-coded log levels (INFO, WARN, ERROR)
- **Recent Entries**: Last 100 log entries
- **Auto-refresh**: Logs update every 10 seconds

## 🎯 Dashboard Components

### Status Indicator
- 🟢 **Green**: Migration running normally
- 🟡 **Yellow**: Migration in progress
- 🔴 **Red**: Migration failed or error
- ⚪ **Gray**: Migration not started

### Progress Bar
- Visual representation of migration progress
- Percentage completion
- Smooth animations for progress updates

### Statistics Cards
- **Processed**: Total contacts processed
- **Created**: New contacts created
- **Updated**: Existing contacts updated
- **Failed**: Contacts that failed

### Failed Contacts Panel
- List of failed contacts with error messages
- Limited to first 10 for performance
- Full list available in CSV file

### System Info Panel
- Server uptime
- Memory usage
- Node.js version
- Platform information

## 🔧 Configuration

### Environment Variables
```bash
# Monitor server port (default: 3000)
MONITOR_PORT=3000

# Enable debug mode
DEBUG=1
```

### Customization
The dashboard can be customized by modifying:
- `public/index.html` - HTML structure and styling
- `monitor-server.mjs` - Server logic and API endpoints
- CSS styles in the HTML file for visual customization

## 📡 API Endpoints

### GET /api/status
Returns current migration status and statistics.

**Response:**
```json
{
  "logData": {
    "processed": 150,
    "total": 1000,
    "rate": 5,
    "eta": 120
  },
  "progressData": {
    "processed": 150,
    "total": 1000,
    "created": 120,
    "updated": 30,
    "failed": 0
  },
  "failedContacts": {
    "count": 0,
    "data": []
  },
  "systemInfo": {
    "uptime": 300,
    "memory": {
      "heapUsed": 45
    },
    "nodeVersion": "v18.17.0"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /api/logs
Returns recent log entries.

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "level": "INFO",
      "message": "Migration started"
    }
  ]
}
```

## 🔄 WebSocket Events

### Connection
- **URL**: `ws://localhost:3000`
- **Auto-reconnect**: Yes, every 5 seconds
- **Heartbeat**: Every 5 seconds

### Message Types
- **update**: Migration status update
- **error**: Error notification
- **complete**: Migration completion

## 🛠️ Troubleshooting

### Dashboard Not Loading
1. Check if monitor server is running: `npm run monitor`
2. Verify port 3000 is available
3. Check browser console for errors

### No Real-time Updates
1. Check WebSocket connection status
2. Verify monitor server is running
3. Check network connectivity

### Missing Data
1. Ensure migration is running
2. Check log files exist in `logs/` directory
3. Verify API endpoints are accessible

### Performance Issues
1. Reduce update frequency in `monitor-server.mjs`
2. Limit log entries displayed
3. Check system resources

## 📱 Mobile Support

The dashboard is responsive and works on:
- Desktop browsers
- Tablet devices
- Mobile phones
- Touch interfaces

## 🔒 Security

- No authentication required (local use only)
- No sensitive data exposed in logs
- WebSocket connections are local only
- No external network access

## 📈 Performance

### Recommended Settings
- **Small datasets** (< 1,000 contacts): Default settings
- **Medium datasets** (1,000-10,000 contacts): Monitor every 10 seconds
- **Large datasets** (> 10,000 contacts): Monitor every 30 seconds

### Memory Usage
- Monitor server: ~20MB
- Dashboard: ~5MB
- Total overhead: ~25MB

## 🎨 Customization

### Styling
Modify the CSS in `public/index.html` to customize:
- Colors and themes
- Layout and spacing
- Fonts and typography
- Animations and transitions

### Layout
- Grid-based responsive layout
- Card-based component design
- Mobile-first approach
- Flexible grid system

### Features
Add custom features by modifying:
- `monitor-server.mjs` - Server-side logic
- `public/index.html` - Client-side JavaScript
- API endpoints for custom data

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

## 📊 Monitoring Best Practices

1. **Keep Dashboard Open**: Monitor progress in real-time
2. **Check Failed Contacts**: Review failed contacts regularly
3. **Monitor System Resources**: Watch memory and CPU usage
4. **Review Logs**: Check logs for any issues
5. **Backup Progress**: Progress is automatically saved

## 🔄 Integration with Migration

The monitor automatically integrates with the migration script by:
- Reading log files from `logs/` directory
- Parsing progress information
- Monitoring system resources
- Tracking failed contacts
- Providing real-time updates

No code changes to the migration script are required!


