/** 预生成模型质检：打开 /design/models 截一张长图。npm start 后 npx tsx scripts/model-sheet.ts */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const base = process.env.SCREENS_BASE ?? 'http://127.0.0.1:3020';
const out = join(process.cwd(), 'docs', 'screens', 'models');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 900 } })).newPage();
await page.addInitScript('window.__name = (f) => f;');
page.on('pageerror', e => console.log('page error', e.message));
await page.goto(base + '/design/models' + (process.argv[2] ? `?only=${process.argv[2]}` : ''), { waitUntil: 'networkidle' });
await page.waitForSelector('main[data-done]', { timeout: 600000 });
await page.waitForTimeout(500);
const sections = await page.locator('section').count();
for (let i = 0; i < sections; i += 6) {
  const box = await page.locator('section').nth(i).boundingBox();
  const last = await page.locator('section').nth(Math.min(sections - 1, i + 5)).boundingBox();
  await page.screenshot({ path: join(out, `sheet-${i / 6 + 1}.jpg`), type: 'jpeg', quality: 85, fullPage: true, clip: { x: 0, y: box!.y - 4, width: 900, height: last!.y + last!.height - box!.y + 8 } });
}
console.log('sections', sections);
await browser.close();
