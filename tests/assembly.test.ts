import test from 'node:test';
import assert from 'node:assert/strict';
import { placeCreatureSlots, proportionScales } from '../src/features/viewer/assembly';

test('部件按底部堆叠，脚底为零且头身脚接缝有30%重叠',()=>{
  const slots=placeCreatureSlots([.8,1.2,.9]);
  assert.equal(slots.legs.bottom,0);
  assert.equal(slots.legs.top,.9);
  assert.ok(Math.abs(slots.body.bottom-.63)<1e-9);
  assert.ok(Math.abs(slots.head.bottom-1.59)<1e-9);
});

test('统一缩放把头宽限制为身体50%-90%，腿高限制为身体60%-100%',()=>{
  const oversized=proportionScales([2,1,1],[1,1,2]);
  assert.equal(2*oversized.head,.9);
  assert.equal(2*oversized.legs,1);
  const undersized=proportionScales([.2,1,1],[1,1,.2]);
  assert.equal(.2*undersized.head,.5);
  assert.equal(.2*undersized.legs,.6);
});
