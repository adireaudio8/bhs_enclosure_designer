function scriptValue(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }

export function renderDealerProxy(app: string, token: string, cartRoot: string): string {
  if (!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?$/i.test(cartRoot)) cartRoot = '/';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Custom enclosure designer</title><style>body{margin:0}iframe{width:100%;border:0;min-height:750px}</style></head><body>
<iframe id="designer" title="Custom enclosure designer" referrerpolicy="no-referrer"></iframe>
<script>
const app=${scriptValue(app)}, token=${scriptValue(token)}, root=${scriptValue(cartRoot)};
const frame=document.getElementById('designer');
frame.src=app+'/dealer/designer#'+new URLSearchParams({token,parent:location.origin});
let adding=false;
window.addEventListener('message',async event=>{
  if(event.source!==frame.contentWindow || event.origin!==app || !event.data) return;
  const data=event.data;
  if(data.type==='bhs:designer-resize' && Number.isFinite(data.height)) {
    const height=Math.min(15000,Math.max(750,data.height)); frame.style.height=height+'px';
    if(parent!==window) parent.postMessage({type:'bhs:dealer-height',height},location.origin);
  }
  if(data.type!=='bhs:dealer-add' || adding || typeof data.requestId!=='string') return;
  adding=true;
  try {
    if(!data.item || !/^\\d+$/.test(String(data.item.id)) || data.item.quantity!==1 || !data.item.properties?.['BHS Design']) throw Error('Invalid enclosure item.');
    const cartResponse=await fetch(root+'cart.js',{credentials:'same-origin'});
    if(!cartResponse.ok) throw Error('Your cart could not be read. Please try again.');
    const cart=await cartResponse.json();
    if(cart.currency!=='USD') throw Error('Custom enclosures are currently available in USD. Switch your store currency to USD.');
    const exists=cart.items.some(item=>String(item.variant_id)===String(data.item.id) && item.properties?.['BHS Design']===data.item.properties['BHS Design']);
    if(!exists) {
      const response=await fetch(root+'cart/add.js',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[data.item]})});
      const result=await response.json();
      if(!response.ok) throw Error(typeof result.description==='string'?result.description:'This enclosure could not be added. Please try again.');
    }
    frame.contentWindow.postMessage({type:'bhs:dealer-added',requestId:data.requestId},app);
    if(parent===window) location.assign(root+'cart');
    else parent.postMessage({type:'bhs:dealer-cart',path:root+'cart'},location.origin);
  } catch(error) {
    frame.contentWindow.postMessage({type:'bhs:dealer-added',requestId:data.requestId,error:error.message||'Unable to add this enclosure.'},app);
  } finally { adding=false; }
});
</script></body></html>`;
}
