/**
 * 全流程截图：工坊 → 锻造仪式 → 一命提示 → 教学战斗 → 结算。
 * 用法：npm start 后运行 npx tsx scripts/flow.ts [mobile|desktop]
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.SCREENS_BASE ?? 'http://127.0.0.1:3020';
const which = process.argv[2] ?? 'mobile';
const size = which === 'desktop' ? { width: 1440, height: 900, dpr: 1 } : which === 'landscape' ? { width: 844, height: 390, dpr: 2 } : { width: 390, height: 844, dpr: 2 };
const out = join(process.cwd(), 'docs', 'screens', 'flow');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.dpr, hasTouch: which !== 'desktop', isMobile: which !== 'desktop' });
const page = await context.newPage();
await page.addInitScript('window.__name = (f) => f; window.__sfIntroMs = 6000;');
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
let n = 0;
const shot = async (name: string, p: Page = page) => {
  n++;
  await p.screenshot({ path: join(out, `${which}-${String(n).padStart(2, '0')}-${name}.jpg`), quality: 84, type: 'jpeg' });
  console.log('📸', name);
};

await page.goto(base + '/?demo=1&offline=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await shot('workshop');

await page.fill('textarea', '一只毛茸茸、很乖、从不还嘴的健身牛');
await page.click('button[aria-label="开始锻造"]');
await page.waitForTimeout(900);
await shot('forge-rise');
await page.waitForTimeout(1600);
await shot('forge-reveal');
await page.waitForTimeout(2600);
await shot('forge-hatch');
await page.waitForSelector('text=带它出发', { timeout: 15000 });
await page.waitForTimeout(1500);
await shot('forge-done');

await page.click('text=带它出发');
await page.waitForTimeout(1200);
await shot('omen');
await page.click('text=点击任意处');
await page.waitForTimeout(3500);
await shot('map-first');
await page.click('text=下潜，挑战');
await page.waitForTimeout(1500);
await shot('versus');
await page.click('[class*="versus"]').catch(() => {});
await page.waitForTimeout(2000);
await shot('battle-start');

// 教学战斗：每回合点被高亮的卡；没有高亮就选推荐的卡（第一张可用）。
for (let turn = 0; turn < 20; turn++) {
  if (await page.locator('text=击败了').count()) break;
  if (await page.locator('text=长眠了').count()) break;
  const coach = page.locator('[data-coach="true"] button:not([disabled])');
  const plain = page.locator('button[aria-label^="攻击"]:not([disabled])');
  try {
    if (await coach.count()) {
      if (turn < 4) await shot(`coach-${turn + 1}`);
      await coach.first().click({ timeout: 3000 });
    } else if (await plain.count()) {
      await plain.first().click({ timeout: 3000 });
    } else {
      await page.waitForTimeout(800);
      continue;
    }
  } catch {
    continue;
  }
  await page.waitForTimeout(turn === 1 ? 700 : 2600);
  if (turn === 1) {
    await shot('battle-perfect');
    await page.waitForTimeout(1800);
  }
}
await page.waitForTimeout(2500);
await shot('result');

if (process.argv.includes('--loss')) {
  await page.click('text=继续下潜');
  await page.waitForTimeout(2600);
  await shot('spring');
  await page.click('text=听一听前面');
  await page.waitForTimeout(5000);
  await shot('map-after-spring');
  await page.click('text=下潜，挑战');
  await page.waitForTimeout(1500);
  await page.click('[class*="versus"]').catch(() => {});
  await page.waitForTimeout(2500);
  await shot('scout-start');
  for (let i = 0; i < 30; i++) {
    if (await page.locator('text=长眠了').count()) break;
    const guard = page.locator('button[aria-label^="守护"]:not([disabled])');
    const any = page.locator('[class*="cards"] button:not([disabled])');
    try {
      if (await guard.count()) await guard.first().click({ timeout: 2000 });
      else if (await any.count()) await any.first().click({ timeout: 2000 });
    } catch {}
    await page.waitForTimeout(2200);
    if (i === 3) await shot('scout-low');
  }
  await page.waitForTimeout(4500);
  await shot('loss');
  await page.click('text=留一张它的造物卡');
  await page.waitForSelector('img[alt$="造物卡"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot('card-fallen');
  const data = await page.evaluate(async () => {
    const img = document.querySelector('img[alt$="造物卡"]') as HTMLImageElement;
    const b = await fetch(img.src).then(r => r.blob());
    return await new Promise<string>(r => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result));
      fr.readAsDataURL(b);
    });
  });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(out, `${which}-card.png`), Buffer.from(data.split(',')[1], 'base64'));
  await page.click('text=关闭');
  await page.waitForTimeout(600);
  await page.click('text=传承给下一代');
  await page.waitForTimeout(2500);
  await shot('heir-workshop');
  await page.click('button[aria-label="打开图鉴"]');
  await page.waitForTimeout(3000);
  await shot('codex');
}
console.log(errors.length ? '⚠ 页面错误：\n' + [...new Set(errors)].slice(0, 10).join('\n') : '无页面错误');
await browser.close();
