'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { useSnapshot } from '@/ui/useSnapshot';
import { cardData, lineages } from '@/domain/card';
import { guardPool } from '@/domain/duel-guards';
import type { DuelGuardDef } from '@/domain/duel';
import { creatureParts, partTints } from '@/domain/creature';
import type { CreatureRecord, GameSave } from '@/domain/types';
import styles from './Codex.module.css';

/* ---------------- 造物卡 ---------------- */

export interface CreatureCardProps {
  save: GameSave;
  creature: CreatureRecord;
  onClose: () => void;
}

export function CreatureCard({ save, creature, onClose }: CreatureCardProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const saveRef = useRef(save);
  const fileName = `ShellForge-${String(creature.specimen).padStart(4, '0')}-${creature.name}.png`;

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const [{ snapshotCreature, loadImage }, { drawCard, canvasToBlob }] = await Promise.all([import('@/three/snapshot'), import('@/ui/card-render')]);
        const parts = creatureParts(saveRef.current, creature);
        const hero = await snapshotCreature(
          parts.map(p => p.model.url),
          parts.map(p => p.model.rotation),
          { width: 900, height: 900, margin: 1.0, yaw: 0.1, tints: partTints(parts) },
        );
        const img = await loadImage(hero);
        const canvas = document.createElement('canvas');
        await drawCard(canvas, cardData(saveRef.current, creature), img, `写一句话，造一只你自己的造物 · ${location.host}`);
        const b = await canvasToBlob(canvas);
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
        try {
          const file = new File([b], fileName, { type: 'image/png' });
          setCanShare(Boolean(navigator.canShare?.({ files: [file] })));
        } catch {
          setCanShare(false);
        }
      } catch {
        if (alive) setError('标本照冲洗失败了，稍后再试一次。');
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [creature, fileName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = async () => {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: 'image/png' })], title: creature.name, text: `「${creature.origin}」` });
    } catch {
      /* 用户取消分享。 */
    }
  };

  return (
    <motion.div className={styles.modal} role="dialog" aria-modal aria-label={`${creature.name}的造物卡`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className={styles.cardStage} onClick={e => e.stopPropagation()}>
        <AnimatePresence mode="wait">
          {url ? (
            <motion.img
              key="card"
              src={url}
              alt={`${creature.name}的造物卡`}
              className={styles.cardImg}
              initial={{ opacity: 0, rotateY: -70, scale: 0.9 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            />
          ) : (
            <motion.div key="wait" className={styles.cardWait} exit={{ opacity: 0 }}>
              <span className={styles.developing} />
              <p>{error ?? '正在冲洗标本照……'}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className={styles.cardActions}>
          {url && (
            <a className={styles.linkButton} href={url} download={fileName}>
              <Icon name="download" size={18} />
              保存图片
            </a>
          )}
          {url && canShare && (
            <Button variant="secondary" onClick={share}>
              <Icon name="share" size={18} />
              分享
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
        {url && <p className={styles.tip}>手机上也可以长按图片保存</p>}
      </div>
    </motion.div>
  );
}

/* ---------------- 图鉴 ---------------- */

function Specimen({ save, creature, onOpen }: { save: GameSave; creature: CreatureRecord; onOpen: () => void }) {
  const parts = creatureParts(save, creature);
  const src = useSnapshot(
    parts.map(p => p.model.url),
    parts.map(p => p.model.rotation),
    { width: 240, height: 300, margin: 1.0, yaw: 0.1, tints: partTints(parts) },
  );
  const fallen = creature.status === 'fallen';
  return (
    <button type="button" className={styles.specimen} data-fallen={fallen || undefined} onClick={onOpen}>
      <span className={styles.jar}>{src ? <img src={src} alt="" draggable={false} /> : <span className={styles.developing} />}</span>
      <small>
        No.{String(creature.specimen).padStart(4, '0')} · {creature.generation <= 1 ? '初代' : `第 ${creature.generation} 代`}
      </small>
      <b>{creature.name}</b>
      <span className={styles.meta}>{fallen ? '已长眠' : creature.wins ? `击败守卫 ${creature.wins} 次` : '初次远征'}</span>
    </button>
  );
}

function GuardEntry({ g, beaten, solved }: { g: DuelGuardDef; beaten: number; solved: number }) {
  const src = useSnapshot(g.models, g.rotations, { width: 240, height: 300, margin: 1.0, yaw: -0.3, silhouette: g.kind === 'preset' && beaten === 0 && solved === 0 });
  return (
    <div className={styles.specimen} data-fallen={g.kind === 'ghost' || undefined} data-guard="">
      <span className={styles.jar}>{src ? <img src={src} alt="" draggable={false} /> : <span className={styles.developing} />}</span>
      <small>{g.kind === 'ghost' ? '亡者守卫' : g.title}</small>
      <b>{g.name}</b>
      <span className={styles.meta}>
        {beaten ? `被击败 ${beaten} 次` : '还没被击败'} · 谜语 {solved}/3
      </span>
    </div>
  );
}

export interface CodexProps {
  save: GameSave;
  onClose: () => void;
}

export function Codex({ save, onClose }: CodexProps) {
  const [open, setOpen] = useState<CreatureRecord | null>(null);
  const groups = lineages(save);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !open && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose, open]);
  return (
    <motion.div className={styles.codex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }}>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>图鉴 · 你写下的每一只</span>
          <h1>标本馆</h1>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="关闭图鉴">
          <Icon name="close" size={22} />
        </button>
      </header>
      <div className={styles.scroll}>
        {groups.length === 0 && <p className={styles.empty}>这里还是空的。写一句话，造出第一只吧。</p>}
        <section className={styles.lineage}>
          <h2>
            <span>守卫库</span>
            <small>长眠的造物会变成海沟里的亡者守卫</small>
          </h2>
          <div className={styles.row}>
            {guardPool(save).map(g => (
              <div key={g.id} className={styles.cell}>
                <GuardEntry g={g} beaten={save.guardDefeats[g.id] ?? 0} solved={(save.riddles[g.id] ?? []).length} />
              </div>
            ))}
          </div>
        </section>
        {groups.map(g => {
          const first = g.creatures[0];
          return (
            <section key={g.id} className={styles.lineage}>
              <h2>
                <span>「{first.name}」的血脉</span>
                <small>{g.creatures.length} 代</small>
              </h2>
              <div className={styles.row}>
                {g.creatures.map((c, i) => (
                  <div key={c.id} className={styles.cell}>
                    {i > 0 && <span className={styles.link} aria-hidden />}
                    <Specimen save={save} creature={c} onOpen={() => setOpen(c)} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <AnimatePresence>{open && <CreatureCard save={save} creature={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </motion.div>
  );
}
