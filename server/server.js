// StockSense Express Backend Entrypoint
// Run with: npm run dev:api (or tsx server/server.ts)

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

// Auto-delegate to tsx server/server.ts for TypeScript support
const tsx = path.resolve(__dirname, '../node_modules/.bin/tsx.cmd');
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', path.join(__dirname, 'server.ts')], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
