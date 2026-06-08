import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageRoot, '..');
const frontendDir = path.join(repoRoot, 'frontend');
const backendDir = path.join(repoRoot, 'backend');
const publicDir = path.join(packageRoot, 'public');
const serverDir = path.join(packageRoot, 'server');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function syncRuntimeDependencies() {
  const backendPackage = await readJson(path.join(backendDir, 'package.json'));
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = await readJson(packageJsonPath);
  packageJson.dependencies = backendPackage.dependencies || {};
  await writeJson(packageJsonPath, packageJson);
}

async function copyBundles() {
  await fs.rm(publicDir, { recursive: true, force: true });
  await fs.rm(serverDir, { recursive: true, force: true });
  await fs.cp(path.join(frontendDir, 'dist'), publicDir, { recursive: true });
  await fs.cp(path.join(backendDir, 'dist'), serverDir, { recursive: true });
  await fs.rm(path.join(serverDir, 'tsconfig.build.tsbuildinfo'), { force: true });
}

async function main() {
  await syncRuntimeDependencies();

  run('npm', ['run', 'build'], {
    cwd: frontendDir,
    env: {
      ...process.env,
      VITE_CANVAS_FLOW_API_URL: '__CANVAS_FLOW_SAME_ORIGIN__',
      VITE_CANVAS_FLOW_API_TOKEN: '',
      VITE_CANVAS_FLOW_LOGIN: 'false',
    },
  });

  run('npm', ['run', 'build'], {
    cwd: backendDir,
    env: process.env,
  });

  await copyBundles();
  console.log(`Canvas Flow npm bundle written to ${packageRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
