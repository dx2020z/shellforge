import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripoPartPrompt, negativePromptForSlot, tripoGenerationOptions } from '../src/server/providers/tripo';

test('Tripo 头部提示词只允许独立头部',()=>{
  const prompt=buildTripoPartPrompt('head','iron-beaked egret appearance');
  assert.match(prompt,/a single detached creature head only/);
  assert.match(prompt,/iron-beaked egret appearance/);
  assert.match(prompt,/no body, no torso, no legs, no wings/);
  assert.match(prompt,/stylized, cartoon, hand-painted texture/);
  assert.equal(negativePromptForSlot('head'),'full body, torso, legs');
});

test('Tripo 身体和腿部提示词分别禁止头部或完整生物',()=>{
  const body=buildTripoPartPrompt('body','iron shell and long neck');
  const legs=buildTripoPartPrompt('legs','thin spring legs');
  assert.match(body,/a headless creature torso only/);
  assert.match(body,/flat cut on top and bottom/);
  assert.equal(negativePromptForSlot('body'),'head, face, eyes, beak, legs');
  assert.match(legs,/only the lower limbs of a creature/);
  assert.match(legs,/a pair of legs attached to a small hip block/);
  assert.equal(negativePromptForSlot('legs'),'head, torso, full body, animal');
});

test('包裹后的提示词仍满足 Tripo 的 1024 字符上限',()=>{
  const prompt=buildTripoPartPrompt('body','x'.repeat(850));
  assert.ok(prompt.length<=1024);
  assert.equal(tripoGenerationOptions({TRIPO_MODEL:'test'},'head, face').negative_prompt,'head, face');
});
