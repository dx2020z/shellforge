import { providerUrl, type Env } from '../config';

/** DeepSeek 调用失败的分类。只把分类暴露给客户端，不暴露上游正文。 */
export class ProviderError extends Error {
  constructor(readonly kind: 'not-configured' | 'timeout' | 'network' | 'http' | 'format', message: string) {
    super(message);
  }
}

export interface ChatJsonOptions {
  system: string;
  user: unknown;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

export function deepseekConfigured(env: Env): boolean {
  return Boolean(env.DEEPSEEK_API_KEY?.trim() && env.DEEPSEEK_MODEL?.trim());
}

function classify(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const value = error as { name?: unknown; cause?: { code?: unknown } };
  if (value?.name === 'AbortError' || value?.name === 'TimeoutError') return new ProviderError('timeout', '连接超时');
  const code = typeof value?.cause?.code === 'string' && /^[A-Z0-9_]{2,32}$/.test(value.cause.code) ? value.cause.code : '';
  if (value?.name === 'TypeError' || code) return new ProviderError('network', code ? `网络连接失败（${code}）` : '网络连接失败');
  return new ProviderError('format', '上游处理异常');
}

/** 发起一次 JSON 模式的对话请求，返回解析好的对象。 */
export async function chatJson(options: ChatJsonOptions, env: Env = process.env, http: typeof fetch = fetch): Promise<unknown> {
  if (!deepseekConfigured(env)) throw new ProviderError('not-configured', '未配置 DeepSeek');
  try {
    const response = await http(providerUrl(env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com') + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY!.trim(), 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs),
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL!.trim(),
        stream: false,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: JSON.stringify(options.user) },
        ],
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      logFailure(`HTTP ${response.status}`, body, env.DEEPSEEK_API_KEY);
      throw new ProviderError('http', `上游 HTTP ${response.status}`);
    }
    let content: unknown;
    try {
      content = JSON.parse(body)?.choices?.[0]?.message?.content;
    } catch {
      throw new ProviderError('format', '上游响应无法解析');
    }
    if (typeof content !== 'string' || !content.trim()) throw new ProviderError('format', '上游返回空内容');
    try {
      return JSON.parse(content);
    } catch {
      logFailure('内容不是 JSON', content, env.DEEPSEEK_API_KEY);
      throw new ProviderError('format', '上游 JSON 无法解析');
    }
  } catch (error) {
    throw classify(error);
  }
}

/** 仅在开发环境打印，且抹掉密钥。 */
export function logFailure(stage: string, details: unknown, key?: string) {
  if (process.env.NODE_ENV !== 'development') return;
  const raw = typeof details === 'string' ? details : details instanceof Error ? details.stack || details.message : String(details);
  const safe = (key ? raw.replaceAll(key, '[REDACTED]') : raw).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
  console.error('[DeepSeek] ' + stage + '\n' + safe.slice(0, 2000));
}
