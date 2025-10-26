import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
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

// Get SendGrid lists
async function getSendGridLists() {
  try {
    const { default: fetch } = await import('node-fetch');
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    
    if (!SENDGRID_API_KEY) {
      return { error: 'SENDGRID_API_KEY not configured' };
    }

    const response = await fetch('https://api.sendgrid.com/v3/marketing/lists', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Failed to fetch lists: ${response.status} ${errorText}` };
    }

    const data = await response.json();
    return { lists: data.result || [] };
  } catch (error) {
    return { error: error.message };
  }
}

// Get selected list IDs from environment
async function getSelectedLists() {
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

// Save selected lists
async function saveSelectedLists(listIds, listNames = [], destinationType) {
  try {
    const selectedListsPath = path.join(logsDir, 'selected-lists.json');
    await fs.writeFile(selectedListsPath, JSON.stringify({ 
      listIds, 
      listNames,
      destinationType 
    }), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving selected lists:', error);
    return false;
  }
}

// Track active migrations
const activeMigrations = new Map();

// Start migration process
function startMigrationProcess(listIds, listNames = [], destinationType) {
  try {
    // Set environment variables for the migration
    const env = { ...process.env };
    env.SENDGRID_LIST_IDS = listIds.join(',');
    env.DESTINATION_TYPE = destinationType;
    
    // Store list names as comma-separated for passing to migration
    env.SENDGRID_LIST_NAMES = listNames.join(',');
    
    console.log(`\n🚀 Starting migration for lists: ${listNames.join(', ') || listIds.join(', ')}`);
    console.log(`📁 Destination type: ${destinationType}`);
    console.log(`⏳ Migration process starting...\n`);
    
    // Spawn migration process
    const migration = spawn('node', ['index.mjs'], {
      env: env,
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
      detached: false
    });
    
    // Keep reference to prevent garbage collection
    const migrationId = Date.now().toString();
    activeMigrations.set(migrationId, migration);
    
    migration.on('close', (code) => {
      console.log(`\n✅ Migration process completed with code ${code}`);
      activeMigrations.delete(migrationId);
    });
    
    migration.on('error', (error) => {
      console.error(`❌ Migration process error:`, error);
      activeMigrations.delete(migrationId);
    });
    
    return true;
  } catch (error) {
    console.error('Error starting migration:', error);
    return false;
  }
}

// API endpoints
app.get('/api/status', async (req, res) => {
  try {
    const [logData, progressData, failedContacts, systemInfo, selectedLists] = await Promise.all([
      parseLogData(),
      getProgressData(),
      getFailedContacts(),
      getSystemInfo(),
      getSelectedLists()
    ]);
    
    res.json({
      logData,
      progressData,
      failedContacts,
      systemInfo,
      selectedLists,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get SendGrid lists
app.get('/api/lists', async (req, res) => {
  try {
    const listsData = await getSendGridLists();
    res.json(listsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to select lists
app.post('/api/lists/select', async (req, res) => {
  try {
    const { listIds, listNames = [], destinationType } = req.body;
    if (!Array.isArray(listIds)) {
      return res.status(400).json({ error: 'listIds must be an array' });
    }
    
    const success = await saveSelectedLists(listIds, listNames, destinationType);
    res.json({ success, listIds, listNames, destinationType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to start migration
app.post('/api/migration/start', (req, res) => {
  try {
    const { listIds, listNames = [], destinationType } = req.body;
    if (!Array.isArray(listIds) || listIds.length === 0) {
      return res.status(400).json({ error: 'At least one list must be selected' });
    }
    
    // Return response immediately
    res.json({ success: true, message: 'Migration starting...' });
    
    // Start the migration process asynchronously
    saveSelectedLists(listIds, listNames, destinationType).then(() => {
      startMigrationProcess(listIds, listNames, destinationType);
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
    const [logData, progressData, failedContacts, systemInfo, selectedLists] = await Promise.all([
      parseLogData(),
      getProgressData(),
      getFailedContacts(),
      getSystemInfo(),
      getSelectedLists()
    ]);
    
    broadcast({
      type: 'update',
      data: {
        logData,
        progressData,
        failedContacts,
        systemInfo,
        selectedLists,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error broadcasting update:', error);
  }
}, 5000);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Mereka Migration System Monitor running at http://localhost:${PORT}`);
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


