import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGlb } from '../scripts/check-assets';
import { versionedModelPath } from '../src/assets/schema';

function glb(jsonValue: unknown, binary = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(jsonValue));
  const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const binChunkData = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const chunks = [Buffer.alloc(8 + jsonChunk.length)];
  chunks[0].writeUInt32LE(jsonChunk.length, 0); chunks[0].writeUInt32LE(0x4e4f534a, 4); jsonChunk.copy(chunks[0], 8);
  if (binary.length) { const chunk=Buffer.alloc(8+binChunkData.length);chunk.writeUInt32LE(binChunkData.length,0);chunk.writeUInt32LE(0x004e4942,4);binChunkData.copy(chunk,8);chunks.push(chunk); }
  const total=12+chunks.reduce((n,x)=>n+x.length,0),header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);
  return Buffer.concat([header,...chunks]);
}

test('GLB scanner counts indexed triangles and reads embedded PNG dimensions',()=>{
  const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1024,16);png.writeUInt32BE(512,20);
  const data=glb({asset:{version:'2.0'},buffers:[{byteLength:24}],bufferViews:[{buffer:0,byteOffset:0,byteLength:24}],accessors:[{count:18,type:'SCALAR'},{count:6,type:'VEC3'}],meshes:[{primitives:[{indices:0,attributes:{POSITION:1},mode:4}]}],images:[{bufferView:0,mimeType:'image/png'}]},Buffer.concat([png,Buffer.alloc(4)]));
  assert.deepEqual(inspectGlb(data),{triangles:6,textures:[{width:1024,height:512}]});
});

test('GLB scanner counts non-indexed triangle strips from POSITION accessors',()=>{
  const data=glb({asset:{version:'2.0'},accessors:[{count:8,type:'VEC3'}],meshes:[{primitives:[{attributes:{POSITION:0},mode:5}]}]});
  assert.equal(inspectGlb(data).triangles,6);
});

test('preset GLB cache URLs change with the manifest revision while unique generated URLs stay stable',()=>{
  assert.equal(versionedModelPath('/assets/parts/h01/model.glb','round7-optimized-v1'),'/assets/parts/h01/model.glb?v=round7-optimized-v1');
  assert.equal(versionedModelPath('/api/models/12345678-1234-1234-1234-123456789abc','round7-optimized-v1'),'/api/models/12345678-1234-1234-1234-123456789abc');
});
