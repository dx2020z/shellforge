import { getIntegrationStatus } from '@/server/config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET() { return Response.json(getIntegrationStatus()); }
