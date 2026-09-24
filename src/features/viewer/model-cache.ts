import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { versionedModelPath } from '@/assets/schema';
import { fitTextureDimensions } from './texture-size';

const parsed = new Map<string, Promise<THREE.Group>>();
const presetAssetRevision = 'round7-optimized-v1';

function sourceSize(source:unknown):{width:number;height:number}|null {
  if(!source||typeof source!=='object')return null;
  const value=source as {width?:number;height?:number;naturalWidth?:number;naturalHeight?:number};
  const width=value.naturalWidth&&value.naturalWidth>0?value.naturalWidth:value.width;
  const height=value.naturalHeight&&value.naturalHeight>0?value.naturalHeight:value.height;
  return typeof width==='number'&&typeof height==='number'?{width,height}:null;
}

/** Resize decoded GLB textures once on the cached template, before the first GPU upload. */
function capModelTextures(root:THREE.Object3D,maxEdge=1024):number {
  if(typeof document==='undefined')return 0;
  const textures=new Set<THREE.Texture>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
    }
  });
  let resized=0;
  for(const texture of textures){
    const source=texture.source?.data,size=sourceSize(source);if(!size)continue;
    const target=fitTextureDimensions(size.width,size.height,maxEdge);
    if(!target.width||(target.width===size.width&&target.height===size.height))continue;
    const canvas=document.createElement('canvas');canvas.width=target.width;canvas.height=target.height;
    const context=canvas.getContext('2d',{alpha:true});if(!context)continue;
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    try{context.drawImage(source as CanvasImageSource,0,0,target.width,target.height);}
    catch{continue;}
    texture.image=canvas;texture.needsUpdate=true;resized++;
  }
  return resized;
}

async function parseOnce(path: string): Promise<THREE.Group> {
  let pending = parsed.get(path);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(versionedModelPath(path, presetAssetRevision), { cache: 'force-cache' });
      if (!response.ok) throw new Error(`GLB ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 40 * 1024 * 1024) throw new Error('GLB 超过 40 MB');
      const manager = new THREE.LoadingManager();
      manager.setURLModifier(url => {
        if (!url.startsWith('blob:') && !url.startsWith('data:')) throw new Error('GLB 必须内嵌贴图');
        return url;
      });
      const scene=(await new GLTFLoader(manager).parseAsync(buffer, '')).scene;
      scene.userData.resizedTextures=capModelTextures(scene);
      return scene;
    })();
    parsed.set(path, pending);
    pending.catch(() => { if (parsed.get(path) === pending) parsed.delete(path); });
  }
  return pending;
}

/** Fetch and parse each URL once; render independent geometry/material clones. Textures stay shared. */
export async function cloneCachedModel(path: string): Promise<THREE.Group> {
  const template = await parseOnce(path);
  const clone = template.clone(true);
  clone.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
  });
  return clone;
}
