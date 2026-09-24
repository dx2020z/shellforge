import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GameClient from '../src/components/GameClient';
import { beginBattle, newGame, registerGeneratedParts } from '../src/domain/game';
import { mapTraits } from '../src/domain/keywords';
import type { GameSave } from '../src/domain/types';

const {sceneState}=vi.hoisted(()=>({sceneState:{throws:false}}));
vi.mock('../src/features/viewer/CreatureScene',()=>({default:()=>{if(sceneState.throws)throw new Error('mock scene failure');return <div data-testid="mock-creature-stage">3D scene mock</div>}}));
vi.mock('../src/features/viewer/PartViewer',()=>({default:()=> <div data-testid="mock-part-viewer">Part viewer mock</div>}));
vi.mock('../src/features/forge/ForgePanel',()=>({default:()=> <div>Forge panel mock</div>}));
vi.mock('../src/features/forge/CreatureForge',()=>({default:()=> <div>Creature forge mock</div>}));

function saved():GameSave{return JSON.parse(localStorage.getItem('shellforge.save.v1')||'null') as GameSave;}
function renderGame(){return render(<GameClient/>);}
async function enterBattle(){fireEvent.click(screen.getByRole('button',{name:/前往挑战/}));await screen.findByText(/第 1 回合 · 守卫意图/);}

beforeEach(()=>{
  localStorage.clear();sceneState.throws=false;
  vi.spyOn(globalThis.crypto,'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({deepseekConfigured:false,tripoConfigured:false,taunt:null}),{status:200,headers:{'Content-Type':'application/json'}})));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('GameClient keeps its viewport and tactical controls mounted',()=>{
  it('clean save opens the workshop and keeps the viewport occupied without mounting the heavy scene',async()=>{
    renderGame();
    const viewport=screen.getByRole('region',{name:'造物与战场'});
    expect(await within(viewport).findByText('Creature forge mock')).toBeTruthy();
    expect(within(viewport).queryByTestId('mock-creature-stage')).toBeNull();
    expect(viewport.textContent?.trim()).not.toBe('');
  });

  it('existing progress opens the assembly view',async()=>{
    localStorage.setItem('shellforge.save.v1',JSON.stringify(newGame()));
    renderGame();
    const viewport=screen.getByRole('region',{name:'造物与战场'});
    expect(await within(viewport).findByTestId('mock-creature-stage')).toBeTruthy();
  });

  it('searches and equips a saved self-created part independently of its blueprint',async()=>{
    const id='12345678-1234-1234-1234-123456789abc:head';
    const part={id,projectId:'12345678-1234-1234-1234-123456789abc',blueprintId:'h01',name:'肥皂鱼头',description:'会吹泡泡的鱼头',trait:mapTraits('肥皂泡泡','head'),appearance:{name:'肥皂鱼头',description:'会吹泡泡的鱼头',modelPath:null,rotation:[0,0,0] as [number,number,number]},createdAt:Date.now(),status:'design' as const};
    localStorage.setItem('shellforge.save.v1',JSON.stringify(registerGeneratedParts(newGame(),[part])));
    renderGame();
    fireEvent.change(await screen.findByRole('textbox',{name:'搜索部件库'}),{target:{value:'肥皂鱼'}});
    fireEvent.click(screen.getByRole('button',{name:/自创部件 肥皂鱼头/}));
    await waitFor(()=>expect(saved().equippedGenerated?.[0]).toBe(id));
    expect(saved().unlocked).toContain('h01');
  });

  it('starting battle shows intent and all three actions',async()=>{
    renderGame();await enterBattle();
    expect(screen.getByText(/守卫意图：/)).toBeTruthy();
    expect(screen.getByRole('button',{name:/1 · 攻击/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/2 · 守护/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/3 · 机动/})).toBeTruthy();
  });

  it('clicking attack persists one action and advances the turn',async()=>{
    renderGame();await enterBattle();fireEvent.click(screen.getByRole('button',{name:/1 · 攻击/}));
    await waitFor(()=>{expect(saved().activeBattle?.tactical?.actions).toHaveLength(1);expect(saved().activeBattle?.tactical?.turn).toBe(2)});
  });

  it('confirming abandon returns to prep without recording a loss',async()=>{
    vi.spyOn(window,'confirm').mockReturnValue(true);
    renderGame();await enterBattle();fireEvent.click(screen.getByRole('button',{name:'放弃本场战斗'}));
    await waitFor(()=>expect(saved().activeBattle).toBeNull());
    expect(saved().history).toHaveLength(0);
  });

  it('top-level keyboard action works and persists one turn',async()=>{
    renderGame();await enterBattle();fireEvent.keyDown(window,{key:'1'});
    await waitFor(()=>{expect(saved().activeBattle?.tactical?.actions).toHaveLength(1);expect(saved().activeBattle?.tactical?.turn).toBe(2)});
  });

  it('repairs stale legacy fields when tactical state exists',async()=>{
    const legacy=beginBattle(newGame(),7,'legacy-battle');
    const raw=legacy.activeBattle as GameSave['activeBattle']&{result?:string;events?:unknown[]};
    raw!.result='draw';raw!.events=[];
    localStorage.setItem('shellforge.save.v1',JSON.stringify(legacy));
    renderGame();await screen.findByText(/第 1 回合 · 守卫意图/);
    expect(saved().activeBattle?.tactical?.turn).toBe(1);
    expect(Object.hasOwn(saved().activeBattle!,'result')).toBe(false);
    expect(Object.hasOwn(saved().activeBattle!,'events')).toBe(false);
  });

  it('scene failure leaves a readable 2D battlefield and keyboard actions',async()=>{
    sceneState.throws=true;renderGame();await enterBattle();
    expect(screen.getByText(/3D 舞台暂不可用/)).toBeTruthy();
    expect(screen.getByRole('button',{name:/1 · 攻击/})).toBeTruthy();
    fireEvent.keyDown(window,{key:'1'});
    await waitFor(()=>expect(saved().activeBattle?.tactical?.turn).toBe(2));
  });

  it('invalid active battle is cleared with a visible warning',async()=>{
    const broken=beginBattle(newGame(),7,'bad-battle');
    broken.activeBattle!.tactical!.actions=['invalid' as never];
    localStorage.setItem('shellforge.save.v1',JSON.stringify(broken));
    renderGame();
    expect((await screen.findAllByText('上一场战斗已失效，已为你重置')).length).toBeGreaterThan(0);
    await waitFor(()=>expect(saved().activeBattle).toBeNull());
  });
});
