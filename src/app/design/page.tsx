'use client';
import { useState, type CSSProperties } from 'react';
import { DeepSea } from '@/ui/DeepSea';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Icon, type IconName } from '@/ui/Icon';
import { KeywordChip, OriginQuote, ReasonLine } from '@/ui/Keyword';
import { PearlMeter, ShellHealth, TideGauge } from '@/ui/Meters';
import { ActionCard, GuardPartTag, IntentBubble, type ActionKind, type IntentKind } from '@/ui/Battle';
import { OriginField } from '@/ui/OriginField';
import { Narration, SceneTransition } from '@/ui/Transition';
import { COSTS, KEYWORDS, KEYWORD_BLURBS, SLOT_NAMES, SLOTS, judgeInput, type Reason, type Slot } from '@/domain/keywords';
import { INSPIRATIONS, randomInspiration } from '@/domain/inspirations';
import styles from './design.module.css';

const BASE_COLORS = [
  { name: 'abyss', value: '#07130F', use: '最深背景' },
  { name: 'deep', value: '#0D2621', use: '面板背景' },
  { name: 'tide', value: '#15403A', use: '次级背景' },
  { name: 'mint', value: '#9FF0D8', use: '主强调、生命、关节光' },
  { name: 'gold', value: '#D4AE63', use: '标题点缀、边框、品牌' },
  { name: 'cream', value: '#F1E8D2', use: '主文字' },
  { name: 'muted', value: '#8FAAA0', use: '次要文字' },
  { name: 'lava', value: '#EE9A45', use: '代价、危险、火系' },
];

const SAMPLE_ORIGIN = '一只毛茸茸、很乖、从不还嘴的健身牛';
const SAMPLE_PARTS: { slot: Slot; name: string; reason: Reason }[] = [
  { slot: 'head', name: '绒默首', reason: { keyword: '震慑', quote: '很乖、从不还嘴', why: '低头的样子反而能震住对手' } },
  { slot: 'body', name: '牛来之躯', reason: { keyword: '蓄能', quote: '健身', why: '紧绷的肌肉把每次忍耐都攒成下一拳' } },
  { slot: 'legs', name: '绒默足', reason: { keyword: '潜行', quote: '毛茸茸', why: '软软的短腿落地无声' } },
];
const BOAST_ORIGIN = '无敌的神明螃蟹，会喷火';
const BOAST_REASONS: Reason[] = [
  { keyword: '灼烧', quote: '会喷火', why: '它一开口就带着火星' },
  { keyword: '骄傲', quote: '无敌', why: '神明嫌同一招不够有排面，偏不连用' },
];

const INTENTS: { kind: IntentKind; line: string; damage?: number }[] = [
  { kind: 'strike', line: '铜钳抬起，直直地砸下来。', damage: 8 },
  { kind: 'sweep', line: '铜尾扫过整片擂台，躲不开。', damage: 12 },
  { kind: 'break', line: '它在找你甲壳的缝。守护会被击穿。', damage: 14 },
  { kind: 'charge', line: '它在积攒力气。下一击会很重。' },
  { kind: 'fortify', line: '它缩进壳里。这回合打它只剩一半。' },
  { kind: 'heal', line: '潮水在它的裂缝里慢慢合拢。' },
];

const ACTIONS: { kind: ActionKind; title: string; taken: number; dealt: number; note: string; perfect?: boolean }[] = [
  { kind: 'attack', title: '攻击', taken: 12, dealt: 7, note: '目标：躯 · 震慑' },
  { kind: 'guard', title: '守护', taken: 0, dealt: 6, note: '挡下全部，反击 50%', perfect: true },
  { kind: 'move', title: '机动', taken: 12, dealt: 0, note: '横扫无法闪开' },
];

const ICONS: IconName[] = ['attack', 'guard', 'move', 'burst', 'intent-strike', 'intent-sweep', 'intent-break', 'intent-charge', 'intent-fortify', 'intent-heal', 'shell', 'pearl', 'retreat', 'spring', 'scout', 'forge', 'dice', 'sound', 'mute', 'close', 'arrow'];

const MOTION_TOKENS = [
  ['UI 过渡', '150–300ms · 弹簧曲线'],
  ['场景转场', '600–1000ms · 潮水漫过'],
  ['锻造仪式', '600–1200ms'],
  ['命中停顿', '60–90ms'],
  ['完美应对', '0.3s 慢动作 + 字样'],
  ['减少动态效果', '关闭震屏与慢动作，转场改为 200ms 淡入'],
];

