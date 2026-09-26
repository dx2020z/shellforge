/**
 * 写字对决样板的全流程截图：工坊（三道谜语）→ 锻造 → 对决（话语卡、临场写一句、谜语解开）→ 结算。
 * 用法：npm start 后运行 npx tsx scripts/duel-flow.ts [mobile|desktop|landscape]
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.SCREENS_BASE ?? 'http://127.0.0.1:3020';
const which = process.argv[2] ?? 'mobile';
const size = which === 'desktop' ? { width: 1440, height: 900, dpr: 1 } : which === 'landscape' ? { width: 844, height: 390, dpr: 2 } : { width: 390, height: 844, dpr: 2 };
const out = join(process.cwd(), 'docs', 'screens', 'duel');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.dpr, hasTouch: which !== 'desktop', isMobile: which !== 'desktop' });
const page = await context.newPage();
await page.addInitScript('window.__name = (f) => f; window.__sfIntroMs = 8000;');
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
let n = 0;
const shot = async (name: string, p: Page = page) => {
  n++;
  await p.screenshot({ path: join(out, `${which}-${String(n).padStart(2, '0')}-${name}.jpg`), quality: 84, type: 'jpeg' });
  console.log('📸', name);
};
const move = async () => (await page.locator('[class*="seal"]').first().textContent({ timeout: 8000 }).catch(() => '')) ?? '';
const clickCard = async (kw: string) => {
  const c = page.locator(`button[aria-label*="：${kw}，"]:not([disabled])`);
  if (await c.count()) {
    await c.first().click();
    return true;
  }
  return false;
};
const write = async (text: string, snap?: string) => {
  const b = page.locator('button:has-text("临场写一句"):not([disabled])');
  if (!(await b.count())) return false;
  await b.click();
  await page.fill('input[placeholder^="比如"]', text);
  await page.waitForTimeout(300);
  if (snap) await shot(snap);
  await page.click('button:has-text("写下去")');
  return true;
};
const idle = async () => {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('text=击败了').count()) return 'win';
    if (await page.locator('text=长眠了').count()) return 'loss';
    if (await page.locator('[class*="seal"]').count()) return 'ready';
    await page.waitForTimeout(400);
  }
  return 'timeout';
};

await page.goto(base + '/?demo=1&offline=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await shot('workshop-riddles');
await page.fill('textarea', '会喷火、背着硬壳、跑得飞快的螃蟹');
await page.waitForTimeout(500);
await shot('workshop-typing');
await page.click('button[aria-label="开始锻造"]');
await page.waitForSelector('text=带它出发', { timeout: 20000 });
await page.waitForTimeout(1500);
await page.click('text=带它出发');
await page.waitForTimeout(1200);
await page.click('text=点击任意处');
await page.waitForTimeout(2200);
await shot('versus');
await page.click('[class*="versus"]').catch(() => {});
await page.waitForTimeout(2500);
await shot('duel-start');

let shots = 0;
for (let turn = 0; turn < 16; turn++) {
  const state = await idle();
  if (state !== 'ready') break;
  const m = (await move()).trim();
  let done = false;
  if (m === '上弦') done = (await write('大吼一声打断它', shots < 2 ? 'write-mode' : undefined)) || (await clickCard('震慑'));
  if (!done && (m === '直刺' || m === '穿心')) done = (await clickCard('迅捷')) || (await clickCard('坚壳'));
  if (!done && m === '合甲') done = (await clickCard('灼烧')) || (await write('喷一口滚烫的火'));
  if (!done) done = (await clickCard('灼烧')) || (await write('喷火')) || false;
  if (!done) await page.click('button:has-text("扑过去")');
  await page.waitForTimeout(420);
  if (shots < 4) {
    await shot(`turn-${turn + 1}-fx`);
    shots++;
  }
  await page.waitForTimeout(900);
  if (await page.locator('text=谜语解开').count()) await shot(`turn-${turn + 1}-riddle`);
}
await page.waitForTimeout(3000);
await shot('result');
if (await page.locator('button:has-text("下一位")').count()) {
  await page.click('button:has-text("下一位")');
  await page.waitForTimeout(2000);
  await shot('versus-2');
  await page.click('[class*="versus"]').catch(() => {});
  await page.waitForTimeout(2200);
  await write('吹一口冰冷的气');
  await page.waitForTimeout(900);
  await shot('secret-2');
  // 故意乱打，看看长眠之后的流程。
  for (let i = 0; i < 30; i++) {
    const st = await idle();
    if (st !== 'ready') break;
    await page.click('button:has-text("扑过去")');
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(4000);
  await shot('loss');
  if (await page.locator('text=不传承').count()) {
    await page.click('text=不传承');
    await page.waitForTimeout(2500);
    await shot('workshop-after-loss');
  }
  await page.fill('textarea', '长着吸盘、会吐墨的章鱼');
  await page.click('button[aria-label="开始锻造"]');
  await page.waitForSelector('text=带它出发', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.click('text=带它出发');
  await page.waitForTimeout(1200);
  await page.click('text=点击任意处').catch(() => {});
  await page.waitForTimeout(2000);
  await shot('versus-3');
  await page.click('[class*="versus"]').catch(() => {});
  await page.waitForTimeout(1500);
  await page.click('button:has-text("撤退")');
  await page.waitForTimeout(3000);
  await shot('roster');
  await page.click('button[aria-label="打开图鉴"]').catch(() => {});
  await page.waitForTimeout(3500);
  await shot('codex-guards');
}
console.log(errors.length ? '⚠ 页面错误：\n' + [...new Set(errors)].slice(0, 10).join('\n') : '无页面错误');
await browser.close();
