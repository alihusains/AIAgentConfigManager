import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const guiDir = path.resolve('/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager/packages/gui');
const vite = path.resolve(guiDir, 'node_modules/vite/bin/vite.js');
const r = spawnSync(process.execPath, [vite, 'build'], { cwd: guiDir, stdio: 'inherit' });
process.exit(r.status ?? 1);