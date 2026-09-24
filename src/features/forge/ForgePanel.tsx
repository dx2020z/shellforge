'use client';
import { useEffect, useState } from 'react';
import { findPart } from '@/domain/catalog';
import type { Part } from '@/domain/types';
import type { Appearance } from '@/assets/schema';
import type { ModelTask, PartDraft } from '@/server/providers/types';
import styles from './ForgePanel.module.css';

interface Props { part:Part; appearance?:Appearance; disabled:boolean; tripoConfigured:boolean; deepseekConfigured:boolean; onApply:(id:string,appearance:Appearance)=>void }
const TASK_KEY='shellforge.model-task.v1';
export default function ForgePanel({part,appearance,disabled,tripoConfigured,deepseekConfigured,onApply}:Props){
  const [prompt,setPrompt]=useState('带着锈铜羽冠、能喷出火焰的机械鸟头');
  const [draft,setDraft]=useState<PartDraft|null>(null);
  const [busy,setBusy]=useState(false);
  const [task,setTask]=useState<ModelTask|null>(null);
  const [message,setMessage]=useState('先描述外观，再选择是否生成 3D。部件的战斗数值保持平衡。');
  const [polling,setPolling]=useState(false);
  const [pollCount,setPollCount]=useState(0);
  const [querying,setQuerying]=useState(false);
  useEffect(()=>{setDraft(null);},[part.id]);
  const remember=(value:ModelTask)=>{setTask(value);try{localStorage.setItem(TASK_KEY,JSON.stringify(value));}catch{setMessage('生成任务已提交，但浏览器无法保存任务编号，请抄下编号。');}};
  useEffect(()=>{
    try{const value=JSON.parse(localStorage.getItem(TASK_KEY) || 'null');if(value && typeof value.id==='string' && /^[a-f0-9-]{36}$/.test(value.id) && /^[hbl]0[1-3]$/.test(value.partId)){setTask(value);setPolling(['queued','processing'].includes(value.status));}}
    catch{/* Ignore corrupt presentation state. */}
  },[]);
  async function query(id:string){
    setQuerying(true);
    try{const response=await fetch('/api/generation/model/'+id,{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error);remember(body.task);setPolling(['queued','processing'].includes(body.task.status));setPollCount(c=>c+1);}
    catch{setPolling(false);setMessage('查询暂时失败，任务编号已保留。可稍后点击“查询原任务”，不要重复提交。');}
    finally{setQuerying(false);}
  }
  useEffect(()=>{
    if(!task || !polling || pollCount>=10)return;
    const timer=setTimeout(()=>void query(task.id),Math.max(1000,task.nextPollAt-Date.now()));
    return()=>clearTimeout(timer);
    // query is intentionally scheduled only when the persisted task state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[task,polling,pollCount]);
  async function describe(){
    setBusy(true);setMessage(deepseekConfigured?'正在设计部件外观…':'正在读取本地部件设定…');
    try{
      const response=await fetch('/api/generation/part',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({partId:part.id,prompt}),signal:AbortSignal.timeout(35000)});
      const body=await response.json();if(!response.ok)throw new Error(body.error);
      setDraft(body.draft);setMessage(body.warning || 'DeepSeek 设定已生成。可以采用名称，或继续生成 3D 外观。');
    }catch{setMessage('设定生成失败，请检查本地服务；现有角色仍可使用。');}
    finally{setBusy(false);}
  }
  async function generate(){
    if(!draft || busy || disabled)return;
    const id=crypto.randomUUID();
    const pending:ModelTask={id,partId:draft.partId,prompt:draft.visualPrompt,status:'submitting',progress:0,modelPath:null,updatedAt:Date.now(),nextPollAt:Date.now()+60000,message:'正在提交…'};
    remember(pending);setBusy(true);setPolling(false);setPollCount(0);
    try{
      const response=await fetch('/api/generation/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,partId:draft.partId,prompt:draft.visualPrompt}),signal:AbortSignal.timeout(40000)});
      const body=await response.json();if(!response.ok)throw new Error(body.error);
      remember(body.task);setPolling(['queued','processing'].includes(body.task.status));
    }catch{remember({...pending,status:'unknown',message:'提交结果不明。先查询原任务，再核查 Tripo 控制台，避免重复扣费。'});}
    finally{setBusy(false);}
  }
  const active=task && !['failed','succeeded'].includes(task.status);
  return <div className={styles.forge}>
    <div className={styles.heading}><span>THE FORGE / 外观祭坛</span><h2>赋予躯壳一种想象</h2><p>正在重塑 <b>{part.name}</b> · {part.slot==='head'?'头部':part.slot==='body'?'身体':'腿部'}槽位</p></div>
    <label htmlFor="forge-prompt">它应该长什么样？</label>
    <textarea id="forge-prompt" value={prompt} onChange={e=>setPrompt(e.target.value.slice(0,120))} maxLength={120} disabled={busy || disabled} />
    <div className={styles.line}><small>{prompt.length} / 120</small><button disabled={busy || disabled || !prompt.trim()} onClick={describe}>{busy?'处理中…':deepseekConfigured?'用 DeepSeek 设计设定':'预览本地设定'}</button></div>
    <p className={styles.message} role="status">{message}</p>
    {draft && draft.partId===part.id && <div className={styles.draft}><div><span>{draft.source==='deepseek'?'DEEPSEEK':'LOCAL'}</span><strong>{draft.name}</strong></div><p>{draft.description}</p><small>技能和属性沿用「{part.name}」，生成只改变外观。</small><div className={styles.actions}>
      <button disabled={disabled} onClick={()=>onApply(part.id,{name:draft.name,description:draft.description,modelPath:appearance?.modelPath || null,rotation:appearance?.rotation})}>采用设定</button>
      <button disabled={!tripoConfigured || busy || disabled || Boolean(active)} onClick={generate}>{tripoConfigured?'生成 3D（消耗 Tripo 额度）':'Tripo 尚未配置'}</button>
    </div></div>}
    {task && <div className={styles.task}><div><strong>3D 任务 · {findPart(task.partId).name}</strong><span>{task.progress || 0}%</span></div><progress value={task.progress || 0} max={100}/><p>{task.message}</p><small>本地编号：{task.id}</small>{task.taskId && <small>Tripo：{task.taskId}</small>}
      <div className={styles.actions}><button disabled={querying || busy} onClick={()=>{setPollCount(0);void query(task.id)}}>{querying?'查询中…':'查询原任务'}</button>
      {task.status==='succeeded' && task.modelPath && <button disabled={disabled} onClick={()=>{const p=findPart(task.partId);onApply(task.partId,{name:draft?.partId===task.partId?draft.name:p.name,description:draft?.partId===task.partId?draft.description:p.description,modelPath:task.modelPath,rotation:[0,90,0]})}}>装配生成模型</button>}
      {task.status==='unknown' && <button onClick={()=>{if(window.confirm('请先在 Tripo 控制台核查原任务。继续后允许创建新任务，可能额外计费。确定已核查吗？')){setTask(null);setPolling(false);try{localStorage.removeItem(TASK_KEY)}catch{}}}}>已核查，允许新建</button>}</div>
      {pollCount>=10 && <small>自动查询已暂停，点击“查询原任务”继续。</small>}
    </div>}
    {appearance?.modelPath && <div className={styles.actions}><button disabled={disabled} onClick={()=>onApply(part.id,{...appearance,rotation:[0,((appearance.rotation?.[1] || 0)+90)%360,0]})}>模型转向 90°</button><button disabled={disabled} onClick={()=>onApply(part.id,{...appearance,modelPath:null})}>恢复本地外观</button></div>}
    <p className={styles.foot}>美术队友也可直接交付 GLB；不需要经过生成服务。配置说明在右上角“接入设置”。</p>
  </div>;
}
