import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface TextureSize { width: number; height: number }
export interface GlbMetrics { triangles: number; textures: TextureSize[] }

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function imageSize(data: Buffer): TextureSize | undefined {
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const kind = data.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8L' && data[20] === 0x2f) {
      const b1 = data[21], b2 = data[22], b3 = data[23], b4 = data[24];
      return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
    }
    if (kind === 'VP8 ' && data.length >= 30 && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
    }
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < data.length) {
      if (data[offset] !== 0xff) { offset++; continue; }
      const marker = data[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = data.readUInt16BE(offset + 2);
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return undefined;
}

export function inspectGlb(buffer: Buffer): GlbMetrics {
  if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) throw new Error('不是有效的 GLB 2.0 文件');
  let offset = 12;
  let json: Record<string, any> | undefined;
  let binary: Buffer | undefined;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(chunk.toString('utf8').replace(/\0+$/, ''));
    if (type === BIN_CHUNK) binary = chunk;
    offset += 8 + length;
  }
  if (!json) throw new Error('GLB 缺少 JSON chunk');
  const accessors = json.accessors || [];
  let triangles = 0;
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives || []) {
    const mode = primitive.mode ?? 4;
    if (![4,5,6].includes(mode)) continue;
    const count = primitive.indices === undefined ? accessors[primitive.attributes?.POSITION]?.count : accessors[primitive.indices]?.count;
    if (!Number.isInteger(count)) throw new Error('网格缺少有效 POSITION/index accessor');
    triangles += mode === 4 ? Math.floor(count / 3) : Math.max(0, count - 2);
  }
  const views = json.bufferViews || [];
  const textures: TextureSize[] = [];
  for (const image of json.images || []) {
    if (typeof image.uri === 'string' && image.uri.startsWith('data:')) {
      const match = image.uri.match(/^data:[^,]+;base64,(.*)$/);
      const size = match && imageSize(Buffer.from(match[1], 'base64'));
      if (size) textures.push(size);
      continue;
    }
    if (Number.isInteger(image.bufferView) && binary) {
      const view = views[image.bufferView];
      if (!view) throw new Error('图像 bufferView 不存在');
      const start = view.byteOffset || 0;
      const size = imageSize(binary.subarray(start, start + view.byteLength));
      if (size) textures.push(size);
    }
  }
  return { triangles, textures };
}

function findGlbs(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findGlbs(path) : entry.isFile() && entry.name.toLowerCase().endsWith('.glb') ? [path] : [];
  });
}

export function checkPublicAssets(directory = join(process.cwd(), 'public'), generatedDirectory = join(process.cwd(), '.runtime', 'models')): number {
  const files = [...findGlbs(directory), ...(existsSync(generatedDirectory) ? findGlbs(generatedDirectory) : [])].sort();
  let failed = false;
  console.log('GLB | 三角面 | 贴图(px) | 文件大小');
  for (const file of files) {
    const data = readFileSync(file);
    const { triangles, textures } = inspectGlb(data);
    const size = statSync(file).size;
    const textureText = textures.length ? textures.map(t => `${t.width}×${t.height}`).join(',') : '无';
    const flags = [triangles > 20_000 ? '超过20,000三角面' : '', size > 2 * 1024 * 1024 ? '超过2MB' : ''].filter(Boolean);
    const target = triangles > 12_000 || size > 1.5 * 1024 * 1024 || textures.some(t => t.width > 1024 || t.height > 1024) ? 'WARN目标' : 'PASS目标';
    console.log(`${relative(process.cwd(), file)} | ${triangles} | ${textureText} | ${(size / 1024).toFixed(1)} KB | ${target}${flags.length ? ' | ERROR '+flags.join(',') : ''}`);
    if (flags.length) failed = true;
  }
  if (!files.length) { console.error('public 中未找到 GLB 文件'); return 1; }
  console.log(`扫描 ${files.length} 个 GLB（public + 本地生成模型）：${failed ? '失败' : '阈值通过'}`);
  return failed ? 1 : 0;
}

const entry = process.argv[1]?.replaceAll('\\', '/');
if (entry?.endsWith('/scripts/check-assets.ts')) process.exitCode = checkPublicAssets(join(process.cwd(), 'public'));
