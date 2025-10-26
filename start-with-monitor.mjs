import { spawn } from 'child_process';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Mereka Migration System');
console.log('📊 Monitor Dashboard: http://localhost:3000');
console.log('📝 Use the dashboard to start migrations');
console.log('');

// Start ONLY the monitor server
const monitor = spawn('node', ['monitor-server.mjs'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down monitor...');
  monitor.kill();
  process.exit(0);
});

// Handle process errors
monitor.on('error', (error) => {
  console.error('Monitor error:', error);
});

// Handle monitor exit
monitor.on('exit', (code) => {
  console.log(`Monitor exited with code ${code}`);
  process.exit(code);
});


