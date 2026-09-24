import { generateDraft } from '@/server/providers/deepseek';
import { assertLocalRequest, readJson } from '@/server/http';
import { findPart } from '@/domain/catalog';
export const runtime='nodejs';
export async function POST(request: Request) {
  try {
    assertLocalRequest(request);
    const body=await readJson(request);
    if(typeof body.prompt!=='string' || !body.prompt.trim() || body.prompt.trim().length>120 || typeof body.partId!=='string') throw new Error('请提供部件 ID 和 1–120 字的外观描述');
    findPart(body.partId);
    return Response.json({ok:true,...await generateDraft(body.partId,body.prompt.trim())});
  } catch { return Response.json({error:'无效请求，请在本机页面选择部件并输入 1–120 字的描述'}, {status:400}); }
}
