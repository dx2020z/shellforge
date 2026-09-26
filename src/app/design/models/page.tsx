'use client';
import { useEffect, useState } from 'react';
import { PREGEN_SETS, genUrl } from '@/domain/pregen-catalog';
import { generatedReady } from '@/domain/model-pool';

/** 预生成模型质检页：每套的三件单独拍一张，再拼起来拍一张（正面 + 侧面）。开发用，/design/models */
type Shot = { id: string; label: string; src: string };

export default function ModelSheet() {
  const [shots, setShots] = useState<Record<string, Shot[]>>({});
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { snapshotCreature } = await import('@/three/snapshot');
      for (const s of PREGEN_SETS) {
        const q = new URLSearchParams(location.search);
        const only = q.get('only')?.split(',');
        if (only && !only.includes(s.id)) continue;
        if (!generatedReady(s.id) && !q.has('all')) continue;
        const urls = (['head', 'body', 'legs'] as const).map(sl => genUrl(s.id, sl));
        const row: Shot[] = [];
        const opt = { width: 220, height: 260, margin: 1.0 };
        for (const [i, sl] of (['首', '躯', '足'] as const).entries()) {
          const only = urls.map((u, j) => (j === i ? u : null));
          try {
            row.push({ id: `${s.id}-${i}`, label: sl, src: await snapshotCreature(only, undefined, { ...opt, yaw: 0.35 }) });
          } catch {
            row.push({ id: `${s.id}-${i}`, label: sl + '（缺）', src: '' });
          }
        }
        for (const [label, yaw] of [['正面', 0.1], ['侧面', 1.2]] as const) {
          try {
            row.push({ id: `${s.id}-${label}`, label, src: await snapshotCreature(urls, undefined, { ...opt, yaw }) });
          } catch {
            row.push({ id: `${s.id}-${label}`, label: label + '（失败）', src: '' });
          }
        }
        if (!alive) return;
        setShots(x => ({ ...x, [s.id]: row }));
      }
      setDone(true);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <main style={{ padding: 16, background: '#0d2621', color: '#f1e8d2', minHeight: '100vh', fontSize: 12 }} data-done={done || undefined}>
      {PREGEN_SETS.filter(s => shots[s.id]).map(s => (
        <section key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <b style={{ width: 90 }}>
            {s.name}
            <br />
            <small>{s.id}</small>
          </b>
          {shots[s.id].map(sh => (
            <figure key={sh.id} style={{ margin: 0, textAlign: 'center' }}>
              {sh.src ? <img src={sh.src} width={150} height={177} alt="" style={{ background: '#15403a', borderRadius: 8 }} /> : <div style={{ width: 150, height: 177 }} />}
              <figcaption>{sh.label}</figcaption>
            </figure>
          ))}
        </section>
      ))}
    </main>
  );
}
