(() => {
  if (window.bhsDealerDesignerBound) return;
  window.bhsDealerDesignerBound = true;
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || !event.data) return;
    const frame = Array.from(document.querySelectorAll('.bhs-dealer-designer__frame')).find(frame => frame.contentWindow === event.source);
    if (!frame) return;
    if (event.data.type === 'bhs:dealer-height' && Number.isFinite(event.data.height)) {
      frame.style.height = Math.min(15000, Math.max(850, event.data.height + 20)) + 'px';
    }
    if (event.data.type === 'bhs:dealer-cart' && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?cart$/i.test(event.data.path)) {
      location.assign(event.data.path);
    }
  });
})();
