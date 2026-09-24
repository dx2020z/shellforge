import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,beginBattle,abandonBattle} from '../src/domain/game';
import {decodeSaveResult,encodeSave} from '../src/domain/storage';

test('放弃战斗返回备战且不添加战绩或改变进度',()=>{
  const started=beginBattle(newGame(),17,'abandon-me');
  const returned=abandonBattle(started);
  assert.equal(returned.activeBattle,null);
  assert.equal(returned.history.length,0);
  assert.equal(returned.enemyIndex,started.enemyIndex);
  assert.equal(returned.generation,started.generation);
});

test('含旧结算字段的有效战术战斗被清理保留',()=>{
  const save=beginBattle(newGame(),3,'legacy-mix');
  save.activeBattle!.result='draw';save.activeBattle!.events=[];
  const repaired=decodeSaveResult(encodeSave(save));
  assert.equal(repaired.repaired,true);
  assert.equal(repaired.save.activeBattle?.tactical?.result,null);
  assert.equal(Object.hasOwn(repaired.save.activeBattle!,'result'),false);
  assert.equal(Object.hasOwn(repaired.save.activeBattle!,'events'),false);
});

test('无效战术战斗单独清除并返回明确提示',()=>{
  const save=beginBattle(newGame(),3,'broken');
  save.activeBattle!.tactical!.actions=['invalid' as never];
  const repaired=decodeSaveResult(encodeSave(save));
  assert.equal(repaired.save.activeBattle,null);
  assert.equal(repaired.battleWarning,'上一场战斗已失效，已为你重置');
});
