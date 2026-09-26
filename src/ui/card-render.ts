'use client';
import type { CardData } from '@/domain/card';

/**
 * 在 Canvas 2D 上画一张 1080×1920 的造物卡（手机壁纸 / 朋友圈竖图比例）。
 */

export const CARD_W = 1080;
export const CARD_H = 1920;

const C = {
  cream: '#f1e8d2',
  dim: 'rgba(241,232,210,0.72)',
  muted: '#8faaa0',
  gold: '#d4ae63',
  mint: '#9ff0d8',
  danger: '#e0604e',
};
const NO_LINE_START = '，。、！？；：」）』…,.!?;:';
const SERIF = "'SF Serif', 'Noto Serif SC', 'Songti SC', 'STSong', serif";
const SANS = "'SF Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)), (s >>> 0) / 4294967296);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'right' | 'center' = 'left') {
  const chars = [...text];
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
}

/** 按宽度折行（中文逐字），超出行数时最后一行以省略号结束。 */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    // 避头标点：句号、逗号等不放在行首，宁可稍微超出一点。
    if (ctx.measureText(line + ch).width > width && line && !NO_LINE_START.includes(ch)) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else line += ch;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const consumed = lines.join('').length;
  if (consumed < [...text].length) {
    let last = lines[maxLines - 1] ?? '';
    while (last && ctx.measureText(last + '……').width > width) last = [...last].slice(0, -1).join('');
    lines[maxLines - 1] = last + '……';
  }
  return lines;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, maxWidth: number): number {
  let s = size;
  ctx.font = font(s);
  while (s > 28 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = font(s);
  }
  return s;
}

