import * as THREE from 'three';
import type { Slot } from '../../domain/types';

function material(color: number, glow = false) {
  return new THREE.MeshStandardMaterial({color,roughness:.64,metalness:.45,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow?1.1:0});
}
function add(group: THREE.Group, geometry: THREE.BufferGeometry, color: number, position: number[], scale=[1,1,1], glow=false) {
  const mesh=new THREE.Mesh(geometry,material(color,glow));
  mesh.position.set(position[0],position[1],position[2]);mesh.scale.set(scale[0],scale[1],scale[2]);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
const orb=(r:number)=>new THREE.IcosahedronGeometry(r,1);
const box=(x:number,y:number,z:number)=>new THREE.BoxGeometry(x,y,z);
const cylinder=(r:number,h:number)=>new THREE.CylinderGeometry(r,r,h,8);
export function proceduralPart(id: string, slot: Slot) {
  const g=new THREE.Group();g.name=id;
  const copper=0xb78354, steel=0x637e81, dark=0x263f43, light=0x6fe7c2;
  if(slot==='head') {
    const color=id==='h02'?0x528b77:id==='h03'?steel:copper;
    add(g,orb(.5),color,[0,0,0],[1,.86,1]);
    add(g,box(.8,.17,.26),dark,[0,.06,.36]);
    for(const x of [-.23,.23]) add(g,box(.12,.08,.07),id==='h01'?0xffcb6d:light,[x,.06,.505],[1,1,1],true);
    if(id==='h01') {
      const beak=add(g,new THREE.ConeGeometry(.2,.55,4),0xeab96d,[0,-.07,.61]);
      beak.rotation.x=Math.PI/2;
      for(let i=0;i<3;i++)add(g,new THREE.ConeGeometry(.14,.26,4),0xcf6743,[0,.46,-.24+i*.22]);
    }else if(id==='h02') {
      add(g,orb(.52),0x466f65,[0,.13,-.1],[1.3,.6,1.2]);
      for(const x of [-.48,.48])add(g,box(.17,.54,.36),copper,[x,-.08,.13]);
    }else {
      const horn=add(g,new THREE.ConeGeometry(.24,.75,8),0xe5d5ab,[0,.05,.66]);horn.rotation.x=Math.PI/2;
      add(g,box(.64,.13,.56),0x879ca0,[0,.4,0]);
    }
  } else if(slot==='body') {
    const color=id==='b01'?0x688481:id==='b03'?0x61896e:copper;
    add(g,orb(.65),color,[0,0,0],[1.13,1,.73]);
    add(g,cylinder(.2,.25),steel,[0,.65,0]);
    add(g,cylinder(.35,.2),dark,[0,-.55,0]);
    if(id==='b02')for(const y of [-.25,0,.25]) add(g,box(1.08,.09,.18),0xe9d5aa,[0,y,.41]);
    if(id==='b01')for(const x of [-.72,.72])add(g,orb(.32),steel,[x,.12,0],[.8,1.45,1]);
    if(id==='b03')for(const x of [-.5,.5])add(g,new THREE.ConeGeometry(.18,.47,5),0x84b876,[x,.62,0]);
    add(g,new THREE.TorusGeometry(.23,.07,6,16),copper,[0,.08,.46]);
    add(g,orb(.17),light,[0,.08,.48],[1,1,.35],true);
    for(const x of [-.83,.83]){
      add(g,orb(.2),dark,[x,.15,0]);
      const arm=add(g,cylinder(.13,.55),color,[x,-.19,.03]);arm.rotation.z=x>0?.25:-.25;
      add(g,orb(.2),color,[x*1.1,-.48,.12],[1,1.2,1]);
    }
  } else {
    for(const x of [-.38,.38]) {
      const heavy=id==='l02', jump=id==='l03';
      add(g,orb(.18),steel,[x,.4,0]);
      const upper=add(g,cylinder(heavy?.22:.12,.5),heavy?steel:copper,[x,.12,-.1]);upper.rotation.x=jump?-.6:-.3;
      add(g,orb(heavy?.21:.15),dark,[x,-.12,-.12]);
      const lower=add(g,cylinder(heavy?.21:.1,.47),heavy?steel:copper,[x,-.31,0]);lower.rotation.x=.3;
      add(g,box(heavy?.55:.31,.2,heavy?.65:.56),dark,[x,-.55,.16]);
      add(g,box(.12,.07,.15),light,[x,-.52,.44],[1,1,1],true);
      if(jump){const spring=add(g,new THREE.TorusGeometry(.13,.03,5,10),light,[x,-.13,-.1]);spring.rotation.y=Math.PI/2;}
    }
  }
  return g;
}
export function disposeObject(object: THREE.Object3D, options:{disposeTextures?:boolean}={}) {
  const geometries=new Set<THREE.BufferGeometry>();const textures=new Set<THREE.Texture>();const materials=new Set<THREE.Material>();
  object.traverse(o=>{
    if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);}
  });
  for(const geometry of geometries)geometry.dispose();
  for(const mat of materials){
    if(options.disposeTextures!==false)for(const value of Object.values(mat))if(value instanceof THREE.Texture)textures.add(value);
    mat.dispose();
  }
  for(const texture of textures){texture.dispose();const image=texture.source?.data;if(typeof ImageBitmap!=='undefined' && image instanceof ImageBitmap)image.close();}
}
