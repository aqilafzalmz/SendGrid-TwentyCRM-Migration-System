import { spawn } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting SendGrid → Twenty CRM Migration with Monitor');
console.log('📊 Monitor Dashboard: http://localhost:3000');
console.log('');

// Start the monitor server
const monitor = spawn('node', ['monitor-server.mjs'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Start the migration
const migration = spawn('node', ['index.mjs'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  monitor.kill();
  migration.kill();
  process.exit(0);
});

// Handle process errors
monitor.on('error', (error) => {
  console.error('Monitor error:', error);
});

migration.on('error', (error) => {
  console.error('Migration error:', error);
});

// Handle process exit
monitor.on('exit', (code) => {
  console.log(`Monitor exited with code ${code}`);
});

migration.on('exit', (code) => {
  console.log(`Migration exited with code ${code}`);
  if (code === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('❌ Migration failed');
  }
  monitor.kill();
  process.exit(code);
});


