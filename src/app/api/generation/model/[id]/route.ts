import { pollTask } from '@/server/model-tasks';
import { assertLocalRequest } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request: Request, context: {params:Promise<{id:string}>}) {
  try {assertLocalRequest(request);return Response.json({task:await pollTask((await context.params).id)});}
  catch{return Response.json({error:'找不到任务或暂时无法查询，请检查服务端任务记录。'},{status:404});}
}
