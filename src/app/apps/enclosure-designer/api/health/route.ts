import { NextResponse } from 'next/server';
import { getEnclosureEngineRevision } from '@/lib/enclosure-engine-provenance';

export function GET() {
  return NextResponse.json({
    ok: true,
    app: 'bhs-enclosure-designer',
    engineRevision: getEnclosureEngineRevision(),
  });
}
