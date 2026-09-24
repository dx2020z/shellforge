'use client';
import { useEffect, useState } from 'react';
import type { PartViewerProps } from '@/contracts/collaboration';
import { parseAssetEntry } from '@/assets/schema';
import styles from './PartViewer.module.css';
export default function PartViewer({part,onLoadError}:PartViewerProps){
  const [preview,setPreview]=useState(part?.imagePath || '');
  useEffect(()=>{
    if(!part)return;setPreview(part.imagePath);
    const abort=new AbortController();
    fetch('/assets/parts/'+part.id+'/manifest.json',{signal:abort.signal,cache:'no-store'}).then(r=>r.json()).then(v=>{const asset=parseAssetEntry(v);if(asset.previewPath)setPreview(asset.previewPath)}).catch(()=>{});
    return()=>abort.abort();
  },[part]);
  if(!part)return null;
  return <div className={styles.viewer}>
    <img src={preview || part.imagePath} alt={part.name} onError={()=>{if(preview!==part.imagePath)setPreview(part.imagePath);onLoadError?.();}}/>
    <div><strong>{part.name}</strong><p>{part.description}</p><small>{part.tags.join(' / ')}</small></div>
  </div>;
}
