import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

// Demo script to simulate migration progress for testing the monitor
const logsDir = path.resolve('logs');
await fs.mkdir(logsDir, { recursive: true });

const logPath = path.join(logsDir, `migration-${new Date().toISOString().split('T')[0]}.log`);
const progressPath = path.join(logsDir, 'migration-progress.json');

// Simulate migration progress
const totalContacts = 1000;
let processed = 0;
let created = 0;
let updated = 0;
let failed = 0;

console.log('🎭 Starting demo migration simulation...');
console.log('📊 Open http://localhost:3000 to see the monitoring dashboard');
console.log('');

// Start the monitor server
import { spawn } from 'child_process';
const monitor = spawn('node', ['monitor-server.mjs'], {
  stdio: 'inherit'
});

// Wait a moment for monitor to start
await new Promise(resolve => setTimeout(resolve, 2000));

// Simulate migration progress
const simulateProgress = async () => {
  for (let i = 0; i < totalContacts; i++) {
    processed++;
    
    // Simulate different outcomes
    const rand = Math.random();
    if (rand < 0.7) created++;
    else if (rand < 0.9) updated++;
    else failed++;
    
    // Log progress
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [INFO] Progress: ${processed}/${totalContacts} (${Math.round(processed/5)}/s, ETA: ${Math.round((totalContacts - processed) / 5)}s)`;
    await fs.appendFile(logPath, logEntry + '\n', 'utf8');
    
    // Save progress
    await fs.writeFile(progressPath, JSON.stringify({
      processed,
      total: totalContacts,
      created,
      updated,
      failed,
      startTime: Date.now() - (processed * 200),
      lastUpdate: timestamp
    }, null, 2), 'utf8');
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Log every 50 contacts
    if (processed % 50 === 0) {
      console.log(`📈 Processed ${processed}/${totalContacts} contacts (${Math.round(processed/totalContacts*100)}%)`);
    }
  }
  
  // Final log
  const timestamp = new Date().toISOString();
  const finalLog = `[${timestamp}] [INFO] Migration completed - Total: ${processed}, Created: ${created}, Updated: ${updated}, Failed: ${failed}`;
  await fs.appendFile(logPath, finalLog + '\n', 'utf8');
  
  console.log('');
  console.log('✅ Demo migration completed!');
  console.log(`📊 Total processed: ${processed}`);
  console.log(`🆕 Created: ${created}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');
  console.log('📊 Check the monitoring dashboard at http://localhost:3000');
  console.log('🛑 Press Ctrl+C to stop the monitor');
  
  // Keep monitor running
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping demo...');
    monitor.kill();
    process.exit(0);
  });
};

// Start simulation
simulateProgress().catch(console.error);


