function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderDesignerProxyWrapper(req: Request) {
  const currentUrl = new URL(req.url);
  const designerUrl = new URL('/apps/enclosure-designer', currentUrl.origin);
  designerUrl.search = currentUrl.search;

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Design Your Custom Enclosure | Basshead Supply</title>
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        background: #050505;
      }

      body {
        overflow: hidden;
      }

      iframe {
        border: 0;
        display: block;
        width: 100vw;
        height: 100vh;
        background: #050505;
      }
    </style>
  </head>
  <body>
    <iframe
      src="${htmlEscape(designerUrl.toString())}"
      title="Basshead Supply custom enclosure designer"
      allow="clipboard-write; fullscreen; payment"
    ></iframe>
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
