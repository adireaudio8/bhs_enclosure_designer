import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { listMerchantDesigns, merchantShop } from '@/lib/dealer/merchant-designs';

export const dynamic = 'force-dynamic';
export default async function DealerDesigns({ searchParams }: { searchParams: Promise<{ page?: string; reference?: string }> }) {
  const token = (await cookies()).get('bhs_dealer_merchant')?.value;
  const shop = await merchantShop(token).catch(() => null);
  if (!shop) redirect('/dealer');
  const params = await searchParams;
  if (params.reference) redirect(`/dealer/designs/${encodeURIComponent(params.reference.trim())}`);
  const page = Number(params.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 2000) redirect('/dealer/designs');
  const result = await listMerchantDesigns(shop.shop, page).catch(() => null);
  return <main style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
    <p><a href="/dealer">Back to store setup</a></p>
    <h1>Saved customer designs</h1><p>{shop.name || shop.shop}</p>
    <p>Use the BHS Design reference on a Shopify order to find its measurements, options and customer notes. Check the matching Shopify order for payment and fulfillment status.</p>
    <form action="/dealer/designs"><label>Design reference <input name="reference" required maxLength={36} style={{ border: '1px solid #888', padding: 8 }} /></label> <button type="submit">Find design</button></form>
    {!result ? <p>Designs could not be loaded. Please refresh to try again.</p> : <>
      {!result.designs.length ? <p>No saved designs on this page.</p> : <ul style={{ lineHeight: 1.8 }}>{result.designs.map(design => <li key={design.id} style={{ marginTop: 20 }}>
        <a href={`/dealer/designs/${design.id}`}>{design.summary || design.id}</a><br />
        <small>{design.id} · {new Date(design.createdAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC · {new Intl.NumberFormat('en-US', { style: 'currency', currency: design.currency }).format(design.retailPrice)}</small>
      </li>)}</ul>}
      <nav style={{ display: 'flex', gap: 24, marginTop: 24 }} aria-label="Design pages">
        {page > 1 && <a href={`/dealer/designs?page=${page - 1}`}>Newer designs</a>}
        {result.hasMore && page < 2000 && <a href={`/dealer/designs?page=${page + 1}`}>Older designs</a>}
      </nav>
    </>}
  </main>;
}
