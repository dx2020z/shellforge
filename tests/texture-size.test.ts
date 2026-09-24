import test from 'node:test';
import assert from 'node:assert/strict';
import { fitTextureDimensions } from '../src/features/viewer/texture-size';

test('超过1024的贴图按长边等比缩到1024',()=>{
  assert.deepEqual(fitTextureDimensions(2048,1024),{width:1024,height:512});
  assert.deepEqual(fitTextureDimensions(1600,2400),{width:683,height:1024});
});

test('不放大已经合规的贴图，并拒绝无效尺寸',()=>{
  assert.deepEqual(fitTextureDimensions(1024,512),{width:1024,height:512});
  assert.deepEqual(fitTextureDimensions(0,2048),{width:0,height:0});
});
