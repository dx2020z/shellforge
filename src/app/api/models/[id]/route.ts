import { getModel } from '@/server/model-tasks';
export const runtime='nodejs';
export async function GET(_request: Request, context: {params:Promise<{id:string}>}) {
  try {const data=await getModel((await context.params).id);return new Response(new Uint8Array(data),{headers:{'Content-Type':'model/gltf-binary','Cache-Control':'public, max-age=31536000, immutable'}});}
  catch{return Response.json({error:'模型尚未就绪或已被移除'},{status:404});}
}
