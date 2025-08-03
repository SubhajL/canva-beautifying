#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Run the test script with tsx
const testScript = path.join(__dirname, 'test-export.ts');
const tsx = spawn('npx', ['tsx', testScript], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: { ...process.env }
});

tsx.on('close', (code) => {
  process.exit(code);
});