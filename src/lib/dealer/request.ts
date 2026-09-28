import { assertActive, getShop } from './db';
import { DealerError, readSession } from './security';

export async function shopper(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new DealerError('Open the designer from your dealer’s website.', 401);
  const session = readSession(authorization.slice(7), 'shopper');
  const shop = await getShop(session.shop);
  assertActive(shop);
  return shop;
}

export function noStore(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
