/**
 * 预生成模型：调用 Tripo，把 src/domain/pregen-catalog.ts 里的 16 套玩家部件 + 6 套守卫外形一次性生成好。
 *
 * 用法（在项目根目录）：
 *   npx tsx scripts/pregen.ts            生成所有还没有的部件（可以随时中断，再次运行会接着来）
 *   npx tsx scripts/pregen.ts --dry      只打印将要提交的提示词，不花钱
 *   npx tsx scripts/pregen.ts --redo fox:head,g-crab:body   重做指定部件（质量不满意时）
 *   npx tsx scripts/pregen.ts --only fox,cat               只处理这些套装
 *
 * 规则：
 * - 密钥从 .env.local 读取，脚本不会打印任何密钥。
 * - 每个任务编号提交后立刻写进 assets-src/pregen/state.json；再次运行只查询、不重复提交。
 * - 提交时网络出错（不知道对方有没有收到）时绝不自动重提，标记为「不确定」，需要 --redo 才会重新提交。
 * - Tripo 明确返回失败的任务，自动再试一次。
 * - 原始模型存在 assets-src/pregen/raw/（不入库），压缩后的写进 public/assets/gen/<套装>/<槽位>.glb，
 *   清单写进 src/domain/generated-models.json。
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTripoPartPrompt, negativePromptForSlot, queryTripo, submitTripo } from '../src/server/providers/tripo';
import { PREGEN_SETS } from '../src/domain/pregen-catalog';
import type { Slot } from '../src/domain/keywords';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? '') : null;
};
const DRY = args.includes('--dry');
const ONLY = flag('--only')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const REDO = new Set(flag('--redo')?.split(',').map(s => s.trim()).filter(Boolean) ?? []);
const CONCURRENCY = 6;
const SLOTS: Slot[] = ['head', 'body', 'legs'];

const envFile = join(ROOT, '.env.local');
if (!DRY) {
  if (!existsSync(envFile)) {
    console.error('没有找到 .env.local。请先双击「启动游戏.cmd」按提示复制密钥文件，再运行本脚本。');
    process.exit(1);
  }
  process.loadEnvFile(envFile);
  if (!process.env.TRIPO_API_KEY?.trim() || !process.env.TRIPO_MODEL?.trim()) {
    console.error('.env.local 里没有配置 TRIPO_API_KEY / TRIPO_MODEL。');
    process.exit(1);
  }
}

const WORK = join(ROOT, 'assets-src', 'pregen');
const RAW = join(WORK, 'raw');
const OUT = join(ROOT, 'public', 'assets', 'gen');
const STATE_FILE = join(WORK, 'state.json');
const MANIFEST = join(ROOT, 'src', 'domain', 'generated-models.json');
mkdirSync(RAW, { recursive: true });

type JobState = { taskId?: string; status: 'pending' | 'submitted' | 'uncertain' | 'failed' | 'downloaded' | 'done'; attempts: number; error?: string };
const state: Record<string, JobState> = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = () => {
  writeFileSync(STATE_FILE + '.tmp', JSON.stringify(state, null, 2));
  renameSync(STATE_FILE + '.tmp', STATE_FILE);
};
type Manifest = { version: number; sets: Record<string, Partial<Record<Slot, { kb: number; tris: number; at: string }>>> };
const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const saveManifest = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

/** 预生成的部件颜色在描述里写明了，不要被统一的薄荷色调盖掉；底座类的腿部换一个模板。 */
function promptFor(slot: Slot, features: string, base?: boolean) {
  const prompt = base
    ? `only the lower base part of a creature, ${features}, attached under a small rounded hip block, no torso, no head, no face, flat cut on top, stylized cartoon sea creature part, hand-painted texture, soft rounded shapes, matte finish, single object, centered, front view, no text`
    : buildTripoPartPrompt(slot, features);
  return prompt.replace('warm and mint color palette', 'vivid colors exactly as described');
}

interface Job {
  key: string;
  set: string;
  slot: Slot;
  prompt: string;
  negative: string;
}
const jobs: Job[] = [];
for (const s of PREGEN_SETS) {
  if (ONLY && !ONLY.includes(s.id)) continue;
  for (const slot of SLOTS) {
    const key = `${s.id}:${slot}`;
    const out = join(OUT, s.id, `${slot}.glb`);
    if (REDO.has(key)) {
      state[key] = { status: 'pending', attempts: 0 };
      delete manifest.sets[s.id]?.[slot];
    } else if (existsSync(out) && manifest.sets[s.id]?.[slot]) continue;
    const d = s.parts[slot];
    jobs.push({ key, set: s.id, slot, prompt: promptFor(slot, d.features, d.base), negative: d.base ? 'head, torso, full body, face, pedestal, text' : negativePromptForSlot(slot) });
  }
}
saveState();

