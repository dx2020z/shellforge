import { createTask } from '@/server/model-tasks';
import { assertLocalRequest, readJson } from '@/server/http';
export const runtime='nodejs';
export async function POST(request: Request) {
  try {
    assertLocalRequest(request);const body=await readJson(request);
    if(typeof body.id!=='string' || typeof body.partId!=='string' || typeof body.prompt!=='string') throw new Error('请求缺少字段');
    return Response.json({task:await createTask({id:body.id,partId:body.partId,prompt:body.prompt},{retry:body.retry===true})});
  }catch{return Response.json({error:'无法提交此任务。若刚才请求已发送，请先查询原任务，避免重复计费。'},{status:400});}
}
