import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getShop } from '@/lib/dealer/db';
import { readSession } from '@/lib/dealer/security';
import { SUPABASE_SERVER_KEY } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export default async function DealerHome({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const params = await searchParams;
  const configured = Boolean(SUPABASE_SERVER_KEY && process.env.DEALER_SHOPIFY_API_KEY);
  if (params.shop && configured) redirect(`/dealer/install?shop=${encodeURIComponent(params.shop)}`);
  const token = (await cookies()).get('bhs_dealer_merchant')?.value;
  let shop;
  try { if (token) shop = await getShop(readSession(token, 'merchant').shop); } catch { /* Show reconnect instructions. */ }
  return <main style={{ maxWidth: 760, margin: '60px auto', padding: 24 }}>
    <h1 style={{ fontSize: 30 }}>BHS Custom Enclosures</h1>
    {shop ? <>
      <p>{shop.name || shop.shop}</p>
      <p>{shop.status === 'active' && shop.pilot_verified ? 'Connected. Complete the checks below before accepting customer orders.' : 'Connected. BHS is preparing custom enclosure ordering for your store.'}</p>
      <ul style={{ margin: '24px 0', lineHeight: 2 }}>
        <li>Collective automatic payments: {shop.collective_payments_confirmed ? 'Confirmed' : 'Awaiting verification'}</li>
        <li>Shipping arrangement: {shop.shipping_confirmed ? 'Confirmed' : 'Awaiting verification'}</li>
        <li>Cart and order flow: {shop.pilot_verified ? 'Confirmed' : 'Awaiting pilot test'}</li>
      </ul>
      <p>Add the “BHS Custom Enclosure Designer” app block to a page in your theme editor once BHS has enabled your store.</p>
      <p>Customers add their enclosure to your regular cart and pay your store. Collective manages the supplier order and payment to BHS.</p>
    </> : !configured ? <>
      <p style={{ marginTop: 20 }}>Setup in progress</p>
      <p>BHS is preparing custom enclosure ordering for dealer stores. Store connections will be available after setup and testing are complete.</p>
      <p>Customers will design their enclosure, add it to the dealer’s regular cart, and check out with their other products. Orders will be fulfilled through Shopify Collective.</p>
    </> : <>
      <p>Connect your Shopify store to set up custom enclosures.</p>
      <form action="/dealer/install"><label>Store address <input name="shop" placeholder="your-store.myshopify.com" required style={{ border: '1px solid #888', padding: 8 }} /></label> <button type="submit">Connect store</button></form>
    </>}
  </main>;
}