if (DRY) {
  for (const j of jobs) console.log(`\n[${j.key}]\n  ${j.prompt}\n  负面：${j.negative}`);
  console.log(`\n共 ${jobs.length} 个部件待生成（--dry 模式，没有提交任何任务）。`);
  process.exit(0);
}
if (!jobs.length) {
  console.log('所有部件都已经生成好了。要重做某个部件，用 --redo 套装:槽位。');
  process.exit(0);
}
console.log(`共 ${jobs.length} 个部件待处理，同时进行 ${CONCURRENCY} 个。可以随时关掉窗口，下次运行会接着来。\n`);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function trusted(value: string): URL {
  const url = new URL(value);
  const extra = (process.env.TRIPO_ASSET_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean);
  const h = url.hostname;
  const ok = h === 'tripo3d.ai' || h.endsWith('.tripo3d.ai') || h === 'tripo3d.com' || h.endsWith('.tripo3d.com') || extra.includes(h);
  if (url.protocol !== 'https:' || url.username || url.password || !ok) throw new Error('模型下载域名不在白名单：' + h);
  return url;
}
function assertGlb(data: Buffer): Buffer {
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) throw new Error('返回的文件不是有效 GLB 2.0');
  return data;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

async function optimize(rawPath: string, outPath: string) {
  const doc = await io.read(rawPath);
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
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      tris += Math.floor((idx ? idx.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0)) / 3);
    }
  mkdirSync(join(outPath, '..'), { recursive: true });
  await io.write(outPath, doc);
  return { kb: Math.round(statSync(outPath).size / 1024), tris };
}

let finished = 0;
const problems: string[] = [];
async function run(job: Job) {
  const st = (state[job.key] ??= { status: 'pending', attempts: 0 });
  const rawPath = join(RAW, `${job.set}-${job.slot}.glb`);
  const outPath = join(OUT, job.set, `${job.slot}.glb`);
  const log = (msg: string) => console.log(`[${job.key.padEnd(15)}] ${msg}`);
  try {
    if (st.status === 'uncertain') {
      problems.push(`${job.key}：上次提交时网络出错，不确定 Tripo 是否收到。确认后用 --redo ${job.key} 重做。`);
      return;
    }
    while (st.status === 'pending' || st.status === 'failed') {
      if (st.attempts >= 2) {
        problems.push(`${job.key}：Tripo 连续失败（${st.error ?? '未知原因'}）。可以用 --redo ${job.key} 再试。`);
        return;
      }
      st.attempts++;
      try {
        st.taskId = await submitTripo(job.prompt, process.env, fetch, job.negative);
        st.status = 'submitted';
        log('已提交');
      } catch (e) {
        const msg = (e as Error).message;
        // HTTP 4xx/5xx 是明确被拒，没有产生任务；超时或断网则不确定。
        st.status = /HTTP \d{3}|创建任务失败/.test(msg) ? 'failed' : 'uncertain';
        st.error = msg;
        saveState();
        if (st.status === 'uncertain') {
          problems.push(`${job.key}：提交时网络出错（${msg}），为避免重复扣费没有重试。用 --redo ${job.key} 重做。`);
          return;
        }
        log('提交被拒：' + msg);
        await sleep(5000);
        continue;
      }
      saveState();
    }
    if (st.status === 'submitted') {
      let last = -1;
      for (;;) {
        let t;
        try {
          t = await queryTripo(st.taskId!, process.env);
        } catch {
          await sleep(8000);
          continue;
        }
        if (t.status === 'succeeded') {
          const res = await fetch(trusted(t.modelUrl!), { signal: AbortSignal.timeout(120000) });
          if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
          writeFileSync(rawPath, assertGlb(Buffer.from(await res.arrayBuffer())));
          st.status = 'downloaded';
          saveState();
          break;
        }
        if (t.status === 'failed') {
          st.status = 'failed';
          st.error = 'Tripo 任务失败';
          saveState();
          log('Tripo 任务失败，自动再试一次');
          return run(job);
        }
        if (t.progress !== last && t.progress % 25 < 5) log(`生成中 ${t.progress}%`);
        last = t.progress;
        await sleep(6000);
      }
    }
    if (st.status === 'downloaded' || st.status === 'done' || !existsSync(outPath)) {
      if (!existsSync(rawPath)) {
        st.status = 'pending';
        saveState();
        return run(job);
      }
      const info = await optimize(rawPath, outPath);
      (manifest.sets[job.set] ??= {})[job.slot] = { ...info, at: new Date().toISOString().slice(0, 10) };
      saveManifest();
      st.status = 'done';
      saveState();
      finished++;
      log(`完成 ✓ ${info.kb} KB · ${info.tris} 面   （${finished}/${jobs.length}）`);
    }
  } catch (e) {
    problems.push(`${job.key}：${(e as Error).message}`);
    log('出错：' + (e as Error).message);
  }
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) await run(job);
  }),
);

const ready = PREGEN_SETS.filter(s => SLOTS.every(sl => manifest.sets[s.id]?.[sl]));
console.log(`\n完成 ${finished} 个部件。现在可用的套装：${ready.length}/${PREGEN_SETS.length}（${ready.map(s => s.name).join('、')}）`);
if (problems.length) {
  console.log('\n需要留意：');
  for (const p of problems) console.log(' - ' + p);
}
