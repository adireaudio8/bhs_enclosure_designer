function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type ProxyWrapperOptions = {
  topLevelRedirectPath?: string;
};

export function renderDesignerProxyWrapper(
  req: Request,
  options: ProxyWrapperOptions = {},
) {
  const currentUrl = new URL(req.url);
  const designerUrl = new URL('/apps/enclosure-designer', currentUrl.origin);
  designerUrl.search = currentUrl.search;
  const checkoutNavigationScript = `<script>
      (function() {
        var designerOrigin = ${JSON.stringify(designerUrl.origin)};
        var resizeMessage = 'bhs:designer-resize';
        var minimumHeight = 480;
        var maximumHeight = 12000;
        function checkoutUrl(value) {
          try {
            var target = new URL(value);
            if (target.protocol !== 'https:') return null;
            if (
              target.hostname === 'bassheadsupply.com' ||
              target.hostname === 'www.bassheadsupply.com' ||
              target.hostname === 'shopify.com' ||
              target.hostname.endsWith('.myshopify.com') ||
              target.hostname.endsWith('.shopify.com')
            ) {
              return target.href;
            }
          } catch (error) {
            return null;
          }
          return null;
        }

        window.addEventListener('message', function(event) {
          if (event.origin !== designerOrigin) return;
          var data = event.data || {};
          if (data.type === resizeMessage) {
            var height = Math.ceil(Number(data.height));
            if (!Number.isFinite(height) || height < minimumHeight || height > maximumHeight) return;
            var designerFrame = document.getElementById('bhs-designer-frame');
            if (!designerFrame) return;
            designerFrame.style.height = height + 'px';
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: resizeMessage, height: height }, '*');
            }
            return;
          }
          if (data.type !== 'bhs:navigate-top' || typeof data.url !== 'string') return;
          var target = checkoutUrl(data.url);
          if (!target) return;
          window.top.location.assign(target);
        });
      })();
    </script>`;
  const topLevelRedirectScript = options.topLevelRedirectPath
    ? `<script>
      if (window.top === window.self) {
        window.location.replace(${JSON.stringify(options.topLevelRedirectPath)});
      }
    </script>`
    : '';

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
        overflow: hidden;
      }

      iframe {
        border: 0;
        display: block;
        width: 100vw;
        height: 100vh;
        min-height: 480px;
        background: #050505;
      }
    </style>
    ${checkoutNavigationScript}
    ${topLevelRedirectScript}
  </head>
  <body>
    <iframe
      id="bhs-designer-frame"
      src="${htmlEscape(designerUrl.toString())}"
      title="Basshead Supply custom enclosure designer"
      allow="clipboard-write; fullscreen; payment"
      scrolling="no"
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
