'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { findPart } from '@/domain/catalog';
import type { BattleEvent, Creature } from '@/domain/types';
import { parseAssetEntry, type Appearances, type AssetEntry } from '@/assets/schema';
import { placeCreatureSlots, proportionScales } from './assembly';
import { proceduralPart, disposeObject } from './procedural';
import { cloneCachedModel } from './model-cache';
import styles from './CreatureScene.module.css';

export interface CreatureSceneProps { player:Creature; enemy?:Creature; event?:BattleEvent; appearances?:Appearances; assetRevision?:number }
export default function CreatureScene({player,enemy,event,appearances={},assetRevision=0}:CreatureSceneProps) {
  const host=useRef<HTMLDivElement>(null);
  const action=useRef<{event?:BattleEvent;at:number}>({at:0});
  const [error,setError]=useState('');
  const [assetNote,setAssetNote]=useState('');
  const [ready,setReady]=useState(false);
  const [smoothMode,setSmoothMode]=useState(false);
  const [perfEnabled,setPerfEnabled]=useState(false);
  const perfEnabledRef=useRef(false);
  const [perf,setPerf]=useState({fps:0,calls:0,triangles:0});
  const identity=JSON.stringify({p:player.partIds,e:enemy?.partIds,a:appearances,r:assetRevision});
  useEffect(()=>{const enabled=new URLSearchParams(window.location.search).get('perf')==='1';perfEnabledRef.current=enabled;setPerfEnabled(enabled)},[]);
  useEffect(()=>{action.current={event,at:performance.now()};},[event]);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    let renderer:THREE.WebGLRenderer;
    setError('');setAssetNote('');setReady(false);
    try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:true});}
    catch{setError('此设备未能开启 3D，暂用部件图继续游戏。');return;}
    let disposed=false;
    const abort=new AbortController();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1));renderer.shadowMap.enabled=false;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
    element.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',enemy?'双方造物的三维战场':'可拖动旋转的三维造物');
    const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x0a1a1d,12,32);
    const camera=new THREE.PerspectiveCamera(36,1,.1,60);
    camera.position.set(enemy?7:4.5,enemy?5.8:3.5,enemy?10.8:6.7);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.35,0);controls.enableDamping=true;controls.enablePan=false;
    controls.minDistance=5;controls.maxDistance=14;controls.minPolarAngle=.4;controls.maxPolarAngle=1.48;controls.enableZoom=true;
    scene.add(new THREE.HemisphereLight(0xd8fafa,0x294541,2.6));
    const sun=new THREE.DirectionalLight(0xffd1a0,4.1);sun.position.set(4,8,5);scene.add(sun);
    const rim=new THREE.DirectionalLight(0x66efd3,1.6);rim.position.set(-4,4,-4);scene.add(rim);
    const warmRim=new THREE.DirectionalLight(0xffbd7a,.85);warmRim.position.set(-4,3,5);scene.add(warmRim);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(30,64),new THREE.MeshStandardMaterial({color:0x0a2025,roughness:.75,metalness:.4}));floor.rotation.x=-Math.PI/2;floor.position.y=-.22;scene.add(floor);
    const ring=(radius:number,y:number,color:number)=>{
      const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,.018,5,96),new THREE.MeshBasicMaterial({color}));mesh.rotation.x=Math.PI/2;mesh.position.y=y;scene.add(mesh);
    };
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(enemy?4.5:2.3,enemy?4.8:2.55,.3,12),new THREE.MeshStandardMaterial({color:0x35524e,metalness:.6,roughness:.7,flatShading:true}));
    platform.position.y=-.05;platform.receiveShadow=true;scene.add(platform);ring(enemy?4.1:2.06,.12,0x819778);ring(enemy?3.7:1.83,.115,0x79c4a7);
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=enemy?4.4:2.25;const block=new THREE.Mesh(new THREE.BoxGeometry(.12,.04,.32),new THREE.MeshStandardMaterial({color:0xd7ad68}));block.position.set(Math.sin(a)*r,.13,Math.cos(a)*r);block.rotation.y=a;scene.add(block);}
    const dustPositions=new Float32Array(80*3);
    for(let i=0;i<80;i++){dustPositions[i*3]=Math.sin(i*7.31)*9;dustPositions[i*3+1]=.7+(i%13)*.31;dustPositions[i*3+2]=Math.cos(i*4.1)*8;}
    const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
    const dustMaterial=new THREE.PointsMaterial({color:0xa2ead3,size:.025,transparent:true,opacity:.55});const dust=new THREE.Points(dustGeometry,dustMaterial);scene.add(dust);

    const fighters:THREE.Group[]=[];
    const localPositions=enemy?[-2,2]:[0];
    const slots=['head','body','legs'] as const;
    const notes=new Set<string>();
    const note=(text:string)=>{if(!disposed){notes.add(text);setAssetNote(Array.from(notes).join(' · '));}};
    const targetHeights=[.8,1.2,.9];
    const targetWidths=[1.0,1.25,1.05];
    const fittedWidths=[...targetWidths];
    const fighterAnchors:THREE.Group[][]=[];
    function placeSockets(anchors:THREE.Group[],heights:number[]){
      const placed=placeCreatureSlots([heights[0],heights[1],heights[2]]);
      // Fitted GLBs have their local origin at the bounding-box floor (y=0), so
      // place each anchor by its bottom. Using center here lifted every part by
      // half its own height and created the visible gaps between slots.
      anchors[2].position.y=placed.legs.bottom;anchors[1].position.y=placed.body.bottom;anchors[0].position.y=placed.head.bottom;anchors.forEach(a=>a.userData.baseY=a.position.y);
    }
    function enforceProportions(anchors:THREE.Group[],heights:number[],widths:number[]){
      const scales=proportionScales([widths[0],widths[1],widths[2]],[heights[0],heights[1],heights[2]]);
      for(const [index,multiplier] of [[0,scales.head],[2,scales.legs]] as const){
        if(Math.abs(multiplier-1)<1e-5)continue;
        const fitted=anchors[index]?.children[0];if(!fitted)continue;
        fitted.scale.multiplyScalar(multiplier);heights[index]*=multiplier;widths[index]*=multiplier;
      }
    }
    function fit(model:THREE.Group,index:number,rotation:[number,number,number],scale:number,offset:[number,number,number]){
      const adjusted=new THREE.Group(),oriented=new THREE.Group();oriented.rotation.set(...rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);oriented.add(model);adjusted.add(oriented);oriented.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(oriented),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      if(!Number.isFinite(size.y)||size.y<.0001)throw new Error('empty');
      const width=Math.max(size.x,size.z);
      const minWidth=index===0?1.25*.5:0;
      const maxWidth=index===0?1.25*.9:targetWidths[index];
      let factor=Math.min(targetHeights[index]/size.y,maxWidth/Math.max(width,.0001))*scale;
      if(index===0&&width*factor<minWidth)factor=Math.min(minWidth/Math.max(width,.0001),targetHeights[index]/size.y)*scale;
      oriented.position.set(-center.x,-box.min.y,-center.z);adjusted.scale.setScalar(factor);adjusted.position.set(...offset);
      model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(material instanceof THREE.MeshStandardMaterial){material.metalness=0;material.roughness=THREE.MathUtils.clamp(material.roughness,.7,.85);material.needsUpdate=true;}}});
      return {object:adjusted,height:size.y*factor,width:width*factor};
    }
    function prepareGlow(anchor:THREE.Group,object:THREE.Object3D){
      const materials:THREE.MeshStandardMaterial[]=[];
      object.traverse(child=>{if(child instanceof THREE.Mesh){for(const material of Array.isArray(child.material)?child.material:[child.material])if(material instanceof THREE.MeshStandardMaterial){if(material.userData.baseEmission===undefined)material.userData.baseEmission=material.emissiveIntensity;materials.push(material);}}});
      anchor.userData.glowMaterials=materials;anchor.userData.isGlowing=false;
    }
    let updateSeams=()=>{};
    async function loadPart(anchor:THREE.Group,id:string,index:number,playerSide:boolean,heights:number[],anchors:THREE.Group[]) {
      let asset:AssetEntry={modelPath:null,scale:1,rotation:[0,0,0],offset:[0,0,0]};
      try{const response=await fetch('/assets/parts/'+id+'/manifest.json?v='+assetRevision,{signal:abort.signal,cache:'no-store'});if(!response.ok)throw new Error('manifest');asset=parseAssetEntry(await response.json());}
      catch{if(!disposed)note(id+' 素材配置未就绪，使用内置外观');}
      const override=playerSide?appearances[id]:undefined;
      if(override?.modelPath)asset={...asset,modelPath:override.modelPath,rotation:override.rotation||[0,0,0]};
      if(!asset.modelPath||disposed)return;
      let model:THREE.Group|undefined;
      try{
        model=await cloneCachedModel(asset.modelPath);if(disposed){disposeObject(model,{disposeTextures:false});return;}
        const fitted=fit(model,index,asset.rotation,asset.scale,asset.offset);
        for(const child of [...anchor.children]){anchor.remove(child);disposeObject(child,{disposeTextures:false});}anchor.add(fitted.object);prepareGlow(anchor,fitted.object);heights[index]=fitted.height;fittedWidths[index]=fitted.width;enforceProportions(anchors,heights,fittedWidths);placeSockets(anchors,heights);updateSeams();note(id+' GLB 已载入并归一化');
      }catch{if(model)disposeObject(model,{disposeTextures:false});if(!disposed)note(id+' 模型加载失败，保留内置外观');}
    }
    [player,enemy].filter(Boolean).forEach((creature,fi)=>{
      const root=new THREE.Group();root.position.x=localPositions[fi];root.rotation.y=enemy?(fi===0?1.05:-1.05):.1;
      const anchors:THREE.Group[]=[],heights=[...targetHeights];fighterAnchors.push(anchors);
      creature!.partIds.forEach((id,i)=>{
        const part=findPart(id),anchor=new THREE.Group(),fallback=proceduralPart(id,part.slot);
        const creaturePart=creature!.traits?.[i];const tint=creaturePart?.keywords.includes('灼烧')?0xd97845:creaturePart?.keywords.includes('坚壳')?0x638596:creaturePart?.keywords.includes('迅捷')?0x75c9ac:0x8eaa9a;
        fallback.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)if(mat instanceof THREE.MeshStandardMaterial){mat.color.lerp(new THREE.Color(tint),.25);if(creaturePart?.keywords.includes('灼烧')){mat.emissive.setHex(0x9d371e);mat.emissiveIntensity=.22;}}}});
        const fitted=fit(fallback,i,[0,0,0],1,[0,0,0]);anchor.add(fitted.object);prepareGlow(anchor,fitted.object);heights[i]=fitted.height;root.add(anchor);anchors.push(anchor);
        void loadPart(anchor,id,i,fi===0,heights,anchors);
      });enforceProportions(anchors,heights,fittedWidths);placeSockets(anchors,heights);
      const shadow=new THREE.Mesh(new THREE.CircleGeometry(enemy?.75:.62,32),new THREE.MeshBasicMaterial({color:0x04120f,transparent:true,opacity:.24,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.set(1,.62,1);shadow.position.y=.008;root.add(shadow);
      const seamYs=()=>{const placed=placeCreatureSlots([heights[0],heights[1],heights[2]]);return [(placed.legs.top+placed.body.bottom)/2,(placed.body.top+placed.head.bottom)/2]};
      const seams=new THREE.Group();root.add(seams);
      const buildSeams=()=>{for(const old of [...seams.children]){seams.remove(old);disposeObject(old)}const adjacentWidths=[Math.min(fittedWidths[1],fittedWidths[2]),Math.min(fittedWidths[0],fittedWidths[1])];for(const [index,y] of seamYs().entries()){const seamWidth=adjacentWidths[index];const radius=Math.max(.1,seamWidth*.52);const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.012,4,32),new THREE.MeshBasicMaterial({color:0x7bf3cf,transparent:true,opacity:.78,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=y;ring.renderOrder=2;seams.add(ring)}};buildSeams();updateSeams=buildSeams;
      scene.add(root);fighters.push(root);
    });
    const sparks=new THREE.Group();for(let i=0;i<16;i++){const spark=new THREE.Mesh(new THREE.IcosahedronGeometry(.045,0),new THREE.MeshBasicMaterial({color:0xffc269}));sparks.add(spark);}scene.add(sparks);sparks.visible=false;
    const resize=new ResizeObserver(()=>{
      if(!element.clientWidth || !element.clientHeight)return;
      renderer.setSize(element.clientWidth,element.clientHeight);camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();
    });resize.observe(element);
    const started=performance.now();let previousShake=0;let intersecting=true;let slowSince=0;let smoothApplied=false;let frameCount=0;let fpsWindow=performance.now();let lastPerf=performance.now();
    let running=document.visibilityState==='visible';
    const renderFrame=()=>{
      if(!running)return;
      const now=performance.now(),time=(now-started)/1000;dust.rotation.y=time*.012;
      const a=action.current;if(a.event && a.event.damage>0 && now-a.at<80)return;
      const duration=a.event?.hp.includes(0)?1350:850;
      const progress=Math.min(1,Math.max(0,now-a.at-80)/duration),pulse=Math.sin(progress*Math.PI);
      const shake=a.event&&a.event.damage>0?Math.sin(progress*70)*pulse*.025:0;camera.position.x+=shake-previousShake;previousShake=shake;
      fighters.forEach((f,i)=>{
        f.position.set(localPositions[i],0,0);
        f.rotation.z=0;
        f.children.slice(0,3).forEach((anchor,partIndex)=>{const active=a.event?.actor===i && a.event.slot===slots[partIndex] && progress<1;const targeted=a.event?.target===i && (a.event.targetSlot||'body')===slots[partIndex] && progress<1;anchor.rotation.z=active?Math.sin(progress*30)*pulse*.07:targeted?Math.sin(progress*45)*pulse*.1:0;anchor.rotation.x=partIndex===0?.035*Math.sin(time*1.1+i):0;if(partIndex===1)anchor.scale.y=1+.02*Math.sin(time*2.2+i);anchor.position.y=anchor.userData.baseY;if(active!==anchor.userData.isGlowing){for(const material of anchor.userData.glowMaterials as THREE.MeshStandardMaterial[]||[])material.emissiveIntensity=active?1.2:material.userData.baseEmission;anchor.userData.isGlowing=active;}});
        if(enemy && a.event) {
          const defeated=a.event.hp[i]===0;
          if(a.event.actor===i)f.position.x+=(i===0?1:-1)*pulse*.85;
          if(a.event.target===i){f.rotation.z=Math.sin(progress*26)*pulse*.11;f.position.x+=(i===0?-1:1)*pulse*.16;}
          if(defeated){f.rotation.z=(i===0?-1:1)*Math.PI*.43*progress;f.position.y=-.16*progress;}
        }
      });
      sparks.visible=Boolean(enemy && a.event && progress<1);
      if(sparks.visible && a.event){const target=localPositions[a.event.target];sparks.children.forEach((s,i)=>{s.position.set(target+Math.cos(i*2.4)*progress*1.2,1.6+Math.sin(i*1.7)*progress*1.3,Math.sin(i*2.4)*progress);s.scale.setScalar(1-progress);});}
      controls.update();renderer.render(scene,camera);
      frameCount++;
      if(now-fpsWindow>=500){
        const fps=Math.round(frameCount*1000/(now-fpsWindow));frameCount=0;fpsWindow=now;
        if(fps<30){if(!slowSince)slowSince=now;if(!smoothApplied&&now-slowSince>=3000){smoothApplied=true;renderer.setPixelRatio(1);renderer.shadowMap.enabled=false;renderer.setSize(element.clientWidth,element.clientHeight);setSmoothMode(true);}}
        else slowSince=0;
        if(perfEnabledRef.current&&now-lastPerf>=500){setPerf({fps,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});lastPerf=now;}
      }
    };
    const syncVisibility=()=>{const shouldRun=intersecting&&document.visibilityState==='visible';if(shouldRun===running)return;running=shouldRun;renderer.setAnimationLoop(running?renderFrame:null);};
    renderer.setAnimationLoop(running?renderFrame:null);
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting??true;syncVisibility();});
    observer?.observe(element);
    const onVisibility=()=>syncVisibility();document.addEventListener('visibilitychange',onVisibility);
    setReady(true);
    return()=>{disposed=true;abort.abort();observer?.disconnect();document.removeEventListener('visibilitychange',onVisibility);resize.disconnect();renderer.setAnimationLoop(null);controls.dispose();disposeObject(scene,{disposeTextures:false});renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
    // The renderer rebuilds only when equipment/assets change, not for each battle event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[identity]);
  return <div className={styles.scene}>
    <div className={styles.canvas} ref={host} />
    {smoothMode&&<span className={styles.smooth}>已切换流畅模式</span>}
    {perfEnabled&&<output className={styles.perf} aria-label="性能读数">FPS {perf.fps} · Draw calls {perf.calls} · Triangles {perf.triangles}</output>}
    {!ready && !error && <div className={styles.loading}>正在唤醒造物…</div>}
    {error && <div className={styles.fallback}>{[player,enemy].filter(Boolean).map((c,i)=><div key={i}>{c!.partIds.map(id=><img key={id} src={findPart(id).imagePath} alt={findPart(id).name}/>)}<p>{c!.name}</p></div>)}<small>{error}</small></div>}
    <span className={styles.hint}>{enemy?'遗迹竞技场':'按住拖动旋转 · 滚轮缩放'}</span>
    {assetNote && <details className={styles.note}><summary>素材状态</summary>{assetNote}</details>}
  </div>;
}
