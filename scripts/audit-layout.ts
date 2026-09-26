/**
 * 多尺寸显示巡检：手机竖屏/横屏、笔记本、桌面、2K，含 Windows 常见的 125%/150% 缩放。
 * 检查：横向溢出、文字被裁切、字号过小、触屏上点击区域过小、图片被放大导致模糊。
 * 用法：先 npm start，再 npx tsx scripts/audit-layout.ts [路径...]
 */
import { chromium } from '@playwright/test';

const base = process.env.SCREENS_BASE ?? 'http://127.0.0.1:3020';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/design'];
const viewports = [
  { name: '小屏手机 360×640', width: 360, height: 640, dpr: 3, touch: true },
  { name: '手机 390×844', width: 390, height: 844, dpr: 3, touch: true },
  { name: '手机横屏 844×390', width: 844, height: 390, dpr: 3, touch: true },
  { name: '平板 820×1180', width: 820, height: 1180, dpr: 2, touch: true },
  { name: '笔记本 1280×720 @150%', width: 1280, height: 720, dpr: 1.5, touch: false },
  { name: '桌面 1440×900 @125%', width: 1440, height: 900, dpr: 1.25, touch: false },
  { name: '桌面 1920×1080', width: 1920, height: 1080, dpr: 1, touch: false },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let total = 0;
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch && vp.width < 900 });
  const page = await context.newPage();
  // tsx 会给内联函数加 __name 包装，浏览器里补一个空实现。
  await page.addInitScript('window.__name = (f) => f');
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2500);
    const issues = await page.evaluate(({ touch }) => {
      const out: string[] = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 1) out.push(`横向溢出 ${document.documentElement.scrollWidth - vw}px`);
      const describe = (el: Element) => {
        const text = (el.textContent || '').trim().slice(0, 16);
        return `<${el.tagName.toLowerCase()}>${text}`;
      };
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || (el.parentElement && getComputedStyle(el.parentElement).opacity === '0') || el.closest('[aria-hidden="true"], .sr-only')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (cs.position !== 'fixed' && (r.right > vw + 1 || r.left < -1)) out.push(`超出屏幕 ${describe(el)}`);
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
        if (hasText && parseFloat(cs.fontSize) < 11) out.push(`字号 ${cs.fontSize} 过小 ${describe(el)}`);
        const clips = cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis';
        if (hasText && clips && cs.webkitLineClamp === 'none' && el.scrollWidth > el.clientWidth + 2) out.push(`文字被裁切 ${describe(el)}`);
        if (touch && (el.matches('button, a, [role=button], input, textarea')) && (r.width < 40 || r.height < 36)) out.push(`点击区域过小 ${Math.round(r.width)}×${Math.round(r.height)} ${describe(el)}`);
      }
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (img.naturalWidth && r.width * devicePixelRatio > img.naturalWidth * 1.15) out.push(`图片被放大会模糊 ${img.src.split('/').pop()}`);
      }
      return [...new Set(out)];
    }, { touch: vp.touch });
    total += issues.length;
    console.log(`${vp.name} ${route}: ${issues.length ? '\n  - ' + issues.slice(0, 20).join('\n  - ') : '✓'}`);
  }
  await context.close();
}
await browser.close();
console.log(total ? `共 ${total} 项需要处理` : '全部通过');
if (total) process.exitCode = 1;
