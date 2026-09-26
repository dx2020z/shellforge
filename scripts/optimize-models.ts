/**
 * 把旧项目生成过的卡通模型整理成游戏可用的资产：
 * 贴图压到 1024（法线 512）并转 WebP，去掉金属度/粗糙度贴图（渲染端统一哑光），
 * 焊接顶点、轻度减面到约 1.2 万三角面。输出到 public/assets/creatures/<套装>/<槽位>.glb。
 * 用法：npx tsx scripts/optimize-models.ts（源文件在 assets-src/legacy-models/，不入库）
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'assets-src', 'legacy-models');
const OUT = join(process.cwd(), 'public', 'assets', 'creatures');
export const USE: Record<number, string> = {
  1: 'brass-bird', 6: 'iron-heron', 7: 'mantis', 8: 'lava-crab', 10: 'kelp-deer', 11: 'silver-duck', 12: 'hat-dino',
  14: 'coral', 15: 'moon-fish', 16: 'fluffy', 17: 'bull', 18: 'lizard', 19: 'blue-seahorse',
};

const index = JSON.parse(readFileSync(join(SRC, 'index.json'), 'utf8')) as { sets: { set: number; slots: Record<string, string> }[] };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

for (const [setNo, name] of Object.entries(USE)) {
  const entry = index.sets.find(s => s.set === Number(setNo));
  if (!entry) throw new Error(`缺少套装 ${setNo}`);
  mkdirSync(join(OUT, name), { recursive: true });
  for (const slot of ['head', 'body', 'legs']) {
    const doc = await io.read(join(SRC, `${entry.slots[slot]}.glb`));
    for (const material of doc.getRoot().listMaterials()) {
      material.getMetallicRoughnessTexture()?.dispose();
      material.setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(0.75);
    }
    await doc.transform(
      prune(),
      dedup(),
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.82, error: 0.001 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /^(?!normalTexture).*$/, quality: 82 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], slots: /^normalTexture$/, quality: 80 }),
      prune(),
    );
    const target = join(OUT, name, `${slot}.glb`);
    await io.write(target, doc);
    console.log(`${name}/${slot}.glb ${(statSync(target).size / 1024).toFixed(0)} KB`);
  }
}
