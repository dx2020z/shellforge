import { describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTask, pollTask, trustedAssetUrl, validateTaskId } from '@/server/model-tasks';
import { MemoryKV } from '@/server/store/kv';

const env = { TRIPO_API_KEY: 'k', TRIPO_MODEL: 'test-model' };
const glb = () => {
  const b = Buffer.alloc(20);
  b.write('glTF', 0, 'ascii');
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(20, 8);
  return b;
};

describe('Tripo 付费任务', () => {
  test('同一编号只提交一次；提交结果不明也不重发', async () => {
    const kv = new MemoryKV();
    let calls = 0;
    const submit = async () => {
      calls++;
      throw new Error('timeout');
    };
    const input = { id: randomUUID(), slot: 'head' as const, prompt: 'brass bird head' };
    expect((await createTask(input, { kv, env, submit })).status).toBe('unknown');
    expect((await createTask(input, { kv, env, submit })).status).toBe('unknown');
    expect(calls).toBe(1);
    await expect(createTask({ ...input, id: input.id, prompt: 'changed' }, { kv, env, submit })).rejects.toThrow();
  });

  test('只有明确 retry 才能用新编号重新提交', async () => {
    const kv = new MemoryKV();
    let calls = 0;
    const input = { id: randomUUID(), slot: 'head' as const, prompt: 'possibly submitted' };
    const uncertain = await createTask(input, { kv, env, submit: async () => { calls++; throw new Error('x'); } });
    const again = await createTask({ ...input, id: randomUUID() }, { kv, env, submit: async () => { calls++; return 't2'; } });
    expect(again.id).toBe(uncertain.id);
    const retry = await createTask({ ...input, id: randomUUID() }, { kv, env, retry: true, submit: async () => { calls++; return 't2'; } });
    expect(retry.id).not.toBe(uncertain.id);
    expect(retry.status).toBe('queued');
    expect(calls).toBe(2);
  });

  test('规范化后的相同提示词复用任务；换模型参数不复用', async () => {
    const kv = new MemoryKV();
    let calls = 0;
    const submit = async () => { calls++; return 'provider-task'; };
    const a = await createTask({ id: randomUUID(), slot: 'head', prompt: ' Brass   Bird Head ' }, { kv, env, submit });
    const b = await createTask({ id: randomUUID(), slot: 'head', prompt: 'brass bird head' }, { kv, env, submit });
    expect(b.id).toBe(a.id);
    const c = await createTask({ id: randomUUID(), slot: 'head', prompt: 'brass bird head' }, { kv, env: { ...env, TRIPO_MODEL: 'other' }, submit });
    expect(c.id).not.toBe(a.id);
    expect(calls).toBe(2);
  });

  test('提交前按槽位包裹提示词并附带反向提示词', async () => {
    let submitted = '', negative = '';
    const task = await createTask({ id: randomUUID(), slot: 'body', prompt: 'mossy round belly' }, {
      kv: new MemoryKV(), env,
      submit: async (prompt, _e, _h, neg) => { submitted = prompt; negative = neg ?? ''; return 't'; },
    });
    expect(task.status).toBe('queued');
    expect(submitted).toMatch(/headless chubby creature torso only/);
    expect(submitted).toMatch(/hand-painted texture/);
    expect(negative).toMatch(/head/);
  });

  test('未配置 Tripo 时直接失败，不调用接口', async () => {
    let calls = 0;
    const task = await createTask({ id: randomUUID(), slot: 'legs', prompt: 'x legs' }, { kv: new MemoryKV(), env: {}, submit: async () => { calls++; return 't'; } });
    expect(task.status).toBe('failed');
    expect(calls).toBe(0);
  });

  test('轮询成功后校验 GLB 并写入模型存储；节流期间不重复查询', async () => {
    const kv = new MemoryKV();
    let now = 1000, queries = 0;
    const task = await createTask({ id: randomUUID(), slot: 'head', prompt: 'coral head' }, { kv, env, now: () => now, submit: async () => 'pt' });
    const deps = {
      kv, env, now: () => now,
      query: async () => { queries++; return { taskId: 'pt', status: 'succeeded' as const, progress: 100, modelUrl: 'https://cdn.tripo3d.ai/a.glb' }; },
      download: async () => glb(),
      store: { put: async (id: string) => `/api/models/${id}` },
    };
    expect((await pollTask(task.id, deps))!.status).toBe('queued');
    expect(queries).toBe(0);
    now += 6000;
    const done = await pollTask(task.id, deps);
    expect(done!.status).toBe('succeeded');
    expect(done!.modelUrl).toBe(`/api/models/${task.id}`);
    await pollTask(task.id, deps);
    expect(queries).toBe(1);
  });

  test('下载到的不是 GLB 时标记失败', async () => {
    const kv = new MemoryKV();
    let now = 0;
    const task = await createTask({ id: randomUUID(), slot: 'head', prompt: 'bad head' }, { kv, env, now: () => now, submit: async () => 'pt' });
    now = 10000;
    const result = await pollTask(task.id, {
      kv, env, now: () => now,
      query: async () => ({ taskId: 'pt', status: 'succeeded' as const, progress: 100, modelUrl: 'https://cdn.tripo3d.ai/a.glb' }),
      download: async () => Buffer.from('not a glb at all, sorry'),
      store: { put: async () => 'x' },
    });
    expect(result!.status).toBe('failed');
  });

  test('模型下载拒绝非 HTTPS、内网和仿冒域名', () => {
    for (const url of ['http://cdn.tripo3d.ai/a.glb', 'https://127.0.0.1/a', 'https://tripo3d.ai.evil.test/a', 'https://tripo3d.com.evil.test/a.glb']) {
      expect(() => trustedAssetUrl(url, {})).toThrow();
    }
    expect(trustedAssetUrl('https://tripo-data.rg1.data.tripo3d.com/a.glb', {}).hostname).toBe('tripo-data.rg1.data.tripo3d.com');
    expect(trustedAssetUrl('https://cdn.example.org/a.glb', { TRIPO_ASSET_HOSTS: 'cdn.example.org' }).hostname).toBe('cdn.example.org');
    expect(() => validateTaskId('../../config')).toThrow();
  });
});
