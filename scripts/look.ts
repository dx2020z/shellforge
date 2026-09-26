/** 用几句话锻造造物并截图，检查外形是否能看、是否撞款。npx tsx scripts/look.ts */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const base = process.env.SCREENS_BASE ?? 'http://127.0.0.1:3020';
const out = join(process.cwd(), 'docs', 'screens', 'look');
mkdirSync(out, { recursive: true });
const lines = process.argv.slice(2).length ? process.argv.slice(2) : ['长着蘑菇伞的小狐狸', '背上开满花的乌龟', '浑身是刺的仙人掌刺猬', '会喷火、背着硬壳、跑得飞快的螃蟹'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
await page.addInitScript('window.__name = (f) => f;');
await page.goto(base + '/?demo=1&offline=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
for (const [i, line] of lines.entries()) {
  if (i > 0) {
    await page.click('text=写一只新的');
    await page.waitForTimeout(600);
  }
  await page.fill('textarea', line);
  await page.click('button[aria-label="开始锻造"]');
  await page.waitForSelector('text=带它出发', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, `${i + 1}.jpg`), type: 'jpeg', quality: 80 });
  console.log('📸', line);
  await page.click('text=回港口').catch(() => {});
  await page.waitForTimeout(1500);
}
await browser.close();
