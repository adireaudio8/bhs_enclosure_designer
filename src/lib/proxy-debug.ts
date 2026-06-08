function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function selectedHeaders(headers: Headers) {
  const names = [
    'host',
    'referer',
    'user-agent',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-vercel-deployment-url',
    'x-vercel-id',
  ];

  return Object.fromEntries(
    names.map((name) => [name, headers.get(name) ?? '']),
  );
}

export function renderProxyDebug(req: Request, note: string) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const headers = selectedHeaders(req.headers);
  const payload = {
    note,
    observedUrl: url.toString(),
    observedPathname: url.pathname,
    shop: url.searchParams.get('shop') ?? '',
    pathPrefix: url.searchParams.get('path_prefix') ?? '',
    hasSignature: url.searchParams.has('signature'),
    query,
    headers,
  };

  console.info('[app-proxy-debug]', JSON.stringify(payload));

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BHS Enclosure Designer Proxy Debug</title>
    <style>
      body {
        margin: 0;
        background: #0b0b0b;
        color: #f4f4f4;
        font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 20px;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }

      p {
        color: #cfcfcf;
      }

      code,
      pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      pre {
        overflow: auto;
        white-space: pre-wrap;
        background: #171717;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>BHS Enclosure Designer Proxy Debug</h1>
      <p>${escapeHtml(note)}</p>
      <p>Storefront URL to test: <code>https://basshead-supply.myshopify.com/apps/enclosure-designer</code></p>
      <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    </main>
  </body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}
