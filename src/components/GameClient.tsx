'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ENEMIES, PARTS, findPart } from '@/domain/catalog';
import { GUARDS, INTENT_NAMES } from '@/domain/tactical';
import { KEYWORD_DESCRIPTIONS } from '@/domain/keywords';
import { takeAction, beginBattle, equipPart, equipGeneratedPart, equipGeneratedCreature, registerGeneratedParts, updateGeneratedPart, newGame, settleBattle, abandonBattle } from '@/domain/game';
import { makeCreature } from '@/domain/engine';
import { clearBrowserSave, loadBrowserSave, saveBrowserSave } from '@/domain/storage';
import type { GameSave, GeneratedPart, Slot } from '@/domain/types';
import type { CreatureDrafts, CreatureSlot } from '@/server/providers/creature';
import type { ModelTask } from '@/server/providers/types';
import { readAppearances, type Appearances, type Appearance } from '@/assets/schema';
import BattleStage from '@/features/battle/BattleStage';
import SceneErrorBoundary from '@/features/battle/SceneErrorBoundary';
import CreatureScene from '@/features/viewer/CreatureScene';
import PartViewer from '@/features/viewer/PartViewer';
import ForgePanel from '@/features/forge/ForgePanel';
import CreatureForge from '@/features/forge/CreatureForge';
import ViewportErrorBoundary from './ViewportErrorBoundary';
import styles from './GameClient.module.css';

