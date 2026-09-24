// A tiny GLB fixture built from boxes. It verifies the real loader without art/API dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
const positions=new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1]);
const indices=new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,2,3,7,2,7,6,0,4,7,0,7,3,1,2,6,1,6,5]);
const bin=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(indices.buffer)]);
const json={asset:{version:'2.0',generator:'ShellForge loader acceptance fixture'},scene:0,scenes:[{nodes:[0,1,2,3]}],
 nodes:[{mesh:0,scale:[.5,.38,.4]},{mesh:1,translation:[0,0,.42],scale:[.36,.07,.08]},{mesh:0,translation:[-.35,.55,0],scale:[.1,.3,.12]},{mesh:0,translation:[.35,.55,0],scale:[.1,.3,.12]}],
 meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]},{primitives:[{attributes:{POSITION:0},indices:1,material:1}]}],
 materials:[{pbrMetallicRoughness:{baseColorFactor:[.08,.52,.83,1],metallicFactor:.4,roughnessFactor:.6},doubleSided:true},{pbrMetallicRoughness:{baseColorFactor:[.7,1,.85,1]},emissiveFactor:[.4,.9,.5]}],
 buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength,target:34962},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength,target:34963}],
 accessors:[{bufferView:0,componentType:5126,count:8,type:'VEC3',min:[-1,-1,-1],max:[1,1,1]},{bufferView:1,componentType:5123,count:indices.length,type:'SCALAR'}]};
const encoded=Buffer.from(JSON.stringify(json));const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4,0x20);encoded.copy(padded);
const header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+padded.length+8+bin.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(padded.length);jh.writeUInt32LE(0x4e4f534a,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
mkdirSync('public/assets/parts/samples',{recursive:true});writeFileSync('public/assets/parts/samples/test-head.glb',Buffer.concat([header,jh,padded,bh,bin]));
console.log('Created GLB 2.0 loader fixture, '+header.readUInt32LE(8)+' bytes');
