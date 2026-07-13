const { spawn } = require('child_process');

process.env.CI = '1';

// Launch expo start with --https flag to serve the app securely
const child = spawn('npx.cmd', ['expo', 'start', '--web', '--https', '--clear'], {
  shell: true,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code);
});
