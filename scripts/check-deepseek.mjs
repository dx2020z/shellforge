import nextEnv from '@next/env';
import { performance } from 'node:perf_hooks';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const key = process.env.DEEPSEEK_API_KEY?.trim();
const configuredModel = process.env.DEEPSEEK_MODEL?.trim();
const base = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/$/, '');
if (!key || !configuredModel) {
  console.error('缺少 DEEPSEEK_API_KEY 或 DEEPSEEK_MODEL；请检查项目 .env.local，不要把密钥发到聊天。');
  process.exit(2);
}

const sampleParts = { head: '鸭子的头', body: '恐龙的身体', legs: '猴子的尾巴' };
const request = {
  model: configuredModel,
  stream: false,
  thinking: { type: 'disabled' },
  response_format: { type: 'json_object' },
  temperature: 0.2,
  max_tokens: 1000,
  messages: [
    { role: 'system', content: 'Return exactly one JSON object with this outer structure: {"name":"鸭恐猴","lore":"...","parts":{"head":{"title":"...","description":"...","visualPrompt":"...","keywords":["穿刺"],"cost":null,"reasons":[{"keyword":"穿刺","quote":"鸭子","why":"鸭喙坚硬，适合穿刺"}]},"body":{"title":"...","description":"...","visualPrompt":"...","keywords":["坚壳"],"cost":null,"reasons":[{"keyword":"坚壳","quote":"恐龙","why":"恐龙体型具有防护优势"}]},"legs":{"title":"...","description":"...","visualPrompt":"...","keywords":["迅捷"],"cost":null,"reasons":[{"keyword":"迅捷","quote":"猴子","why":"猴子动作灵活敏捷"}]}}}. Do not omit name or lore. Every part has exactly title:string, description:string, visualPrompt:string, keywords:string[], cost:null|string, reasons:array of objects shaped as {"keyword":"穿刺","quote":"鸭子","why":"鸭喙适合穿刺攻击"}; never return strings in reasons. Exact allowed keywords only: head 灼烧/穿刺/连击/震慑/吞噬; body 坚壳/反射/再生/膨胀/蓄能; legs 迅捷/潜行/跃击/吸附/回旋. The supplied text is the sole source of truth: do not invent any power, material, action, or visual feature. For head “鸭子的头”, valid details include duck/beak only: do not add fire, heat, slime, or burning. Each reason quote must be copied character-for-character from that slot source as a continuous substring, never from your generated description. Cost is null unless source explicitly supports one. Reasons must explain how the quoted original text supports that exact skill. No markdown.' },
    { role: 'user', content: JSON.stringify({ fullDescription: null, parts: sampleParts }) },
  ],
};
const started = performance.now();
let response;
let raw = '';
try {
  response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(35000),
  });
  raw = await response.text();
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`DeepSeek request failed | configuredModel=${configuredModel} | elapsedMs=${Math.round(performance.now()-started)} | ${message.replaceAll(key,'[REDACTED]')}`);
  process.exit(1);
}

const elapsedMs = Math.round(performance.now() - started);
const redact = value => value.replaceAll(key, '[REDACTED]').replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
let envelope;
try { envelope = JSON.parse(raw); } catch { /* keep raw sample for diagnosis */ }
const actualModel = typeof envelope?.model === 'string' ? envelope.model : '(no model field)';
let content = envelope?.choices?.[0]?.message?.content;
let parsed;
let schema = 'FAIL';
let schemaReason = 'response is not OpenAI-compatible JSON';
if (typeof content === 'string') {
  try {
    parsed = JSON.parse(content);
    const allowed = { head:['灼烧','穿刺','连击','震慑','吞噬'], body:['坚壳','反射','再生','膨胀','蓄能'], legs:['迅捷','潜行','跃击','吸附','回旋'] };
    const validPart = (part, slot) => part && typeof part === 'object'
      && typeof part.title === 'string' && part.title.trim().length > 0
      && typeof part.description === 'string' && part.description.trim().length > 0
      && typeof part.visualPrompt === 'string' && part.visualPrompt.trim().length > 0
      && Array.isArray(part.keywords) && part.keywords.length > 0 && part.keywords.length <= 2 && part.keywords.every(x => allowed[slot].includes(x))
      && (part.cost === null || ['迟缓','易燃','骄傲','脆壳','贪食'].includes(part.cost))
      && Array.isArray(part.reasons) && part.reasons.every(x => x && typeof x.keyword === 'string' && typeof x.quote === 'string' && sampleParts[slot].includes(x.quote) && typeof x.why === 'string')
      && part.keywords.every(keyword => part.reasons.some(reason => reason.keyword === keyword))
      && (part.cost === null || part.reasons.some(reason => reason.keyword === part.cost));
    const data = parsed?.parts && typeof parsed.parts === 'object' ? parsed.parts : parsed;
    const valid = parsed && typeof parsed.name === 'string' && typeof parsed.lore === 'string'
      && ['head','body','legs'].every(slot => validPart(data?.[slot], slot));
    if (valid) { schema = 'PASS'; schemaReason = 'name/lore + three parts with title, description, visualPrompt, keywords, reasons'; }
    else {
      const badSlot = ['head','body','legs'].find(slot => !validPart(data?.[slot], slot));
      const part = data?.[badSlot];
      schemaReason = badSlot
        ? `${badSlot}: fields/keyword/reason invalid; quote=${JSON.stringify(part?.reasons?.map(x => x.quote) ?? null)}`
        : 'name/lore invalid';
    }
  } catch { schemaReason = 'choices[0].message.content is not valid JSON'; }
}

console.log(`configuredModel=${configuredModel}`);
console.log(`actualModel=${actualModel}`);
console.log(`httpStatus=${response.status}`);
console.log(`elapsedMs=${elapsedMs}`);
console.log(`schema=${schema} (${schemaReason})`);
console.log(`rawFirst500=${redact((content ?? raw).slice(0,500))}`);
if (!response.ok || schema !== 'PASS') process.exitCode = 1;
