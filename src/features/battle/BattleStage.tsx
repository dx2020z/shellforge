'use client';
import {useEffect} from 'react';
import type {BattleStageProps} from '@/contracts/collaboration';
import {ACTIONS,effects,intent,GUARDS,INTENT_NAMES,legalActions,type Action} from '@/domain/tactical';
import CreatureScene from '@/features/viewer/CreatureScene';
import SceneErrorBoundary from './SceneErrorBoundary';
import styles from './BattleStage.module.css';
const names={attack:'攻击',guard:'守护',move:'机动'};
export default function BattleStage({player,enemy,onComplete,appearances,tactical,onAction,onAbandon,taunt}:BattleStageProps){
 const ended=tactical?Boolean(tactical.result):true;
 useEffect(()=>{if(ended)onComplete?.()},[ended,onComplete]);
 const act=(a:Action)=>{if(ended||!tactical||!legalActions(tactical).includes(a))return;onAction?.(a)};
 const fx=tactical?effects(tactical):null;
 return <div className={styles.stage} aria-label="回合战斗">
 <div className={styles.hud}>{[player,enemy].map((f,i)=>{const hp=tactical?.hp[i]??f.stats.hp,maxHp=tactical?.maxHp[i]??f.stats.hp;return <div className={styles.fighter} key={i}><div><span>{i?'遗迹守卫':'你的造物'}</span><strong>{f.name}</strong><b>{hp}<small> / {maxHp}</small></b></div><div className={styles.hp}><i style={{width:Math.max(0,100*hp/maxHp)+'%'}}/></div></div>})}</div>
 <SceneErrorBoundary onReset={onAbandon}><CreatureScene player={player} enemy={enemy} appearances={appearances}/></SceneErrorBoundary>
 {tactical&&!ended&&<div className={styles.intent} role="status">{taunt&&<em>{taunt}</em>}<strong>第 {tactical.turn} 回合 · 守卫意图：{INTENT_NAMES[intent(tactical)]} {fx?.incoming?fx.incoming+' 伤害':''}</strong><span>{tactical.turn===GUARDS[tactical.enemyIndex].enrageAfter?'守卫即将狂暴。 ':tactical.turn>GUARDS[tactical.enemyIndex].enrageAfter?'守卫已狂暴，伤害 +50%。 ':''}{({attack:'守护或机动避开锋芒',sweep:'无法闪避，用身体守护',break:'守护失效，用机动躲开；吸附可抵抗破甲',charge:'下回合伤害 ×2.5；震慑攻击可打断',fortify:'受伤减半；穿刺可无视，守护可恢复 3',heal:'守卫将恢复 3 点生命，趁机进攻'})[intent(tactical)]}</span></div>}
 <div className={styles.bottom}><p aria-live="polite">{ended?'战斗结束':'看清意图，再选择行动。'}{tactical?.traits.some(t=>t.cost==='贪食')&&tactical.turn%4===0?' 贪食：本回合需要休息。':''}</p><div className={styles.actions}>{ACTIONS.map((a,i)=><button key={a} disabled={ended||!tactical||!legalActions(tactical).includes(a)} onClick={()=>act(a)}><b>{i+1} · {names[a]}</b><small>{a==='attack'?'伤害 '+fx?.attack:a==='guard'?'减免 '+fx?.guard:'闪避'+(fx?.moveDamage?' / 伤害 '+fx.moveDamage:'')}</small><small>{tactical?.traits[i]?.keywords.join(' · ')}</small></button>)}<button onClick={onAbandon} aria-label="放弃本场战斗">放弃本场战斗</button></div></div>
 </div>;
}
