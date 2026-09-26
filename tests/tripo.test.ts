import { expect, test } from 'vitest';
import { buildTripoPartPrompt, negativePromptForSlot, parseTripoTask, tripoGenerationOptions } from '@/server/providers/tripo';

test('头部提示词只允许独立头部', () => {
  const prompt = buildTripoPartPrompt('head', 'brass beak');
  expect(prompt).toMatch(/single cute creature head only/);
  expect(prompt).toMatch(/face fully visible/);
  expect(prompt).toMatch(/no body, no torso, no legs/);
  expect(negativePromptForSlot('head')).toMatch(/full body/);
});
test('身体和腿部分别禁止头部或完整生物', () => {
  expect(buildTripoPartPrompt('body', 'moss')).toMatch(/no head, no neck, no arms, no legs/);
  expect(buildTripoPartPrompt('legs', 'spring')).toMatch(/no torso, no head/);
  expect(negativePromptForSlot('legs')).toMatch(/full body/);
});
test('包裹后的提示词不超过 Tripo 的 1024 字符上限，并统一卡通风格', () => {
  const prompt = buildTripoPartPrompt('body', 'x'.repeat(2000));
  expect(prompt.length).toBeLessThanOrEqual(1024);
  expect(prompt).toMatch(/stylized cartoon/);
});
test('生成参数：面数上限 1.2 万', () => {
  expect(tripoGenerationOptions({ TRIPO_MODEL: 'm' }).face_limit).toBe(12000);
});
test('只接受数字成功码，并区分排队、失败与完成', () => {
  expect(() => parseTripoTask({ code: '0', data: { task_id: 't', status: 'success' } })).toThrow();
  expect(parseTripoTask({ code: 0, data: { task_id: 't', status: 'queued', progress: 0 } }).status).toBe('queued');
  expect(parseTripoTask({ code: 0, data: { task_id: 't', status: 'running', progress: 40 } }).progress).toBe(40);
  expect(parseTripoTask({ code: 0, data: { task_id: 't', status: 'failed' } }).status).toBe('failed');
  expect(() => parseTripoTask({ code: 0, data: { task_id: 't', status: 'success', output: {} } })).toThrow();
  expect(parseTripoTask({ code: 0, data: { task_id: 't', status: 'success', output: { model_url: 'https://cdn.tripo3d.ai/a.glb' } } }).status).toBe('succeeded');
});
