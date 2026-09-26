'use client';
import type { CSSProperties } from 'react';
import { isCost, keywordColor, type Cost, type Keyword, type Reason } from '@/domain/keywords';
import styles from './Keyword.module.css';

export interface KeywordChipProps {
  keyword: Keyword | Cost;
  size?: 'sm' | 'md';
  active?: boolean;
  onHover?: (keyword: Keyword | Cost | null) => void;
  title?: string;
}

export function KeywordChip({ keyword, size = 'md', active, onHover, title }: KeywordChipProps) {
  const cost = isCost(keyword);
  return (
    <span
      className={[styles.chip, cost && styles.cost, size === 'sm' && styles.sm].filter(Boolean).join(' ')}
      style={{ '--c': keywordColor(keyword) } as CSSProperties}
      data-active={active || undefined}
      title={title}
      onPointerEnter={onHover ? () => onHover(keyword) : undefined}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
    >
      <i className={styles.dot} aria-hidden />
      {keyword}
      {cost && <span className="sr-only">（代价）</span>}
    </span>
  );
}

interface Segment {
  text: string;
  reason?: Reason;
}

/** 把原话切成普通文本与被引用的片段。引用互不重叠，先出现、更长的优先。 */
export function segmentOrigin(origin: string, reasons: readonly Reason[]): Segment[] {
  const hits: { start: number; end: number; reason: Reason }[] = [];
  const sorted = [...reasons].sort((a, b) => b.quote.length - a.quote.length);
  for (const reason of sorted) {
    let from = 0;
    while (from <= origin.length) {
      const start = origin.indexOf(reason.quote, from);
      if (start < 0) break;
      const end = start + reason.quote.length;
      if (!hits.some(h => start < h.end && end > h.start)) {
        hits.push({ start, end, reason });
        break;
      }
      from = start + 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) out.push({ text: origin.slice(cursor, hit.start) });
    out.push({ text: origin.slice(hit.start, hit.end), reason: hit.reason });
    cursor = hit.end;
  }
  if (cursor < origin.length) out.push({ text: origin.slice(cursor) });
  return out;
}

export interface OriginQuoteProps {
  origin: string;
  reasons: readonly Reason[];
  /** 当前悬停的关键词，对应片段加深。 */
  active?: Keyword | Cost | null;
  /** 已被替换的部件引用过的片段，变暗划线。 */
  dimmedQuotes?: readonly string[];
  brackets?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 在任何地方展示玩家原话时，被引用的词都保持关键词颜色。 */
export function OriginQuote({ origin, reasons, active, dimmedQuotes = [], brackets = true, className, style }: OriginQuoteProps) {
  return (
    <span className={[styles.origin, className].filter(Boolean).join(' ')} style={style}>
      {brackets && <span className={styles.bracket}>「</span>}
      {segmentOrigin(origin, reasons).map((segment, i) =>
        segment.reason ? (
          <mark
            key={i}
            className={styles.mark}
            style={{ '--c': keywordColor(segment.reason.keyword) } as CSSProperties}
            data-keyword={segment.reason.keyword}
            data-active={active === segment.reason.keyword || undefined}
            data-dimmed={dimmedQuotes.includes(segment.text) || undefined}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
      {brackets && <span className={styles.bracket}>」</span>}
    </span>
  );
}

/** 造物卡与图鉴里的理由句式：因为你写了「{原话片段}」，{理由}。 */
export function ReasonLine({ reason }: { reason: Reason }) {
  return (
    <span>
      因为你写了
      <b style={{ color: keywordColor(reason.keyword), fontWeight: 700 }}>「{reason.quote}」</b>，{reason.why}
    </span>
  );
}
