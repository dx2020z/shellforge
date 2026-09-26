import { getIntegrationStatus } from '@/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const status = getIntegrationStatus();
  return Response.json({ deepseek: status.deepseekConfigured, tripo: status.tripoUsable, durable: status.durableStorage, version: status.version });
}
