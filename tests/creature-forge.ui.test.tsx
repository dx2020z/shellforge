import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CreatureForge from '../src/features/forge/CreatureForge';
import { generateLocalPartDraft } from '../src/server/providers/local';

const props={
  partIds:['h01','b02','l01'] as [string,string,string],
  availablePartIds:['h01','h02','b01','b02','l01','l02'],
  disabled:false,
  tripoConfigured:false,
  deepseekConfigured:false,
  demoMode:false,
  onProjectDrafts:vi.fn(),
  onPartTask:vi.fn(),
  onApplyProject:vi.fn(),
};

beforeEach(()=>{localStorage.clear();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});

describe('CreatureForge blueprint choice',()=>{
  it('shows only unlocked parts and sends selected IDs with the one-sentence description',async()=>{
    const fetchMock=vi.fn((_input:RequestInfo|URL,_init?:RequestInit)=>new Promise<Response>(()=>{}));
    vi.stubGlobal('fetch',fetchMock);
    render(<CreatureForge {...props}/>);

    const head=await screen.findByRole('combobox',{name:'头部蓝图'});
    expect(within(head).getAllByRole('option').map(option=>option.getAttribute('value'))).toEqual(['h01','h02']);
    fireEvent.change(head,{target:{value:'h02'}});
    fireEvent.click(screen.getByRole('button',{name:'本地生成造物卡并锻造'}));

    await waitFor(()=>expect(fetchMock).toHaveBeenCalledOnce());
    const body=JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.partIds).toEqual(['h02','b02','l01']);
    expect(body.description).toMatch(/熔岩巨蟹/);
  });
});

describe('CreatureForge multiple projects',()=>{
  it('migrates the previous single-project queue without discarding unknown task IDs',async()=>{
    const old={inputs:{description:'旧造物',head:{partId:'h01',prompt:'旧造物'},body:{partId:'b02',prompt:'旧造物'},legs:{partId:'l01',prompt:'旧造物'}},drafts:null,jobs:{head:{id:'12345678-1234-1234-1234-123456789abc',partId:'h01',prompt:'old head',status:'unknown',progress:0,modelPath:null,updatedAt:1,nextPollAt:1}}};
    localStorage.setItem('shellforge.creature-forge.v1',JSON.stringify(old));
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
    render(<CreatureForge {...props}/>);
    await waitFor(()=>expect(screen.getByText(/头部:需核查/)).toBeTruthy());
    const stored=JSON.parse(localStorage.getItem('shellforge.creature-forge.v2')!);
    expect(stored.items[0].jobs.head.id).toBe(old.jobs.head.id);
  });
  it('keeps three background jobs when a second creature is started',async()=>{
    const ids=['h01','b02','l01'] as const;
    const drafts={name:'肥皂鱼',lore:'泡泡里孵出的鱼。',head:generateLocalPartDraft('肥皂鱼的头',ids[0]),body:generateLocalPartDraft('肥皂鱼的身体',ids[1]),legs:generateLocalPartDraft('肥皂鱼的脚',ids[2])};
    const fetchMock=vi.fn((input:RequestInfo|URL)=>String(input).endsWith('/creature')?Promise.resolve({ok:true,json:async()=>({drafts})} as Response):new Promise<Response>(()=>{}));
    vi.stubGlobal('fetch',fetchMock);
    render(<CreatureForge {...props} tripoConfigured/>);
    fireEvent.click(await screen.findByRole('button',{name:'本地生成造物卡并锻造'}));
    await waitFor(()=>expect(props.onProjectDrafts).toHaveBeenCalledOnce());
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.click(screen.getByRole('button',{name:'＋ 新建造物'}));
    expect(screen.getByText('造物队列 · 2')).toBeTruthy();
    const stored=JSON.parse(localStorage.getItem('shellforge.creature-forge.v2')!);
    expect(stored.items).toHaveLength(2);
    expect(Object.keys(stored.items[1].jobs)).toHaveLength(3);
    expect(Object.values(stored.items[1].jobs).every((job:any)=>job.status==='submitting')).toBe(true);
  });
});
