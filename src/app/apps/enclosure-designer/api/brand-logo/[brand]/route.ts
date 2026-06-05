/**
 * GET /apps/enclosure-designer/api/brand-logo/[brand]
 *
 * Fetches the EPS logo content for a given brand name from the same
 * Supabase project the calculator uses. Returns the raw EPS text so the
 * engine's 3D viewer can parse + deboss it on the enclosure baffle, same
 * as the calculator does.
 *
 * Env vars required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Both should be the same values the calculator uses (the brands table
 * + logo Storage bucket are shared). If they're missing, this route
 * returns 503 and the designer silently skips the logo render — the
 * 3D viewer still works, just no brand logo on the baffle.
 *
 * Returns:
 *   200 OK   { brand: string, eps: string }
 *   404      no logo configured for that brand
 *   503      Supabase env vars not set
 *   502      Supabase / Storage error
 */

import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brand: string }> },
) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      {
        error: 'Supabase env vars not set',
        detail:
          'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (same values as the calculator project uses).',
      },
      { status: 503 },
    );
  }

  const { brand: raw } = await params;
  const brand = decodeURIComponent(raw);

  // Look up the brand row to find logo_path. We try both `name=eq.X`
  // (exact match) — the brands table uses display names like 'Sundown Audio'.
  let brandRow: { name: string; logo_path: string | null } | null = null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/brands?name=eq.${encodeURIComponent(brand)}&select=name,logo_path`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      console.error('[brand-logo] brands lookup failed', res.status, await res.text());
      return NextResponse.json(
        { error: `Brand lookup returned ${res.status}` },
        { status: 502 },
      );
    }
    const rows = (await res.json()) as Array<{ name: string; logo_path: string | null }>;
    brandRow = rows[0] ?? null;
  } catch (err) {
    console.error('[brand-logo] brands fetch error:', err);
    return NextResponse.json(
      { error: 'Brand lookup network error' },
      { status: 502 },
    );
  }

  if (!brandRow || !brandRow.logo_path) {
    return NextResponse.json(
      { error: `No logo configured for brand: ${brand}` },
      { status: 404 },
    );
  }

  // Fetch the EPS content from Supabase Storage. The `logos` bucket is private,
  // so logo_path stores the path WITHIN the bucket (e.g. 'brands/<uuid>/<file>.eps').
  // The full storage URL is /storage/v1/object/{bucket}/{path-in-bucket}, with the
  // service-role key in the Authorization header.
  const BUCKET = 'logos';
  const logoPath = brandRow.logo_path; // e.g. 'brands/<uuid>/Sundown Audio Alligned.eps'
  // Encode each path segment so spaces / special chars survive the URL.
  const encodedPath = logoPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodedPath}`;

  let eps: string | null = null;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: 'no-store',
    });
    if (res.ok) {
      eps = await res.text();
    } else {
      console.error('[brand-logo] storage fetch failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('[brand-logo] storage fetch error:', err);
  }

  if (!eps) {
    return NextResponse.json(
      { error: 'EPS file not retrievable from Storage' },
      { status: 502 },
    );
  }

  return NextResponse.json({ brand: brandRow.name, eps });
}
