import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appApi = path.join(root, 'src', 'app', 'api');
const apiBackup = path.join(root, 'src', `.pages-api-backup-${process.pid}`);
const config = path.join(root, 'next.config.ts');
const configBackup = path.join(root, `.pages-next-config-${process.pid}.ts`);
const out = path.join(root, 'out');
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_PAGES_BASE_PATH || '/shellforge');

function normalizeBasePath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
    const child = spawn(process.execPath, [nextBin, 'build'], { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', code => (code === 0 ? resolve() : reject(new Error(`next build exited with ${code}`))));
  });
}

async function rewritePublicPaths(directory) {
  if (!basePath) return;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewritePublicPaths(file);
      continue;
    }
    if (!/\.(?:html|js|css|json|txt|xml|map)$/i.test(entry.name)) continue;
    const original = await fs.readFile(file, 'utf8');
    const rewritten = original.replace(/\/(assets|fonts)\//g, (match, kind, offset, source) => {
      const before = source.slice(Math.max(0, offset - basePath.length), offset);
      return before === basePath ? match : `${basePath}/${kind}/`;
    });
    if (rewritten !== original) await fs.writeFile(file, rewritten, 'utf8');
  }
}

async function main() {
  let apiMoved = false;
  let configMoved = false;
  try {
    await fs.rm(apiBackup, { recursive: true, force: true });
    await fs.rm(configBackup, { force: true });
    await fs.rename(appApi, apiBackup);
    apiMoved = true;
    await fs.rename(config, configBackup);
    configMoved = true;
    const staticConfig = `import type { NextConfig } from 'next';\n\nconst config: NextConfig = {\n  output: 'export',\n  trailingSlash: true,\n  basePath: ${JSON.stringify(basePath)},\n  assetPrefix: ${JSON.stringify(basePath ? `${basePath}/` : undefined)},\n  images: { unoptimized: true },\n  experimental: { cpus: 1 },\n};\n\nexport default config;\n`;
    await fs.writeFile(config, staticConfig, 'utf8');
    await fs.rm(out, { recursive: true, force: true });
    await runNextBuild();
    await rewritePublicPaths(out);
    console.log(`GitHub Pages artifact ready: ${out} (basePath=${basePath || '/'})`);
  } finally {
    if (configMoved) {
      await fs.rm(config, { force: true });
      await fs.rename(configBackup, config);
    }
    if (apiMoved) {
      await fs.rename(apiBackup, appApi);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