function background(ctx: CanvasRenderingContext2D, seed: number, fallen: boolean) {
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, fallen ? '#1a2623' : '#153d35');
  g.addColorStop(0.45, fallen ? '#0c1513' : '#0a1f1a');
  g.addColorStop(1, '#030807');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 顶部的光柱
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rand = rng(seed);
  for (let i = 0; i < 4; i++) {
    const x = 160 + rand() * 760;
    const w = 60 + rand() * 120;
    const ray = ctx.createLinearGradient(0, 0, 0, 1100);
    ray.addColorStop(0, `rgba(159,240,216,${fallen ? 0.04 : 0.09})`);
    ray.addColorStop(1, 'rgba(159,240,216,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, 0);
    ctx.lineTo(x + w * 0.3, 0);
    ctx.lineTo(x + w * 1.4 - 200, 1100);
    ctx.lineTo(x - w * 1.4 - 200, 1100);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 标本背后的光晕
  const halo = ctx.createRadialGradient(540, 600, 40, 540, 600, 520);
  halo.addColorStop(0, fallen ? 'rgba(200,210,205,0.16)' : 'rgba(159,240,216,0.28)');
  halo.addColorStop(1, 'rgba(159,240,216,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, CARD_W, 1200);

  // 气泡
  for (let i = 0; i < 26; i++) {
    const x = 70 + rand() * 940;
    const y = 90 + rand() * 1700;
    const r = 3 + rand() * 11;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(159,240,216,${0.12 + rand() * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function frame(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = 'rgba(212,174,99,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, 44, 44, CARD_W - 88, CARD_H - 88, 36);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(212,174,99,0.18)';
  roundRect(ctx, 58, 58, CARD_W - 116, CARD_H - 116, 28);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  for (const [x, y] of [
    [44, 960],
    [CARD_W - 44, 960],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
  ctx.restore();
}

function chip(ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, outlined: boolean): number {
  ctx.font = `600 26px ${SANS}`;
  const w = ctx.measureText(text).width + 36;
  roundRect(ctx, x, y - 22, w, 44, 22);
  if (outlined) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
  } else {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#0b1c17';
  }
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 18, y + 1);
  ctx.textBaseline = 'alphabetic';
  return w;
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.16);
  ctx.strokeStyle = C.danger;
  ctx.fillStyle = 'rgba(224,96,78,0.1)';
  ctx.lineWidth = 5;
  roundRect(ctx, -150, -58, 300, 116, 14);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  roundRect(ctx, -136, -44, 272, 88, 8);
  ctx.stroke();
  ctx.fillStyle = C.danger;
  ctx.font = `900 64px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  spaced(ctx, '已长眠', 0, 4, 14, 'center');
  ctx.restore();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

export async function ensureCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([document.fonts.load(`900 64px 'SF Serif'`), document.fonts.load(`600 26px 'SF Sans'`), document.fonts.load(`400 26px 'SF Sans'`)]).catch(() => {});
}

export async function drawCard(canvas: HTMLCanvasElement, data: CardData, hero: CanvasImageSource | null, footer = '写一句话，造一只你自己的造物'): Promise<void> {
  await ensureCardFonts();
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  background(ctx, hashString(data.specimen + data.name), data.fallen);
  frame(ctx);

  // 页眉
  ctx.fillStyle = C.gold;
  ctx.font = `600 24px ${SANS}`;
  spaced(ctx, 'SHELLFORGE · 造物之海', 96, 128, 6);
  ctx.fillStyle = C.cream;
  ctx.font = `700 40px ${SERIF}`;
  ctx.textAlign = 'right';
  ctx.fillText(data.specimen, CARD_W - 96, 130);
  ctx.fillStyle = C.muted;
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText(data.date, CARD_W - 96, 168);
  ctx.textAlign = 'left';

  // 标本：底座光圈 + 透明底渲染图
  const base = ctx.createRadialGradient(540, 968, 10, 540, 968, 300);
  base.addColorStop(0, data.fallen ? 'rgba(200,210,205,0.25)' : 'rgba(159,240,216,0.45)');
  base.addColorStop(1, 'rgba(159,240,216,0)');
  ctx.save();
  ctx.translate(540, 968);
  ctx.scale(1, 0.22);
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(0, 0, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = data.fallen ? 'rgba(200,210,205,0.3)' : 'rgba(159,240,216,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(540, 968, 250, 50, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (hero) {
    const w = 'width' in hero ? Number(hero.width) : 900;
    const h = 'height' in hero ? Number(hero.height) : 900;
    const boxW = 860;
    const boxH = 800;
    const s = Math.min(boxW / w, boxH / h);
    const dw = w * s;
    const dh = h * s;
    ctx.save();
    if (data.fallen) ctx.filter = 'grayscale(0.75) brightness(0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.drawImage(hero, 540 - dw / 2, 990 - dh, dw, dh);
    ctx.restore();
  }
  if (data.fallen) stamp(ctx, 820, 900);

  // 名字与代数
  ctx.textAlign = 'center';
  ctx.fillStyle = C.cream;
  const nameSize = fitFont(ctx, data.name, s => `900 ${s}px ${SERIF}`, data.nameSize, 900);
  ctx.shadowColor = 'rgba(212,174,99,0.35)';
  ctx.shadowBlur = 24;
  ctx.fillText(data.name, 540, 1060 + nameSize * 0.8);
  ctx.shadowBlur = 0;
  let y = 1060 + nameSize + 52;
  ctx.fillStyle = C.gold;
  ctx.font = `600 28px ${SANS}`;
  spaced(ctx, data.generation + (data.lineage ? ` · ${data.lineage}` : ''), 540, y, 4, 'center');
  y += 64;

  // 原话
  ctx.font = `500 22px ${SANS}`;
  ctx.fillStyle = C.muted;
  spaced(ctx, '它诞生于这句话', 540, y, 8, 'center');
  y += 58;
  ctx.font = `700 42px ${SERIF}`;
  const chars: { ch: string; color: string | null }[] = [{ ch: '「', color: null }];
  for (const seg of data.highlights) for (const ch of seg.text) chars.push({ ch, color: seg.color });
  chars.push({ ch: '」', color: null });
  const lines: (typeof chars)[] = [[]];
  let lw = 0;
  for (const c of chars) {
    const w = ctx.measureText(c.ch).width;
    if (lw + w > 880 && lines[lines.length - 1].length && !NO_LINE_START.includes(c.ch)) {
      lines.push([]);
      lw = 0;
    }
    lines[lines.length - 1].push(c);
    lw += w;
  }
  for (const line of lines.slice(0, 3)) {
    const total = line.reduce((a, c) => a + ctx.measureText(c.ch).width, 0);
    let x = 540 - total / 2;
    ctx.textAlign = 'left';
    for (const c of line) {
      const w = ctx.measureText(c.ch).width;
      ctx.fillStyle = c.color ?? C.cream;
      ctx.fillText(c.ch, x, y);
      if (c.color) {
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y + 10, w + 0.5, 3);
        ctx.globalAlpha = 1;
      }
      x += w;
    }
    y += 58;
  }
  ctx.textAlign = 'center';

  // 描述或墓志铭（最多两行）
  y += 6;
  if (data.epitaph) {
    ctx.font = `600 32px ${SERIF}`;
    ctx.fillStyle = C.cream;
    for (const l of wrap(ctx, data.epitaph, 860, 2)) {
      ctx.fillText(l, 540, y);
      y += 46;
    }
  } else {
    ctx.font = `400 28px ${SANS}`;
    ctx.fillStyle = C.dim;
    for (const l of wrap(ctx, data.lore, 860, 2)) {
      ctx.fillText(l, 540, y);
      y += 42;
    }
  }

  // 三件部件
  y = Math.max(y + 24, 1530);
  ctx.strokeStyle = 'rgba(212,174,99,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(110, y - 44);
  ctx.lineTo(CARD_W - 110, y - 44);
  ctx.stroke();
  const rowH = Math.min(92, (1790 - y) / 3);
  for (const p of data.parts) {
    ctx.textAlign = 'left';
    // 槽位菱形
    ctx.save();
    ctx.translate(126, y - 12);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -18, 36, 36);
    ctx.restore();
    ctx.fillStyle = C.gold;
    ctx.font = `700 24px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.glyph, 126, y - 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.cream;
    ctx.font = `800 34px ${SERIF}`;
    const name = p.name + (p.level ? ' ' + '◆'.repeat(p.level) : '');
    ctx.fillText(name, 170, y);
    let cx = 170 + ctx.measureText(name).width + 20;
    for (const k of p.keywords) cx += chip(ctx, k.text, k.color, cx, y - 11, false) + 10;
    if (p.cost) chip(ctx, p.cost.text, p.cost.color, cx, y - 11, true);
    ctx.font = `400 24px ${SANS}`;
    ctx.fillStyle = C.dim;
    const [reason] = wrap(ctx, p.reason, 800, 1);
    ctx.fillText(reason, 170, y + 38);
    y += rowH;
  }

  // 战绩与页脚
  ctx.textAlign = 'center';
  ctx.fillStyle = data.fallen ? C.muted : C.mint;
  ctx.font = `600 28px ${SANS}`;
  spaced(ctx, data.record, 540, 1806, 4, 'center');
  ctx.fillStyle = 'rgba(143,170,160,0.7)';
  ctx.font = `400 22px ${SANS}`;
  spaced(ctx, footer, 540, 1850, 4, 'center');
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('生成图片失败'))), 'image/png'));
}
