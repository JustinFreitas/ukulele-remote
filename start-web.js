const { spawn } = require('child_process');

process.env.CI = '1';

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const args = process.platform === 'win32'
  ? ['/c', 'npx', 'expo', 'start', '--web', '--clear']
  : ['expo', 'start', '--web', '--clear'];

const child = spawn(command, args, {
  stdio: 'inherit',
  windowsHide: true
});

child.on('exit', (code) => {
  process.exit(code || 0);
});


