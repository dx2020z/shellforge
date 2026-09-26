/**
 * 视觉验收截图：390×844（手机）与 1440×900（桌面），整页截图存到 docs/screens/。
 * 用法：先 npm run build && npm start，再 npm run screens [-- 路径...]
 * 同时检查：横向溢出、系统默认字体回落、占位文字「加载中」。
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.SCREENS_BASE ?? 'http://127.0.0.1:3020';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/design'];
const sizes = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];
const out = join(process.cwd(), 'docs', 'screens');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let problems = 0;
for (const size of sizes) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.deviceScaleFactor, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript('window.__name = (f) => f');
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    const report = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const fontsLoaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family);
      const text = document.body.innerText;
      const offenders = [...document.querySelectorAll('body *')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
        })
        .slice(0, 5)
        .map(el => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`.slice(0, 80));
      return { overflow, fontsLoaded, placeholder: /加载中|Loading|TODO|lorem/i.test(text), offenders };
    });
    const name = `${route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-/, '')}-${size.name}.png`;
    // 固定背景在整页截图里只覆盖首屏；先把视口拉到整页高度再截，结果与真实滚动观感一致。
    const fullHeight = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, ...[...document.body.children].map(el => el.getBoundingClientRect().bottom + window.scrollY))));
    await page.setViewportSize({ width: size.width, height: Math.max(size.height, fullHeight) });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, name) });
    await page.setViewportSize({ width: size.width, height: size.height });
    const issues = [
      report.overflow > 0 ? `横向溢出 ${report.overflow}px ${report.offenders.join(' ')}` : '',
      !report.fontsLoaded.includes('SF Serif') || !report.fontsLoaded.includes('SF Sans') ? `字体未加载：${report.fontsLoaded.join(',')}` : '',
      report.placeholder ? '出现占位或系统腔文字' : '',
    ].filter(Boolean);
    problems += issues.length;
    console.log(`${name} ${issues.length ? '⚠ ' + issues.join('；') : '✓'}`);
  }
  await context.close();
}
await browser.close();
if (problems) process.exitCode = 1;
