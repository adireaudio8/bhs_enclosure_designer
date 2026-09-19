import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getMerchantDesign, merchantShop } from '@/lib/dealer/merchant-designs';
import { DealerError } from '@/lib/dealer/security';

export const dynamic = 'force-dynamic';
export default async function DealerDesign({ params }: { params: Promise<{ id: string }> }) {
  const shop = await merchantShop((await cookies()).get('bhs_dealer_merchant')?.value).catch(() => null);
  if (!shop) redirect('/dealer');
  const { id } = await params;
  let design;
  try { design = await getMerchantDesign(shop.shop, id); }
  catch (error) {
    if (error instanceof DealerError && error.status === 404) notFound();
    return <main style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}><a href="/dealer/designs">Back to saved designs</a><p>This design could not be loaded. Please refresh to try again.</p></main>;
  }
  return <main style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
    <p><a href="/dealer/designs">Back to saved designs</a></p><h1>Customer enclosure design</h1>
    <p>{shop.name || shop.shop}</p><p>{design.summary}</p>
    <p>Design reference: {design.id}</p>
    <p>Saved: {new Date(design.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
    <p>Quoted retail price: {new Intl.NumberFormat('en-US', { style: 'currency', currency: design.currency }).format(design.retailPrice)}</p>
    <p>Check the matching Shopify order for payment and fulfillment status.</p>
    <h2>Customer notes</h2><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{design.customerNotes || 'No notes provided.'}</p>
    <h2>Top logo</h2><p style={{ overflowWrap: 'anywhere' }}>{design.logo.selection || 'No logo selection saved.'}</p>
    {design.logo.customRequest && <p style={{ overflowWrap: 'anywhere' }}>Custom request: {design.logo.customRequest}</p>}
    <h2>Measurements and selections</h2>
    <dl>{design.selections.map(({ label, value }) => <div key={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 0', borderBottom: '1px solid #ddd' }}><dt style={{ minWidth: 250 }}>{label}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd></div>)}</dl>
  </main>;
}
