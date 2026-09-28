'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import CustomEnclosureDesigner, { type DesignerTransport } from './CustomEnclosureDesigner';

export default function DealerDesigner() {
  const [connection, setConnection] = useState<{ token: string; parent: string } | null>(null);
  const [error, setError] = useState('');
  const bootstrap = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    const params = bootstrap.current ?? new URLSearchParams(window.location.hash.slice(1));
    bootstrap.current = params;
    const token = params.get('token'); const parent = params.get('parent');
    // Keep bearer credentials out of referrers, logs, copied URLs and browser history.
    history.replaceState(null, '', window.location.pathname);
    if (!token || !parent || window.parent === window) { setError('Open this designer from your dealer’s website.'); return; }
    let cancelled = false;
    fetch('/dealer/api/session', { headers: { Authorization: `Bearer ${token}` } }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The designer is unavailable.');
      if (!Array.isArray(data.origins) || !data.origins.includes(parent)) throw new Error('Open the designer from the connected store.');
      if (!cancelled) setConnection({ token, parent });
    }).catch(error => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, []);
  const transport = useMemo<DesignerTransport | undefined>(() => connection ? {
    request(path, init) {
      return fetch(`/dealer/api/${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${connection.token}` } });
    },
    addToCart(data) {
      return new Promise<void>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = window.setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Your cart did not respond. Please try again; your saved design will not be added twice.')); }, 30_000);
        function receive(event: MessageEvent) {
          if (event.source !== window.parent || event.origin !== connection!.parent || event.data?.type !== 'bhs:dealer-added' || event.data.requestId !== requestId) return;
          clearTimeout(timer); window.removeEventListener('message', receive);
          if (event.data.error) reject(new Error(String(event.data.error))); else resolve();
        }
        window.addEventListener('message', receive);
        window.parent.postMessage({ type: 'bhs:dealer-add', requestId, item: data.item }, connection.parent);
      });
    },
  } : undefined, [connection]);
  if (error) return <main role="alert" style={{ padding: 40 }}>{error}</main>;
  if (!transport) return <main style={{ padding: 40 }}>Connecting your store…</main>;
  return <CustomEnclosureDesigner transport={transport} />;
}