const SLOT_NAMES:Record<Slot,string>={head:'头部',body:'身体',legs:'腿部'};
const appearanceKey='shellforge.appearance.v1';const demoSaveKey='shellforge.demo.save.v1';const demoAppearanceKey='shellforge.demo.appearance.v1';
interface Status { deepseekConfigured:boolean; tripoConfigured:boolean }
export default function GameClient(){
  const [save,setSave]=useState<GameSave>(newGame);
  const saveRef=useRef(save);
  const [ready,setReady]=useState(false);
  const [demoMode,setDemoMode]=useState(false);
  const saveKey=demoMode?demoSaveKey:undefined;
  const activeAppearanceKey=demoMode?demoAppearanceKey:appearanceKey;
  const [selectedId,setSelectedId]=useState('h01');
  const [partSearch,setPartSearch]=useState('');
  const [partFilter,setPartFilter]=useState<'all'|'generated'|'blueprint'|'ready'|'pending'>('all');
  const [slot,setSlot]=useState<Slot>('head');
  const [tab,setTab]=useState<'assemble'|'forge'|'partForge'>('forge');
  const [message,setMessage]=useState('组装你的造物，挑战第一位遗迹守卫。');
  const [storageError,setStorageError]=useState('');
  const [settling,setSettling]=useState(false);
  const [guardTaunt,setGuardTaunt]=useState('');
  const battleIdRef=useRef<string|null>(null);
  const [settings,setSettings]=useState(false);
  const [help,setHelp]=useState(false);
  const [status,setStatus]=useState<Status>({deepseekConfigured:false,tripoConfigured:false});
  const [statusError,setStatusError]=useState('');
  const [appearances,setAppearances]=useState<Appearances>({});
  const [assetRevision,setAssetRevision]=useState(0);
  const [forgeEpoch,setForgeEpoch]=useState(0);
  const refreshStatus=()=>fetch('/api/status',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(s=>{setStatus(s);setStatusError('')}).catch(()=>setStatusError('无法读取配置，请确认本地服务正在运行。'));
  useEffect(()=>{
    const demo=new URLSearchParams(window.location.search).get('demo')==='1';setDemoMode(demo);const key=demo?demoSaveKey:undefined;let loaded=loadBrowserSave(key);if(demo&&!loaded.save){const preset=newGame();preset.unlocked=PARTS.map(p=>p.id);preset.equipped=['h01','b01','l03'];loaded={save:preset};}if(loaded.save){setTab('assemble');if(loaded.save.activeBattle){battleIdRef.current=loaded.save.activeBattle.id;setGuardTaunt('守卫记住了你这副躯壳。')}saveRef.current=loaded.save;setSave(loaded.save);setSelectedId(loaded.save.equipped[0]);setMessage(demo?'离线演示已就绪：演示存档与日常进度分开保存。':loaded.save.activeBattle?'已恢复未结算的战斗，继续这一场对局。':'已恢复第 '+loaded.save.generation+' 代进度，当前挑战：'+ENEMIES[loaded.save.enemyIndex].name+'。');}if(loaded.warning){setStorageError(loaded.warning);setMessage(loaded.warning);}
    try{setAppearances(readAppearances(localStorage.getItem(demo?demoAppearanceKey:appearanceKey)));}catch{setStorageError('浏览器无法保存外观设置。');}
    setReady(true);if(demo)setStatus({deepseekConfigured:false,tripoConfigured:false});else void refreshStatus();
  },[]);
  const current=save.activeBattle;
  const battleResult=current?.tactical?.result??null;
  useEffect(()=>{if(battleResult)setSettling(true);},[battleResult]);
  const selected=findPart(selectedId);
  const player=useMemo(()=>makeCreature(save.equipped,save.inheritPartId,save.generation,save.creatureName,save.traits),[save.equipped,save.inheritPartId,save.generation,save.creatureName,save.traits]);
  const activeAppearances=useMemo(()=>{const next={...appearances};for(let i=0;i<3;i++){const part=save.generatedParts?.find(p=>p.id===save.equippedGenerated?.[i]);if(part)next[part.blueprintId]=part.appearance;}return next;},[appearances,save.generatedParts,save.equippedGenerated]);
  const opponent=ENEMIES[save.enemyIndex];
  const enemy=useMemo(()=>makeCreature(opponent.parts,null,1,opponent.name),[opponent]);
  const update=(next:GameSave)=>{saveRef.current=next;setSave(next);if(!saveBrowserSave(next,saveKey))setStorageError('本次进度未能写入浏览器；关闭页面后可能丢失。');};
  const changeSave=(change:(current:GameSave)=>GameSave)=>update(change(saveRef.current));
  const actInBattle=(action:import('@/domain/tactical').Action)=>{if(!current?.tactical||current.tactical.result)return;try{update(takeAction(save,action));}catch(error){setMessage(error instanceof Error?error.message:'行动失败');}};
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.repeat||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement||!current?.tactical||current.tactical.result)return;const action=({1:'attack',2:'guard',3:'move'} as const)[event.key as '1'|'2'|'3'];if(action){event.preventDefault();actInBattle(action);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[current,save]);
  const abandon=()=>{if(!current)return;if(!window.confirm('放弃本场战斗并退回备战？本场不计胜负，也不会获得缴获或传承。'))return;update(abandonBattle(save));battleIdRef.current=null;setSettling(false);setMessage('已退回备战，本场战斗未计入胜负。');};
  const resetViewport=()=>{if(current){update(abandonBattle(save));battleIdRef.current=null;}setSettling(false);setMessage('视窗已重置，当前战斗已退回备战。');};
  const choose=(id:string)=>{
    try{const next=equipPart(saveRef.current,id);update(next);setSelectedId(id);setMessage('已装备 '+(appearances[id]?.name || findPart(id).name)+'，角色和属性已更新。');}
    catch(error){setMessage(error instanceof Error?error.message:'无法装备');}
  };
  const chooseGenerated=(id:string)=>{try{const next=equipGeneratedPart(saveRef.current,id);update(next);const part=next.generatedParts!.find(p=>p.id===id)!;setSelectedId(part.blueprintId);setMessage('已装备自创部件「'+part.name+'」。');setAssetRevision(v=>v+1);}catch(error){setMessage(error instanceof Error?error.message:'无法装备自创部件');}};
  const selectSlot=(s:Slot)=>{setSlot(s);setSelectedId(save.equipped[s==='head'?0:s==='body'?1:2]);};
  const start=()=>{
    if(!ready || current)return;
    const seed=crypto.getRandomValues(new Uint32Array(1))[0],battleId=crypto.randomUUID();
    update(beginBattle(save,seed,battleId));battleIdRef.current=battleId;const defaults=['别被这团铜壳的火星吓到。','你的甲壳还没我的门栓厚。','弹簧腿先别急着逃。','吼得响不代表壳够硬。','这副镜面壳照不出胜利。','钻角很尖，可惜我不怕痒。'];setGuardTaunt(defaults[save.enemyIndex]||'准备好迎接潮汐了吗？');if(!demoMode)void fetch('/api/generation/taunt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({creature:save.creatureName||'新生造物',enemyIndex:save.enemyIndex,keywords:(save.equipped.flatMap(id=>save.traits?.[id]?.keywords||[])).slice(0,6)})}).then(r=>r.json()).then(x=>{if(battleIdRef.current===battleId&&typeof x.taunt==='string'&&x.taunt.length<=30)setGuardTaunt(x.taunt)}).catch(()=>{});setSettling(false);setTab('assemble');setMessage('战斗开始。观察守卫意图，按 1 / 2 / 3 选择行动。');
  };
  const finish=useCallback(()=>setSettling(true),[]);
  const settle=(partId:string|null)=>{
    if(!current)return;
    try{
      const next=settleBattle(save,current.id,partId);update(next);setSettling(false);battleIdRef.current=null;
      setMessage(current.tactical?.result==='win'?(partId?'缴获 '+findPart(partId).name+'！可在左侧对应槽位装备。':'本场获胜，继续探索下一处遗迹。'):current.tactical?.result==='loss'?'第 '+next.generation+' 代已苏醒。保留所选自创部件，另外两件已从部件库移除；预置与缴获蓝图保留。':'势均力敌。调整组合再挑战。');
    }catch(error){setMessage(error instanceof Error?error.message:'结算失败');}
  };
  const applyAppearance=(id:string,appearance:Appearance)=>{
    if(current || !save.unlocked.includes(id)){setMessage('请先完成战斗，并选择已解锁的部件。');return;}
    const index=save.equipped.indexOf(id),generatedId=index>=0?save.equippedGenerated?.[index]:null;
    if(generatedId){const part=save.generatedParts?.find(p=>p.id===generatedId);if(part){changeSave(s=>updateGeneratedPart(s,generatedId,{appearance,status:part.status}));setAssetRevision(v=>v+1);setMessage('自创部件朝向已保存。');return;}}
    const next={...appearances,[id]:appearance};setAppearances(next);
    try{localStorage.setItem(activeAppearanceKey,JSON.stringify(next));}catch{setStorageError('外观已应用，但无法保存到浏览器。');}
    setMessage(appearance.modelPath?'生成模型已装配，可在组装页查看；加载失败时会保留内置外观。':'部件设定已采用。');setAssetRevision(v=>v+1);
  };
  const partsFromDrafts=(projectId:string,drafts:CreatureDrafts,jobs:Partial<Record<CreatureSlot,ModelTask>>={}):GeneratedPart[]=>
    (['head','body','legs'] as const).map(slot=>{const d=drafts[slot],job=jobs[slot];return {id:projectId+':'+slot,projectId,blueprintId:d.partId,name:d.name,description:d.description,trait:{keywords:d.keywords,cost:d.cost,reasons:d.reasons,level:0},appearance:{name:d.name,description:d.description,modelPath:demoMode?'/assets/parts/'+d.partId+'/model.glb':job?.status==='succeeded'?job.modelPath:null,rotation:[0,0,0]},createdAt:Date.now(),status:job?.status||'design',source:d.source,fallbackReason:d.fallbackReason};});
  const onProjectDrafts=(projectId:string,drafts:CreatureDrafts)=>{try{changeSave(s=>registerGeneratedParts(s,partsFromDrafts(projectId,drafts)));}catch(error){setMessage(error instanceof Error?error.message:'部件登记失败');}};
  const onPartTask=(projectId:string,slot:CreatureSlot,task:ModelTask,draft:import('@/server/providers/types').PartDraft)=>{
    const id=projectId+':'+slot;
    changeSave(s=>{const part=s.generatedParts?.find(p=>p.id===id);if(!part)return s;if(part.status===task.status&&part.appearance.modelPath===task.modelPath)return s;return updateGeneratedPart(s,id,{appearance:{...part.appearance,name:draft.name,description:draft.description,modelPath:task.status==='succeeded'?task.modelPath:part.appearance.modelPath},status:task.status});});
    if(task.status==='succeeded')setAssetRevision(v=>v+1);
  };
  const onApplyProject=(projectId:string,drafts:CreatureDrafts,jobs:Partial<Record<CreatureSlot,ModelTask>>)=>{
    try{let next=saveRef.current;if(next.activeBattle)throw new Error('战斗结算后才能装配');next=registerGeneratedParts(next,partsFromDrafts(projectId,drafts,jobs));next=equipGeneratedCreature(next,projectId,drafts.name,drafts.lore);update(next);setAssetRevision(v=>v+1);setTab('assemble');setMessage('造物已装配；模型就绪后会自动换上，自创部件可在左侧重新选择。');}
    catch(error){setMessage(error instanceof Error?error.message:'装配失败');}
  };
  const reset=()=>{
    if(!window.confirm('重新开始会清除本浏览器的进度与已应用外观，已下载的模型文件仍保留。确定吗？'))return;
    clearBrowserSave(demoMode?demoSaveKey:undefined);const fresh=newGame();if(demoMode){fresh.unlocked=PARTS.map(p=>p.id);fresh.equipped=['h01','b01','l03'];}update(fresh);setAppearances({});try{localStorage.removeItem(activeAppearanceKey);localStorage.removeItem(demoMode?'shellforge.creature-forge.v2.demo':'shellforge.creature-forge.v2');localStorage.removeItem(demoMode?'shellforge.creature-forge.v1.demo':'shellforge.creature-forge.v1');}catch{}
    setForgeEpoch(v=>v+1);setSelectedId('h01');setSlot('head');setTab(demoMode?'assemble':'forge');setSettling(false);setSettings(false);setMessage('新的造物已经苏醒。');
  };
  const exportCard=()=>{try{
    const source=document.querySelector<HTMLCanvasElement>('canvas[aria-label="可拖动旋转的三维造物"]');if(!source)throw Error('请先切换到造物展示页。');
    const shot=new Image();shot.src=source.toDataURL('image/png');shot.onload=()=>{const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;const ctx=canvas.getContext('2d');if(!ctx)return;
      const bg=ctx.createLinearGradient(0,0,720,1280);bg.addColorStop(0,'#102923');bg.addColorStop(1,'#071513');ctx.fillStyle=bg;ctx.fillRect(0,0,720,1280);ctx.strokeStyle='#c9a96b';ctx.lineWidth=2;ctx.strokeRect(24,24,672,1232);
      ctx.fillStyle='#c9b786';ctx.font='20px sans-serif';ctx.fillText('SHELLFORGE · 造物之海',54,76);ctx.fillStyle='#f2e5c5';ctx.font='bold 46px sans-serif';ctx.fillText((save.creatureName||'初生之壳').slice(0,12),54,142);
      const scale=Math.min(612/shot.width,510/shot.height);const width=shot.width*scale,height=shot.height*scale;ctx.drawImage(shot,(720-width)/2,170+(510-height)/2,width,height);
      let y=725;ctx.fillStyle='#9fe0c1';ctx.font='bold 24px sans-serif';ctx.fillText('造物特征',54,y);y+=42;ctx.fillStyle='#f3e6c9';ctx.font='20px sans-serif';
      for(const id of save.equipped){const trait=save.traits?.[id];const part=findPart(id);const txt=part.name+' · '+(trait?.keywords.join(' / ')||'基础能力')+(trait?.cost?' · 代价 '+trait.cost:'');ctx.fillText(txt,54,y);y+=34}
      y+=14;ctx.fillStyle='#9fe0c1';ctx.font='bold 23px sans-serif';ctx.fillText('传说',54,y);y+=36;ctx.fillStyle='#e0dfd0';ctx.font='18px sans-serif';const lore=save.lore||'新的远征即将启程。';for(let i=0;i<lore.length;i+=28){ctx.fillText(lore.slice(i,i+28),54,y);y+=28}
      const wins=save.totalWins||0;ctx.fillStyle='#d7bd82';ctx.font='18px sans-serif';ctx.fillText('第 '+save.generation+' 代 · 本代击败 '+(save.expeditionWins||0)+' 位守卫 · 累计胜场 '+wins,54,1180);ctx.fillStyle='#819b8d';ctx.font='15px sans-serif';ctx.fillText('创造 · 战斗 · 传承',54,1220);
      canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(save.creatureName||'shellforge-creature')+'.png';a.click();URL.revokeObjectURL(url)},'image/png');
    };shot.onerror=()=>setMessage('截图读取失败，请重新加载造物展示。');
   }catch(error){setMessage(error instanceof Error?error.message:'导出失败。')}};
  const candidates=current?(battleResult==='win'?current.fighters[1].partIds.filter(id=>!save.unlocked.includes(id)):battleResult==='loss'?current.fighters[0].partIds.map((id,i)=>current.generatedPartIds?.[i]||id):[]):[];
  const candidateBlueprint=(id:string)=>save.generatedParts?.find(p=>p.id===id)?.blueprintId||id;
  const candidateName=(id:string)=>save.generatedParts?.find(p=>p.id===id)?.name||findPart(id).name;
  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/" aria-label="ShellForge 造物之海"><span className={styles.mark}>◇</span><div><strong>SHELLFORGE</strong><small>造 物 之 海</small></div></a>
      <nav className={styles.tabs} aria-label="主要功能"><button className={tab==='assemble'?styles.tabActive:''} onClick={()=>setTab('assemble')}>组装造物</button><button className={tab==='forge'?styles.tabActive:''} onClick={()=>setTab('forge')} disabled={Boolean(current)}>孵化整只</button><button className={tab==='partForge'?styles.tabActive:''} onClick={()=>setTab('partForge')} disabled={Boolean(current)}>单件调整</button></nav>
      <div className={styles.headerRight}><span className={styles.local}>{demoMode?'离线演示 · 预置 GLB':'本地试玩 · 三件孵化'}</span><button onClick={()=>setHelp(v=>!v)}>玩法</button><button onClick={()=>{setSettings(v=>!v);void refreshStatus()}}>接入设置</button></div>
    </header>
    <div className={styles.titlebar}><div><span className={styles.eyebrow}>THE SUNKEN WORKSHOP</span><h1>沉没工坊 <small>让你的造物活下来</small></h1></div><div className={styles.generation}><span>血脉</span><strong>{String(save.generation).padStart(2,'0')}</strong><small>代</small></div></div>
    {help && <section className={styles.help}><strong>造物者手册</strong><p>1. 在“孵化整只”描述造物。提交后可以新建下一只，三件 3D 模型会在后台独立生成。</p><p>2. 在左侧部件库搜索并换装自创部件或已解锁蓝图。出战后看守卫意图，选择攻击、守护或机动。</p><p>3. 胜利缴获敌方蓝图；战败选一件传承，其余当前装备的自创部件实例离开部件库，预置和缴获蓝图保留。</p><p>无 API 时可用预置蓝图和本地规则继续游戏。加入 ?demo=1 可进入隔离存档的离线演示。</p><button onClick={()=>setHelp(false)}>知道了</button></section>}
    {storageError && <div className={styles.warning} role="alert">{storageError}</div>}
    {settings && <section className={styles.settings} aria-label="接入设置">
      <div><span className={styles.eyebrow}>INTEGRATIONS</span><h2>把你的服务接进来</h2><p>在项目根目录将 <code>.env.example</code> 复制为 <code>.env.local</code>，填写密钥和模型名后重启服务。密钥只保存在本机服务端。</p></div>
      <div><strong>DeepSeek · 文本设定</strong><p>{status.deepseekConfigured?'配置已填写；到“孵化整只”实际调用':'未配置 · 当前使用本地设定'}</p><code>DEEPSEEK_API_KEY / DEEPSEEK_MODEL</code><strong>Tripo · 3D 模型</strong><p>{status.tripoConfigured?'配置已填写；生成时显示真实任务状态':'未配置 · 当前使用内置 3D 角色'}</p><code>TRIPO_API_KEY / TRIPO_MODEL</code></div>
      <div><strong>美术资源</strong><p>将模型放到 <code>public/assets/parts/部件ID/</code>，填写该目录的 <code>manifest.json</code>。详见 <code>docs/ART_AND_API.md</code>。</p><button onClick={()=>{setAssetRevision(v=>v+1);setMessage('已重新读取美术配置。');setTab('assemble')}}>重新加载素材</button><button onClick={reset}>重开本地档案</button><p className={styles.warning}>{statusError}</p></div>
      <button className={styles.close} aria-label="关闭接入设置" onClick={()=>setSettings(false)}>×</button>
    </section>}
    <div className={styles.workspace}>
      <aside className={styles.library} aria-label="部件库">
        <div className={styles.sectionTitle}><h2>部件库</h2><span>{(save.generatedParts?.length||0)} 自创 · {save.unlocked.length} 蓝图</span></div>
        <input className={styles.partSearch} aria-label="搜索部件库" placeholder="搜索名称、描述、技能…" value={partSearch} onChange={e=>setPartSearch(e.target.value.slice(0,60))}/>
        <select className={styles.partSearch} aria-label="筛选部件来源或状态" value={partFilter} onChange={e=>setPartFilter(e.target.value as typeof partFilter)}><option value="all">全部部件</option><option value="generated">仅自创</option><option value="blueprint">仅蓝图</option><option value="ready">自创 3D 已就绪</option><option value="pending">自创孵化中 / 待核查</option></select>
        <div className={styles.slots} role="tablist" aria-label="部件槽位">{(['head','body','legs'] as const).map(s=><button key={s} role="tab" aria-selected={slot===s} className={slot===s?styles.slotActive:''} onClick={()=>selectSlot(s)}>{SLOT_NAMES[s]}</button>)}</div>
        <div className={styles.parts}>{PARTS.filter(p=>partFilter!=='generated'&&partFilter!=='ready'&&partFilter!=='pending'&&p.slot===slot&&(!partSearch||[p.name,p.description,...p.tags].join(' ').toLowerCase().includes(partSearch.toLowerCase()))).map(part=>{
          const owned=save.unlocked.includes(part.id),equipped=save.equipped.includes(part.id)&&!save.equippedGenerated?.[['head','body','legs'].indexOf(slot)];
          return <button key={part.id} className={styles.part+' '+(equipped?styles.equipped:'')+' '+(!owned?styles.locked:'')} disabled={!owned || Boolean(current) || !ready} onClick={()=>choose(part.id)} aria-label={part.name+(owned?'，点击装备':'，尚未解锁')} aria-pressed={equipped}>
            <img src={part.imagePath} alt=""/><div><strong>{appearances[part.id]?.name || part.name}</strong><small>{owned?(save.presetTraits?.[part.id]?.keywords.join(' · ')||part.tags.join(' · ')):'击败守卫以缴获'}</small></div><span className={styles.partFlag}>{equipped?'✓':owned?'＋':'◇'}</span>
            {owned && <div className={styles.miniStats}><span>生命 {part.stats.hp}</span><span>攻击 {part.stats.atk}</span><span>防御 {part.stats.def}</span><span>速度 {part.stats.speed}</span></div>}
          </button>;
        })}{(save.generatedParts||[]).filter(p=>partFilter!=='blueprint'&&(partFilter!=='ready'||p.status==='succeeded')&&(partFilter!=='pending'||['design','submitting','deferred','queued','processing','unknown'].includes(p.status))&&findPart(p.blueprintId).slot===slot&&(!partSearch||[p.name,p.description,p.projectId,...p.trait.keywords,p.trait.cost||''].join(' ').toLowerCase().includes(partSearch.toLowerCase()))).map(part=><button key={part.id} className={styles.part+' '+(save.equippedGenerated?.includes(part.id)?styles.equipped:'')} disabled={Boolean(current)||!ready} onClick={()=>chooseGenerated(part.id)} aria-label={'自创部件 '+part.name+'，点击装备'} aria-pressed={save.equippedGenerated?.includes(part.id)||false}><img src={findPart(part.blueprintId).imagePath} alt=""/><div><strong>{part.name}</strong><small>{part.source==='deepseek'?'DEEPSEEK':part.source==='local'?'本地映射':'来源未知'} · {part.trait.keywords.join(' · ')} · {part.status==='succeeded'?'3D 已就绪':part.status==='unknown'?'任务待核查':part.status==='failed'?'模型失败':part.status==='deferred'?'排队重试':'孵化中'}</small>{part.source==='local'&&part.fallbackReason&&<small>{part.fallbackReason}</small>}</div><span className={styles.partFlag}>{save.equippedGenerated?.includes(part.id)?'✓':'＋'}</span></button>)}</div>
        <PartViewer part={selected}/>{activeAppearances[selectedId]?.modelPath && <div className={styles.modelControls} aria-label="模型朝向调整"><span>部件朝向微调</span><button disabled={Boolean(current)} onClick={()=>applyAppearance(selectedId,{...activeAppearances[selectedId],rotation:[activeAppearances[selectedId].rotation?.[0]||0,((activeAppearances[selectedId].rotation?.[1]||0)+90)%360,activeAppearances[selectedId].rotation?.[2]||0]})}>转 90°</button><button disabled={Boolean(current)} onClick={()=>applyAppearance(selectedId,{...activeAppearances[selectedId],rotation:[activeAppearances[selectedId].rotation?.[0]||0,((activeAppearances[selectedId].rotation?.[1]||0)+180)%360,activeAppearances[selectedId].rotation?.[2]||0]})}>翻转正面</button></div>}
        <div className={styles.libraryFoot}><span>◈</span><p>躯壳会破碎。<br/>蓝图与记忆，会留下。</p></div>
      </aside>
      <section className={styles.viewport} aria-label="造物与战场">
        <ViewportErrorBoundary onReset={resetViewport}>
          {current?.tactical?.result===null ? <BattleStage player={current.fighters[0]} enemy={current.fighters[1]} tactical={current.tactical} taunt={guardTaunt} events={[]} eventIndex={0} appearances={activeAppearances} onAction={actInBattle} onComplete={finish} onAbandon={abandon}/> : <div style={{position:'absolute',inset:0}}>
            {tab!=='forge' && <SceneErrorBoundary><CreatureScene key={assetRevision} player={player} appearances={activeAppearances}/></SceneErrorBoundary>}
            {!ready&&<div role="status" className={styles.viewportMessage}>正在读取本地进度…</div>}
          </div>}
          <div className={styles.forgeOverlay} style={{display:!current&&tab==='forge'?'block':'none'}}><CreatureForge key={forgeEpoch} partIds={save.equipped} availablePartIds={save.unlocked} retiredPartIds={save.retiredGeneratedPartIds} disabled={!ready||Boolean(current)} tripoConfigured={status.tripoConfigured} deepseekConfigured={status.deepseekConfigured} demoMode={demoMode} onProjectDrafts={onProjectDrafts} onPartTask={onPartTask} onApplyProject={onApplyProject}/></div>
        </ViewportErrorBoundary>

        {settling && current && <div className={styles.settlement} role="dialog" aria-modal="true" aria-label="战斗结算">
          <span className={styles.resultMark}>{battleResult==='win'?'✧':battleResult==='loss'?'◇':'≈'}</span><span className={styles.eyebrow}>{battleResult==='win'?'VICTORY':battleResult==='loss'?'A NEW GENERATION':'DRAW'}</span>
          <h2>{battleResult==='win'?'让战利品成为你的一部分':battleResult==='loss'?'躯壳破碎，火种未灭':'潮水暂未分出胜负'}</h2>
          <p>{battleResult==='win'?(candidates.length?'选择一件尚未拥有的敌方部件。':'对手的蓝图已全部收集，继续前进。'):battleResult==='loss'?'选择一件传承部件。下一代装备它时，生命 +5。':'调整装备，重新挑战。'}</p>
          <div className={styles.rewards}>{candidates.map(id=><button key={id} onClick={()=>settle(id)}><img src={findPart(candidateBlueprint(id)).imagePath} alt=""/><strong>{candidateName(id)}</strong><span>{battleResult==='win'?'缴获蓝图':'刻下传承'}</span></button>)}</div>
          {!candidates.length && <button className={styles.primary} onClick={()=>settle(null)}>继续探索 →</button>}
          <button className={styles.abandonSettlement} onClick={abandon}>放弃本场战斗，退回备战</button>
        </div>}
      </section>
      <aside className={styles.inspector}>
        <div className={styles.sectionTitle}><h2>你的造物</h2><span>READY</span></div>
        <div className={styles.statGrid}>{[['生命','hp'],['攻击','atk'],['防御','def'],['速度','speed']].map(([label,key])=><div key={key}><span>{label}</span><strong>{player.stats[key as keyof typeof player.stats]}</strong><i style={{width:Math.min(100,player.stats[key as keyof typeof player.stats]/(key==='hp'?100:35)*100)+'%'}}/></div>)}</div>
        <div className={styles.ability}><span>部件技能 · 每级 +25%</span>{save.equipped.map((id,i)=>{const trait=save.traits?.[id],part=findPart(id),generated=save.generatedParts?.find(p=>p.id===save.equippedGenerated?.[i]),slot=['头部攻击','身体守护','腿部机动'][i];return <div key={i}><strong>{slot} · {generated?.name||part.name} · Lv.{trait?.level||0}</strong>{trait?.keywords.map(k=><p key={k}><b>{k}</b>：{KEYWORD_DESCRIPTIONS[k]}</p>)}</div>})}</div>
        {save.inheritPartId && <div className={styles.inheritance}>◈ 传承 · {findPart(save.inheritPartId).name} · 印记 Lv.{save.traits?.[save.inheritPartId]?.level||1}<small>{save.equipped.includes(save.inheritPartId)?'已激活 · 生命 +5':'装备此部件后获得生命 +5'}</small></div>}
        <div className={styles.opponent}><span className={styles.eyebrow}>NEXT ENCOUNTER</span><span className={styles.enemyIcon}>♜</span><small>遗迹守卫 / 0{save.enemyIndex+1}</small><h3>{opponent.name}</h3><p>生命 {enemy.stats.hp} · 攻击 {enemy.stats.atk}<br/>防御 {enemy.stats.def} · 速度 {enemy.stats.speed}</p><div className={styles.scout}><strong>巡逻模式</strong><span>{GUARDS[save.enemyIndex].pattern.map(x=>INTENT_NAMES[x]).join(' → ')}</span><strong>弱点谜语</strong><span>{GUARDS[save.enemyIndex].hint}</span></div><div className={styles.enemyParts}>{opponent.parts.map(id=><img src={findPart(id).imagePath} alt={findPart(id).name} title={findPart(id).name} key={id}/>)}</div></div>
        <button className={styles.share} onClick={exportCard} disabled={!ready||Boolean(current)||tab!=='assemble'}>导出造物卡 PNG</button><button className={styles.primary} onClick={start} disabled={!ready || Boolean(current)}>{!ready?'读取进度…':current?'战斗进行中':'前往挑战'} <span>↗</span></button>
        <small className={styles.autosave}>{current?'完成结算后可再次换装':'变更自动保存于当前浏览器'}</small>
      </aside>
    </div>
    <div className={styles.message} role="status"><span>✦</span>{message}</div>
    <section className={styles.journey} aria-label="探索路线"><div><span className={styles.eyebrow}>EXPEDITION</span><h2>潮下遗迹</h2></div><ol>{ENEMIES.map((e,i)=><li className={i===save.enemyIndex?styles.currentStop:''} key={e.name}><span>{String(i+1).padStart(2,'0')}</span><strong>{e.name}</strong>{i===save.enemyIndex && <small>当前挑战</small>}</li>)}</ol>{Boolean(save.lineage?.length)&&<div className={styles.lineage} aria-label="造物家谱">{save.lineage!.slice().reverse().map((entry,i)=><article key={entry.generation}><small>第 {entry.generation} 代</small><strong>{entry.creatureName}</strong><span>击败 {entry.guardsBeaten} 位守卫</span><span>{findPart(entry.inheritedPartId).name} · 印记 Lv.{entry.partLevel}</span></article>)}</div>}</section>
    <footer className={styles.footer}><span>本地原型 · 组装 / 战斗 / 传承</span><details><summary>最近战绩 · {save.history.length} 场</summary>{save.history.length?save.history.map(h=><p key={h.battleId}>{h.result==='win'?'胜':h.result==='loss'?'败':'平'} · {h.opponent}{h.selectedPartId?' / '+findPart(h.selectedPartId).name:''}</p>):<p>你的第一段记忆，尚未写下。</p>}</details><span>存档 #{save.revision}</span></footer>
  </main>;
}
