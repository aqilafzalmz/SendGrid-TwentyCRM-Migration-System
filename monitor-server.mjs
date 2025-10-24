import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.MONITOR_PORT || 3000;
const logsDir = path.resolve('logs');

// WebSocket connections
const clients = new Set();

// Broadcast to all connected clients
function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Parse log files for migration data
async function parseLogData() {
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.startsWith('migration-') && f.endsWith('.log'));
    
    if (logFiles.length === 0) return null;
    
    const latestLog = logFiles.sort().pop();
    const logPath = path.join(logsDir, latestLog);
    const logContent = await fs.readFile(logPath, 'utf8');
    
    const lines = logContent.split('\n').filter(line => line.trim());
    const stats = {
      totalLines: lines.length,
      errors: lines.filter(line => line.includes('[ERROR]')).length,
      warnings: lines.filter(line => line.includes('[WARN]')).length,
      info: lines.filter(line => line.includes('[INFO]')).length,
      lastUpdate: new Date().toISOString()
    };
    
    // Extract progress information
    const progressLines = lines.filter(line => line.includes('Progress:'));
    if (progressLines.length > 0) {
      const lastProgress = progressLines[progressLines.length - 1];
      const progressMatch = lastProgress.match(/Progress: (\d+)\/(\d+)/);
      if (progressMatch) {
        stats.processed = parseInt(progressMatch[1]);
        stats.total = parseInt(progressMatch[2]);
        stats.percentage = Math.round((stats.processed / stats.total) * 100);
      }
    }
    
    // Extract rate information
    const rateMatch = lines.find(line => line.includes('/s, ETA:'));
    if (rateMatch) {
      const rateInfo = rateMatch.match(/\((\d+)\/s, ETA: (\d+)s\)/);
      if (rateInfo) {
        stats.rate = parseInt(rateInfo[1]);
        stats.eta = parseInt(rateInfo[2]);
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Error parsing log data:', error);
    return null;
  }
}

// Check for progress file
async function getProgressData() {
  try {
    const progressPath = path.join(logsDir, 'migration-progress.json');
    const data = await fs.readFile(progressPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Check for failed contacts
async function getFailedContacts() {
  try {
    const failedPath = path.join(logsDir, 'failed-contacts.csv');
    const data = await fs.readFile(failedPath, 'utf8');
    const lines = data.split('\n').filter(line => line.trim());
    return {
      count: lines.length - 1, // Subtract header
      data: lines.slice(0, 10) // First 10 failed contacts
    };
  } catch (error) {
    return { count: 0, data: [] };
  }
}

// Get system information
async function getSystemInfo() {
  const memUsage = process.memoryUsage();
  return {
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
    },
    nodeVersion: process.version,
    platform: process.platform
  };
}

// API endpoints
app.get('/api/status', async (req, res) => {
  try {
    const [logData, progressData, failedContacts, systemInfo] = await Promise.all([
      parseLogData(),
      getProgressData(),
      getFailedContacts(),
      getSystemInfo()
    ]);
    
    res.json({
      logData,
      progressData,
      failedContacts,
      systemInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.startsWith('migration-') && f.endsWith('.log'));
    
    if (logFiles.length === 0) {
      return res.json({ logs: [] });
    }
    
    const latestLog = logFiles.sort().pop();
    const logPath = path.join(logsDir, latestLog);
    const logContent = await fs.readFile(logPath, 'utf8');
    
    const lines = logContent.split('\n')
      .filter(line => line.trim())
      .slice(-100) // Last 100 lines
      .map(line => {
        const match = line.match(/\[([^\]]+)\] \[([^\]]+)\] (.+)/);
        if (match) {
          return {
            timestamp: match[1],
            level: match[2],
            message: match[3]
          };
        }
        return { timestamp: '', level: 'INFO', message: line };
      });
    
    res.json({ logs: lines });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to monitoring dashboard');
  clients.add(ws);
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected from monitoring dashboard');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast updates every 5 seconds
setInterval(async () => {
  try {
    const [logData, progressData, failedContacts, systemInfo] = await Promise.all([
      parseLogData(),
      getProgressData(),
      getFailedContacts(),
      getSystemInfo()
    ]);
    
    broadcast({
      type: 'update',
      data: {
        logData,
        progressData,
        failedContacts,
        systemInfo,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error broadcasting update:', error);
  }
}, 5000);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Migration Monitor running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down monitor server...');
  server.close(() => {
    console.log('✅ Monitor server stopped');
    process.exit(0);
  });
});


