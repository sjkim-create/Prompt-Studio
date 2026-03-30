// Helper: starts aigle-prompt-studio dev server
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aigleDir = path.join(__dirname, '..', 'aigle-prompt-studio');

const child = spawn('node', ['./node_modules/.bin/vite', '--port', '5174'], {
  cwd: aigleDir,
  stdio: 'inherit',
  shell: false,
});

child.on('error', (e) => { console.error(e); process.exit(1); });
