import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getShop } from '@/lib/dealer/db';
import { readSession } from '@/lib/dealer/security';
import { SUPABASE_SERVER_KEY } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export default async function DealerHome({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  const params = await searchParams;
  const configured = Boolean(SUPABASE_SERVER_KEY && process.env.DEALER_SHOPIFY_API_KEY);
  const pilot = Boolean(process.env.DEALER_ALLOWED_SHOPS?.trim());
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
      <p><a href="/dealer/designs">View saved customer designs and notes</a></p>
      <h2 style={{ marginTop: 24 }}>Add the designer to your website</h2>
      <ol style={{ lineHeight: 1.8 }}>
        <li>In Shopify, open Online Store → Themes, duplicate your current theme, and choose Edit theme for the unpublished copy.</li>
        <li>Use the template selector to create a page template for custom enclosures.</li>
        <li>Choose Add section → Apps → BHS Custom Enclosures.</li>
        <li>Save the template, then assign it to your custom-enclosure page under Online Store → Pages.</li>
        <li>Preview the page with BHS after your Collective products, shipping and automatic payments are configured. Add the page to your store navigation once the order test passes.</li>
      </ol>
      <p>Customers add their enclosure to your regular cart and pay your store. Collective manages the supplier order and payment to BHS.</p>
    </> : !configured ? <>
      <p style={{ marginTop: 20 }}>Setup in progress</p>
      <p>BHS is preparing custom enclosure ordering for dealer stores. Store connections will be available after setup and testing are complete.</p>
      <p>Customers will design their enclosure, add it to the dealer’s regular cart, and check out with their other products. Orders will be fulfilled through Shopify Collective.</p>
    </> : <>
      <p>Open {pilot ? 'BHS Dealer SSA Pilot' : 'BHS Dealer Enclosure Designer'} from Apps in your Shopify admin.</p>
      <p>{pilot ? 'This private pilot is available to Sound Solutions Audio through the installation link provided by BHS. Ordering stays disabled until Collective setup and testing are complete.' : 'New installations will be available through our Shopify App Store listing after review. Contact BHS for onboarding and Collective setup.'}</p>
      <p><a href="https://admin.shopify.com/">Open Shopify admin</a></p>
    </>}
  </main>;
}
