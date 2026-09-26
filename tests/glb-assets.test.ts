import { expect, test } from 'vitest';
import { inspectGlb } from '../scripts/check-assets';

function glb(jsonValue: unknown, binary = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(jsonValue));
  const jsonChunk = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const binData = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4)]);
  const chunks = [Buffer.alloc(8 + jsonChunk.length)];
  chunks[0].writeUInt32LE(jsonChunk.length, 0);
  chunks[0].writeUInt32LE(0x4e4f534a, 4);
  jsonChunk.copy(chunks[0], 8);
  if (binary.length) {
    const chunk = Buffer.alloc(8 + binData.length);
    chunk.writeUInt32LE(binData.length, 0);
    chunk.writeUInt32LE(0x004e4942, 4);
    binData.copy(chunk, 8);
    chunks.push(chunk);
  }
  const total = 12 + chunks.reduce((n, x) => n + x.length, 0);
  const header = Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  return Buffer.concat([header, ...chunks]);
}

test('GLB 扫描：统计索引三角面并读取内嵌 PNG 尺寸', () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(1024, 16);
  png.writeUInt32BE(512, 20);
  const data = glb(
    {
      asset: { version: '2.0' }, buffers: [{ byteLength: 24 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 24 }],
      accessors: [{ count: 18, type: 'SCALAR' }, { count: 6, type: 'VEC3' }],
      meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 }, mode: 4 }] }],
      images: [{ bufferView: 0, mimeType: 'image/png' }],
    },
    Buffer.concat([png, Buffer.alloc(4)]),
  );
  expect(inspectGlb(data)).toEqual({ triangles: 6, textures: [{ width: 1024, height: 512 }] });
});

test('GLB 扫描：无索引三角带按 POSITION 计数', () => {
  const data = glb({ asset: { version: '2.0' }, accessors: [{ count: 8, type: 'VEC3' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 5 }] }] });
  expect(inspectGlb(data).triangles).toBe(6);
});
