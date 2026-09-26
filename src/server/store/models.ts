import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config';

/**
 * 生成模型的二进制存储。本地写 .runtime/models 并由 /api/models/[id] 提供；
 * 线上写 Vercel Blob，直接返回 CDN 公开地址，不经过函数中转。
 */
export interface ModelStore {
  put(id: string, data: Buffer): Promise<string>;
  /** 仅本地实现需要：由 API 路由读出文件。 */
  read?(id: string): Promise<Buffer>;
}

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function assertModelId(id: string): string {
  if (!ID.test(id)) throw new Error('无效模型编号');
  return id;
}

export class FileModelStore implements ModelStore {
  constructor(private root: string) {}
  async put(id: string, data: Buffer) {
    assertModelId(id);
    await mkdir(this.root, { recursive: true });
    const temp = join(this.root, `${id}.${randomUUID()}.tmp`);
    await writeFile(temp, data);
    await rename(temp, join(this.root, `${id}.glb`));
    return `/api/models/${id}`;
  }
  async read(id: string) {
    return readFile(join(this.root, `${assertModelId(id)}.glb`));
  }
}

export class BlobModelStore implements ModelStore {
  constructor(private token: string) {}
  async put(id: string, data: Buffer) {
    assertModelId(id);
    const { put } = await import('@vercel/blob');
    const result = await put(`models/${id}.glb`, data, {
      access: 'public',
      token: this.token,
      contentType: 'model/gltf-binary',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return result.url;
  }
}

let shared: ModelStore | null = null;
export function getModelStore(env: Env = process.env): ModelStore {
  if (shared) return shared;
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  shared = token
    ? new BlobModelStore(token)
    : new FileModelStore(process.env.VERCEL ? '/tmp/shellforge-models' : join(process.cwd(), '.runtime', 'models'));
  return shared;
}
export function setModelStoreForTests(store: ModelStore | null) {
  shared = store;
}
