import {assertLocalRequest,readJson} from '@/server/http';
import {ENEMIES} from '@/domain/catalog';
import {generateGuardTaunt} from '@/server/providers/taunt';
export const runtime='nodejs';
export async function POST(request:Request){
 try{assertLocalRequest(request);const body=await readJson(request);const index=body.enemyIndex;
  if(typeof body.creature!=='string'||body.creature.length>24||typeof index!=='number'||!Number.isInteger(index)||index<0||index>=ENEMIES.length||!Array.isArray(body.keywords)||body.keywords.length>6||body.keywords.some((x:unknown)=>typeof x!=='string'||x.length>8))throw Error();
  return Response.json({taunt:await generateGuardTaunt({creature:body.creature,guard:ENEMIES[index].name,keywords:body.keywords as string[]})});
 }catch{return Response.json({taunt:null})}
}