const SCENES = [
  { key: 'workshop', eyebrow: '场景一', title: '工坊', text: '海底很安静。写下一句话，它就会醒来。' },
  { key: 'map', eyebrow: '场景三', title: '远征地图', text: '海沟向下延伸，六位守卫在黑暗里等你。' },
  { key: 'battle', eyebrow: '场景四', title: '擂台', text: '潮位涨了一格。它抬起了铜尾。' },
];

function Section({ id, no, title, note, children }: { id: string; no: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <header className={styles.sectionHead}>
        <span className={styles.sectionNo}>{no}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {note && <p className={styles.sectionNote}>{note}</p>}
      </header>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const [origin, setOrigin] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [activeKeyword, setActiveKeyword] = useState<Reason['keyword'] | null>(null);
  const [pearls, setPearls] = useState(2);
  const [tide, setTide] = useState(3);
  const [hover, setHover] = useState<ActionKind | null>(null);
  const [target, setTarget] = useState<'首' | '躯' | '足'>('躯');
  const [scene, setScene] = useState(0);
  const [busy, setBusy] = useState(false);

  const preview = hover ? ACTIONS.find(a => a.kind === hover)?.taken ?? 0 : 0;

  const submit = () => {
    const verdict = judgeInput(origin);
    if (!verdict.ok) {
      setReply(verdict.reply);
      return;
    }
    setReply(null);
    setBusy(true);
    setTimeout(() => setBusy(false), 1600);
  };

  return (
    <>
      <DeepSea />
      <main className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.brandRow}>
            <b>SHELLFORGE 造物之海</b>
            <span>设计系统 v2</span>
          </div>
          <h1 className={styles.heroTitle}>锻造台</h1>
          <p className={styles.heroLead}>全游戏共用的色彩、字体、按钮、面板和动效基础组件。每个场景都从这里取材料，保证截图细看也经得起推敲。</p>
          <nav className={styles.toc} aria-label="目录">
            {[
              ['color', '色彩'],
              ['type', '字体'],
              ['controls', '按钮与面板'],
              ['workshop', '工坊输入'],
              ['origin', '原句高亮'],
              ['battle', '战斗界面'],
              ['motion', '动效'],
              ['icons', '图标'],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </header>

        <Section id="color" no="01" title="色彩" note="深海体系 · 关键词颜色全游戏固定">
          <div className={styles.stack}>
            <div className={styles.swatches}>
              {BASE_COLORS.map(c => (
                <div key={c.name} className={styles.swatch}>
                  <div className={styles.swatchColor} style={{ background: c.value }} />
                  <div className={styles.swatchMeta}>
                    <b>{c.name}</b>
                    <code>{c.value}</code>
                    <span>{c.use}</span>
                  </div>
                </div>
              ))}
            </div>
            <Panel title="关键词" eyebrow="头＝暖色 · 躯＝薄荷 · 足＝淡紫 · 代价＝橙色描边">
              <div className={styles.keywordFamilies}>
                {SLOTS.map(slot => (
                  <div key={slot} className={styles.family}>
                    <span className={styles.familyGlyph}>
                      <span>{SLOT_NAMES[slot]}</span>
                    </span>
                    <div className={styles.chips}>
                      {KEYWORDS[slot].map(k => (
                        <KeywordChip key={k} keyword={k} title={KEYWORD_BLURBS[k]} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className={styles.family}>
                  <span className={styles.familyGlyph} style={{ borderColor: 'var(--lava)' }}>
                    <span style={{ color: 'var(--lava)' }}>价</span>
                  </span>
                  <div className={styles.chips}>
                    {COSTS.map(c => (
                      <KeywordChip key={c} keyword={c} />
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </Section>

        <Section id="type" no="02" title="字体" note="Noto Serif SC / Noto Sans SC · 自托管子集 2.3 MB">
          <Panel>
            <div className={styles.typeSpecimen}>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>标题 · 衬线 900</span>
                <span className={styles.t900}>这是绒默牛来唯一的一条命</span>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>小标题 · 衬线 700</span>
                <span className={styles.t700}>潮汐泉 · 三选一</span>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>正文 · 无衬线 400</span>
                <span className={styles.body}>它背着钟楼走过四片海域，最后一声钟响留给了铜甲斥候。守卫的意图写在它头顶，读懂它，就能反击。</span>
              </div>
              <div className={styles.typeRow}>
                <span className={styles.typeLabel}>数字 · 等宽</span>
                <span className={`${styles.numbers} num`}>
                  <span>11</span>
                  <span>40</span>
                  <span>No.0003</span>
                </span>
              </div>
            </div>
          </Panel>
        </Section>

        <Section id="controls" no="03" title="按钮与面板" note="按下时弹簧回弹 · 忙碌时潮水绕边">
          <div className={styles.grid2}>
            <Panel title="按钮">
              <div className={styles.stack}>
                <div className={styles.row}>
                  <Button variant="primary">带它出发</Button>
                  <Button>侦察下一位</Button>
                  <Button variant="ghost">稍后再说</Button>
                  <Button variant="danger">
                    <Icon name="retreat" size={18} />
                    带着战利品撤退
                  </Button>
                </div>
                <div className={styles.row}>
                  <Button variant="primary" size="lg">
                    开始锻造
                  </Button>
                  <Button size="sm">小按钮</Button>
                  <Button variant="primary" busy>
                    锻造中
                  </Button>
                  <Button disabled>已用尽</Button>
                </div>
                <div className={styles.row}>
                  <Button iconOnly aria-label="静音">
                    <Icon name="sound" />
                  </Button>
                  <Button iconOnly variant="ghost" aria-label="随机灵感">
                    <Icon name="dice" />
                  </Button>
                  <Button iconOnly size="sm" aria-label="关闭">
                    <Icon name="close" size={16} />
                  </Button>
                </div>
              </div>
            </Panel>
            <div className={styles.stack}>
              <Panel title="普通面板" eyebrow="PANEL">
                <p className={styles.body}>半透明的深海玻璃，背后的光束会透过来。用于潮汐泉的选项、结算信息。</p>
              </Panel>
              <Panel framed title="金线框" eyebrow="标本 No.0003">
                <p className={styles.body}>与造物卡同一套语言：细金线加两个对角的角标。用于图鉴标本、一命提示卡。</p>
              </Panel>
            </div>
          </div>
        </Section>

        <Section id="workshop" no="04" title="工坊输入" note="占位文字每 3 秒轮换 · 空输入和乱码有幽默回应">
          <div className={styles.workshop}>
            <span className="label">第一步</span>
            <h3 className={styles.workshopTitle}>写下你的造物</h3>
            <OriginField
              value={origin}
              onChange={value => {
                setOrigin(value);
                setReply(null);
              }}
              onSubmit={submit}
              onDice={() => setOrigin(randomInspiration(origin))}
              examples={INSPIRATIONS.slice(0, 8)}
              reply={reply}
              busy={busy}
            />
            <div className={styles.riddle}>
              <small>守卫的谜语 · 铜甲斥候</small>
              <p>铜甲留不住滚烫的潮水。</p>
            </div>
            <p className={styles.caption}>试试直接按锻造，或者输入 asdfgh</p>
          </div>
        </Section>

        <Section id="origin" no="05" title="原句高亮" note="被引用的词保持关键词颜色 · 悬停标签联动">
          <div className={styles.grid2}>
            <Panel framed>
              <div className={styles.originBlock}>
                <span className="label">它诞生于这句话</span>
                <OriginQuote className={styles.bigQuote} origin={SAMPLE_ORIGIN} reasons={SAMPLE_PARTS.map(p => p.reason)} active={activeKeyword} />
                <div className={styles.partList}>
                  {SAMPLE_PARTS.map(part => (
                    <div key={part.slot} className={styles.partItem}>
                      <span className={styles.familyGlyph}>
                        <span>{SLOT_NAMES[part.slot]}</span>
                      </span>
                      <div>
                        <b className={styles.partName}>{part.name}</b>
                        <p>
                          <ReasonLine reason={part.reason} />
                        </p>
                      </div>
                      <KeywordChip keyword={part.reason.keyword} active={activeKeyword === part.reason.keyword} onHover={setActiveKeyword} />
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <div className={styles.stack}>
              <Panel title="夸张描述带着代价" eyebrow="彩蛋">
                <div className={styles.stack}>
                  <OriginQuote className={styles.bigQuote} origin={BOAST_ORIGIN} reasons={BOAST_REASONS} />
                  <div className={styles.chips}>
                    <KeywordChip keyword="灼烧" />
                    <KeywordChip keyword="骄傲" />
                  </div>
                  <p className={styles.body}>
                    <ReasonLine reason={BOAST_REASONS[1]} />。
                  </p>
                </div>
              </Panel>
              <Panel title="替换部件后，原句对应的词变暗" eyebrow="缴获">
                <OriginQuote className={styles.bigQuote} origin={SAMPLE_ORIGIN} reasons={SAMPLE_PARTS.map(p => p.reason)} dimmedQuotes={['毛茸茸']} />
              </Panel>
            </div>
          </div>
        </Section>

        <Section id="battle" no="06" title="战斗界面" note="悬停行动卡，上方生命值预览会受到的伤害">
          <div className={styles.hud}>
            <div className={styles.hudTop}>
              <div className={styles.fighter}>
                <span className={styles.fighterName}>
                  <small>你的造物</small>绒默牛来
                </span>
                <ShellHealth hp={28} max={40} preview={preview} label="绒默牛来的生命" />
                <PearlMeter value={pearls} />
              </div>
              <div className={styles.fighter}>
                <span className={styles.fighterName}>
                  <small>遗迹守卫</small>铜甲斥候
                </span>
                <ShellHealth hp={31} max={45} side="enemy" label="铜甲斥候的生命" />
              </div>
            </div>

            <div className={styles.arena}>
              <div className={styles.arenaCenter}>
                <IntentBubble kind="sweep" line="铜尾扫过整片擂台，躲不开。" damage={12} />
                <div style={{ height: 40 }} />
                <div className={styles.guardTags}>
                  <GuardPartTag glyph="首" name="铜盔" hp={9} max={15} targeted={target === '首'} onSelect={() => setTarget('首')} />
                  <GuardPartTag glyph="躯" name="甲胸" hp={16} max={20} targeted={target === '躯'} onSelect={() => setTarget('躯')} />
                  <GuardPartTag glyph="足" name="钳足" hp={0} max={10} targeted={target === '足'} onSelect={() => setTarget('足')} />
                </div>
              </div>
              <div className={styles.tideCol}>
                <TideGauge level={tide} max={6} height={200} />
                <span>潮位</span>
              </div>
            </div>

            <div className={styles.row}>
              <Button size="sm" onClick={() => setPearls(p => (p + 1) % 4)}>
                潮能 +1
              </Button>
              <Button size="sm" onClick={() => setTide(t => (t + 1) % 7)}>
                潮位 +1
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 } as CSSProperties} onPointerLeave={() => setHover(null)}>
              {ACTIONS.map((action, i) => (
                <div key={action.kind} onPointerEnter={() => setHover(action.kind)} onFocus={() => setHover(action.kind)}>
                  <ActionCard {...action} hotkey={i + 1} note={action.kind === 'attack' ? `目标：${target} · 震慑` : action.note} />
                </div>
              ))}
            </div>
            {pearls >= 3 && <ActionCard kind="burst" title="「很乖、从不还嘴」爆发" taken={0} dealt={24} note="触发 震慑 · 蓄能 · 潜行" hotkey={4} />}

            <Panel title="六种意图" eyebrow="图标 + 一句话">
              <div className={styles.intents}>
                {INTENTS.map(intent => (
                  <div key={intent.kind}>
                    <IntentBubble {...intent} />
                  </div>
                ))}
              </div>
            </Panel>

            <div className={styles.grid2}>
              <Panel title="生命低于 30%" eyebrow="心跳 · 泛红">
                <ShellHealth hp={8} max={40} />
              </Panel>
              <Panel title="潮位涨满" eyebrow="守卫狂暴">
                <div className={styles.row}>
                  <TideGauge level={6} max={6} height={120} />
                  <p className={styles.body}>水位直接画在场景里，玩家不用读数字也能感到压力。</p>
                </div>
              </Panel>
            </div>
          </div>
        </Section>

        <Section id="motion" no="07" title="动效" note="系统开启「减少动态效果」时自动降级">
          <div className={styles.grid2}>
            <div className={styles.motionStage}>
              <SceneTransition sceneKey={SCENES[scene].key}>
                <div className={styles.sceneCard}>
                  <span className="label">{SCENES[scene].eyebrow}</span>
                  <h4>{SCENES[scene].title}</h4>
                  <p>
                    <Narration text={SCENES[scene].text} delay={0.5} />
                  </p>
                </div>
              </SceneTransition>
              <div style={{ position: 'absolute', right: 16, bottom: 16 }}>
                <Button size="sm" onClick={() => setScene(s => (s + 1) % SCENES.length)}>
                  下一场景
                  <Icon name="arrow" size={16} />
                </Button>
              </div>
            </div>
            <Panel title="时长规范">
              <table className={styles.tokens}>
                <tbody>
                  {MOTION_TOKENS.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </Section>

        <Section id="icons" no="08" title="图标" note="24 格 · 1.6 描边 · 全部内联">
          <div className={styles.icons}>
            {ICONS.map(name => (
              <div key={name} className={styles.iconCell}>
                <Icon name={name} size={24} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <footer className={styles.footer}>
          <span>SHELLFORGE · 造物之海</span>
          <span>P1 · 设计系统预览</span>
        </footer>
      </main>
    </>
  );
}
