import { assertLocalRequest, readJson } from '@/server/http';
import { generateCreatureDrafts, validateCreatureInputs } from '@/server/providers/creature';
export const runtime='nodejs';
export async function POST(request:Request){
  try{
    assertLocalRequest(request);
    const body=await readJson(request);
    const inputs=validateCreatureInputs(body.parts ?? body);
    return Response.json({ok:true,...await generateCreatureDrafts(inputs)});
  }catch{return Response.json({error:'请在本机页面输入造物描述或分别输入头、身体、脚的描述。'},{status:400});}
}
