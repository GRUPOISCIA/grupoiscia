const PER_PAGE=16;
const absUrl=u=>(u&&!/^(https?:|data:|\/)/i.test(u))?"/"+u:u;
const state={products:[],category:"",page:1,cart:JSON.parse(localStorage.getItem("computec_cart")||"[]")};
const $=s=>document.querySelector(s);
const PLACEHOLDER='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="100%" height="100%" fill="#f6f8fb"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle">Sin imagen</text></svg>');

document.addEventListener("DOMContentLoaded",()=>{
  loadProducts();renderCart();initDetail();
  $("#searchInput").addEventListener("input",()=>{state.page=1;renderProducts()});
  $("#categoryList").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(!b)return;state.category=b.dataset.cat;state.page=1;renderProducts()});
  $("#pagination").addEventListener("click",e=>{const b=e.target.closest("button[data-page]");if(b&&!b.disabled)goToPage(+b.dataset.page)});
  $("#openCart").onclick=openCart;$("#closeCart").onclick=closeCart;$("#cartOverlay").onclick=closeCart;$("#checkout").onclick=checkout;
  window.addEventListener("scroll",()=>$("#top").classList.toggle("show",scrollY>450));
  $("#top").onclick=()=>scrollTo({top:0,behavior:"smooth"});
});

async function loadProducts(){
  try{
    const r=await fetch("/api/productos/",{cache:"no-store"});
    if(!r.ok)throw Error();
    const data=await r.json();
    if(data.error)throw Error(data.error);
    state.products=(Array.isArray(data)?data:(data.products||[])).map(p=>({...p,image:absUrl(p.image)}));
    initBanners(Array.isArray(data)?[]:(data.banners||[]));
    syncCartWithStock();
    renderProducts();
  }catch(e){
    $("#productsGrid").innerHTML='<div class="loading">No fue posible cargar el catálogo. Revisa la conexión con la base de datos.</div>';
    initBanners([]);
  }
}

/* ---------- Banners ---------- */
function initBanners(banners){
  const track=$("#promoTrack"),dots=$("#promoDots"),slider=$("#promoSlider");
  if(!banners.length){
    track.innerHTML='<div class="promo-placeholder"><strong>Aquí van tus promociones</strong><small>Sube imágenes a la carpeta img/banners/</small></div>';
    slider.classList.add("single");return;
  }
  track.innerHTML=banners.map((s,i)=>`<a class="promo-slide" href="#productos"><img src="${esc(s)}" alt="Promoción ${i+1}"${i?' loading="lazy"':''}></a>`).join("");
  dots.innerHTML=banners.map((_,i)=>`<button data-i="${i}" aria-label="Ir al banner ${i+1}"></button>`).join("");
  if(banners.length===1)slider.classList.add("single");
  let idx=0,timer;
  const go=n=>{idx=(n+banners.length)%banners.length;track.style.transform=`translateX(-${idx*100}%)`;dots.querySelectorAll("button").forEach((b,i)=>b.classList.toggle("active",i===idx))};
  const play=()=>{clearInterval(timer);if(banners.length>1)timer=setInterval(()=>go(idx+1),5000)};
  $("#promoPrev").onclick=()=>{go(idx-1);play()};
  $("#promoNext").onclick=()=>{go(idx+1);play()};
  dots.onclick=e=>{const b=e.target.closest("button");if(b){go(+b.dataset.i);play()}};
  slider.onmouseenter=()=>clearInterval(timer);slider.onmouseleave=play;
  go(0);play();
}

/* ---------- Catálogo ---------- */
function productCard(p){
  const stock=Number(p.stock)||0,sj=isSujeto(p),out=!sj&&stock<=0;
  const tag=p.etiqueta?`<span class="pcard-badge">${esc(p.etiqueta)}</span>`:"";
  const sku=p.sku?"SKU: "+esc(p.sku):"&nbsp;";
  const low=!out&&stock<=5;
  const units=stock>=10?"+10 unidades":low?`Últimas ${stock} pieza${stock===1?"":"s"}`:`${stock} unidades`;
  const btn=out
    ?'<button type="button" class="pcard-add" disabled aria-label="Agotado"><i class="fa fa-cart-plus"></i></button>'
    :`<button type="button" class="pcard-add" onclick="addToCart(${p.id})" aria-label="Agregar al carrito: ${esc(p.name)}" title="Agregar al carrito"><i class="fa fa-cart-plus"></i></button>`;
  const status=sj?'<div class="pcard-stock sujeto"><span class="pcard-dot"></span><span>Sujeto a disponibilidad</span></div>':out
    ?'<div class="pcard-stock out"><span class="pcard-dot"></span><span>Agotado por ahora</span></div>'
    :`<div class="pcard-stock"><span class="pcard-dot"></span><span>Entrega inmediata</span><span class="pcard-sep"></span><span class="pcard-units${low?" low":""}">${units}</span></div>`;
  return `<article class="pcard${out?" is-soldout":""}" data-id="${p.id}"><div class="pcard-media"><img loading="lazy" src="${esc(p.image||PLACEHOLDER)}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">${tag}${out?'<span class="pcard-soldout">Agotado</span>':""}</div><div class="pcard-body"><h3 class="pcard-title" title="${esc(p.name)}">${esc(p.name)}</h3><div class="pcard-sku">${sku}</div><div class="pcard-buy"><span class="pcard-price">${money(p.price)}</span>${btn}</div><div class="pcard-foot">${status}</div></div></article>`;
}

function renderCategories(){
  const counts={};state.products.forEach(p=>counts[p.category]=(counts[p.category]||0)+1);
  const cats=Object.keys(counts).sort((a,b)=>a.localeCompare(b,"es"));
  const item=(v,l,n)=>`<li><button data-cat="${esc(v)}" class="${state.category===v?"active":""}"><span>${esc(l)}</span><span class="count">${n}</span></button></li>`;
  $("#categoryList").innerHTML=item("","Todas",state.products.length)+cats.map(c=>item(c,c,counts[c])).join("");
}

function renderProducts(){
  const q=$("#searchInput").value.toLowerCase().trim(),cat=state.category;
  const list=state.products.filter(p=>(!cat||p.category===cat)&&(!q||(`${p.name} ${p.description} ${p.category}`).toLowerCase().includes(q)));
  const sellable=p=>p.stock>0||isSujeto(p);const avail=list.filter(sellable),out=list.filter(p=>!sellable(p));
  $("#resultsCount").textContent=list.length?`${list.length} producto${list.length===1?"":"s"}`:"";
  const pages=Math.max(1,Math.ceil(avail.length/PER_PAGE));
  state.page=Math.min(Math.max(1,state.page||1),pages);
  const pageItems=avail.slice((state.page-1)*PER_PAGE,state.page*PER_PAGE);
  $("#productsGrid").innerHTML=avail.length?pageItems.map(productCard).join(""):`<div class="empty">${list.length?"No hay productos disponibles en esta categoría por ahora.":"No encontramos productos con esos criterios."}</div>`;
  $("#soldOutGrid").innerHTML=out.map(productCard).join("");
  $("#soldOutBlock").hidden=!out.length||state.page<pages;
  renderPagination(pages);
  renderCategories();
}


/* ---------- Paginación ---------- */
function renderPagination(pages){
  const nav=$("#pagination");if(!nav)return;
  if(pages<=1){nav.hidden=true;nav.innerHTML="";return}
  const cur=state.page;
  let nums=[];
  if(pages<=7){for(let i=1;i<=pages;i++)nums.push(i)}
  else{
    nums=[1];
    if(cur>3)nums.push("…");
    for(let i=Math.max(2,cur-1);i<=Math.min(pages-1,cur+1);i++)nums.push(i);
    if(cur<pages-2)nums.push("…");
    nums.push(pages);
  }
  const btn=(p,label,dis,act,aria)=>`<button type="button" data-page="${p}"${dis?" disabled":""}${act?' class="active" aria-current="page"':""}${aria?` aria-label="${aria}"`:""}>${label}</button>`;
  nav.innerHTML=btn(cur-1,"&laquo;",cur===1,false,"Página anterior")
    +nums.map(n=>n==="…"?'<span class="dots">…</span>':btn(n,n,false,n===cur,"Página "+n)).join("")
    +btn(cur+1,"&raquo;",cur===pages,false,"Página siguiente");
  nav.hidden=false;
}
function goToPage(p){
  state.page=p;renderProducts();
  const t=$(".shop-tools");if(t)t.scrollIntoView({behavior:"smooth",block:"start"});
}

/* ---------- Detalle de producto ---------- */
const detalle={p:null,qty:1};
function initDetail(){
  const d=$("#dProducto");if(!d)return;
  document.addEventListener("click",e=>{
    const card=e.target.closest(".pcard");
    if(!card||!card.closest("#productsGrid,#soldOutGrid")||e.target.closest("button"))return;
    openDetail(card.dataset.id);
  });
  $("#productoCantidadMenos").onclick=()=>setQty(detalle.qty-1);
  $("#productoCantidadMas").onclick=()=>setQty(detalle.qty+1);
  $("#productoCantidad").addEventListener("change",e=>setQty(parseInt(e.target.value,10)));
  $("#productoAgregarCarrito").onclick=()=>{if(!detalle.p)return;addToCart(detalle.p.id,detalle.qty);closeDetail()};
  document.querySelector("[data-cerrar-producto]").onclick=closeDetail;
  d.addEventListener("click",e=>{if(e.target===d)closeDetail()});
  d.addEventListener("close",()=>{detalle.p=null});
}
function openDetail(id){
  const p=state.products.find(x=>x.id==id);if(!p)return;
  detalle.p=p;detalle.qty=1;
  const sj=isSujeto(p),out=!sj&&p.stock<=0;
  $("#productoDetalleCategoria").textContent=p.category||"";
  $("#productoDetalleTitulo").textContent=p.name;
  const sku=$("#productoDetalleSku");sku.textContent=p.sku?"Clave: "+p.sku:"";sku.hidden=!p.sku;
  $("#productoDetalleDescripcion").textContent=p.description||"Este producto no cuenta con una descripción adicional.";
  $("#productoDetallePrecio").textContent=money(p.price);
  const st=$("#productoDetalleStock");st.classList.toggle("agotado",out);
  if(sj){st.innerHTML='<span class="disp-pill ambar"><span class="dot"></span>Sujeto a disponibilidad</span>'}else{st.textContent=out?"Agotado por ahora":"Disponible · "+p.stock+" pieza"+(p.stock===1?"":"s")}
  const av=$("#productoDetalleAviso");if(av){av.hidden=!sj;const wa=$("#productoDetalleWa");if(wa)wa.href=waLink(p)}
  const img=$("#productoDetalleImagen");
  img.onerror=()=>{img.onerror=null;img.src=PLACEHOLDER};
  img.src=p.image||PLACEHOLDER;img.alt=p.name;
  $("#productoDetallePlaceholder").hidden=true;
  const add=$("#productoAgregarCarrito");add.disabled=out;add.textContent=out?"Agotado":"Agregar al carrito";
  $("#productoCantidad").disabled=out;
  setQty(1);
  const d=$("#dProducto");if(!d.open)d.showModal();
}
function setQty(n){
  const p=detalle.p;if(!p)return;
  const max=isSujeto(p)?99:Math.max(1,p.stock);
  detalle.qty=Math.min(Math.max(1,Number.isFinite(n)?n:1),max);
  $("#productoCantidad").value=detalle.qty;
  $("#productoCantidad").max=max;
  $("#productoCantidadMenos").disabled=detalle.qty<=1;
  $("#productoCantidadMas").disabled=detalle.qty>=max;
}
function closeDetail(){const d=$("#dProducto");if(d&&d.open)d.close()}

/* ---------- Carrito ---------- */
function syncCartWithStock(){
  state.cart=state.cart.filter(i=>state.products.some(p=>p.id==i.id&&(p.stock>0||isSujeto(p)))).map(i=>{const p=state.products.find(x=>x.id==i.id);const cap=isSujeto(p)?99:p.stock;return{...i,stock:p.stock,price:p.price,sujeto_disponibilidad:p.sujeto_disponibilidad,qty:Math.min(i.qty,cap)}});
  save();renderCart();
}
function addToCart(id,qty=1){
  const p=state.products.find(x=>x.id==id);if(!p)return;
  const sj=isSujeto(p);if(!sj&&p.stock<=0)return;
  qty=Math.max(1,Number(qty)||1);
  const item=state.cart.find(x=>x.id==id);
  /* Sujeto a disponibilidad: el cliente debe confirmar antes de agregarlo */
  if(sj&&!(item&&item.dispOk)){confirmDisp(p.name,()=>doAdd(p,qty,true),p);return}
  doAdd(p,qty,false);
}
function doAdd(p,qty,ok){
  const cap=isSujeto(p)?99:p.stock;
  const item=state.cart.find(x=>x.id==p.id);
  if(item){item.qty=Math.min(item.qty+qty,cap);if(ok)item.dispOk=true}else state.cart.push({...p,qty:Math.min(qty,cap),dispOk:!!ok});
  save();renderCart();openCart();
}
/* Usado por el modal de detalle (tienda.js) */
window.agregarProductoAlCarrito=(prod,cant)=>addToCart(prod.id,cant);
function changeQty(i,d){
  const it=state.cart[i];if(!it)return;
  const pp=state.products.find(p=>p.id==it.id)||it;const max=isSujeto(pp)?99:pp.stock;
  it.qty=Math.min(it.qty+d,max);
  if(it.qty<=0)state.cart.splice(i,1);
  save();renderCart();
}
function renderCart(){
  const count=state.cart.reduce((a,x)=>a+x.qty,0);
  $("#cartCount").textContent=count;
  $("#cartItems").innerHTML=state.cart.length?state.cart.map((p,i)=>`<div class="cart-item"><img src="${esc(absUrl(p.image)||PLACEHOLDER)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div><h4>${esc(p.name)}</h4><small>${p.qty} × ${money(p.price)}</small>${isSujeto(p)?'<span class="cart-disp">Sujeto a disponibilidad</span>':""}<div class="qty-ctl"><button onclick="changeQty(${i},-1)" aria-label="Menos">−</button><span>${p.qty}</span><button onclick="changeQty(${i},1)" aria-label="Más">+</button></div></div><button class="remove" onclick="removeItem(${i})"><i class="fa fa-trash"></i></button></div>`).join(""):'<div class="empty">Tu carrito está vacío.</div>';
  $("#cartTotal").textContent=money(state.cart.reduce((a,x)=>a+x.price*x.qty,0));
}
function removeItem(i){state.cart.splice(i,1);save();renderCart()}
function save(){localStorage.setItem("computec_cart",JSON.stringify(state.cart))}
function openCart(){$("#cart").classList.add("open");$("#cartOverlay").classList.add("open")}
function closeCart(){$("#cart").classList.remove("open");$("#cartOverlay").classList.remove("open")}
function checkout(){
  if(!state.cart.length){
    return alert("Agrega al menos un producto.");
  }
  const pend=state.cart.filter(i=>isSujeto(i)&&!i.dispOk);
  if(pend.length){confirmDisp(pend.map(i=>i.name),()=>{pend.forEach(i=>{i.dispOk=true});save();renderCart();checkout()},pend[0]);return}

  const checkoutCart = state.cart.map(item => ({
    id: Number(item.id),
    quantity: Math.max(1, Number(item.qty) || 1),
    qty: Math.max(1, Number(item.qty) || 1),
    cantidad: Math.max(1, Number(item.qty) || 1)
  }));

  // Mantiene el carrito en ambos storages para que /checkout/
  // pueda recuperarlo aunque cambie la navegación.
  localStorage.setItem("computec_cart", JSON.stringify(state.cart));
  sessionStorage.setItem("computec_checkout_cart", JSON.stringify(checkoutCart));

  window.location.href = "/checkout/";
}
/* ---------- Sujeto a disponibilidad ---------- */
const WA_NUM="529932581296";
function isSujeto(p){return !!p&&(p.sujeto_disponibilidad===true||p.sujeto_disponibilidad===1||p.sujeto_disponibilidad==="1"||p.sujeto_disponibilidad==="true")}
function waLink(p){return "https://wa.me/"+WA_NUM+"?text="+encodeURIComponent("Hola, quiero confirmar la disponibilidad de: "+((p&&p.name)||"un producto")+(p&&p.sku?" (SKU "+p.sku+")":""))}
let _dispCb=null;
function confirmDisp(names,cb,p){
  const list=Array.isArray(names)?names:[names];
  const d=$("#dConfirmDisp");
  if(!d||typeof d.showModal!=="function"){
    if(confirm("Producto sujeto a disponibilidad.\n\nAntes de realizar algún proceso de compra te recomendamos que confirmes con nuestro equipo de venta.\n\n¿Confirmas que ya te comunicaste con un asesor de ventas de GRUPO ISCIA y aceptas los tiempos de entrega?"))cb();
    return;
  }
  _dispCb=null;
  $("#confirmDispProducto").textContent=list.join(" · ");
  const wa=$("#confirmDispWa");if(wa&&p)wa.href=waLink(p);
  const chk=$("#confirmDispCheck"),ok=$("#confirmDispOk");
  chk.checked=false;ok.disabled=true;
  chk.onchange=()=>{ok.disabled=!chk.checked};
  $("#confirmDispCancel").onclick=()=>d.close();
  ok.onclick=()=>{if(!chk.checked)return;_dispCb=cb;d.close()};
  d.onclose=()=>{const f=_dispCb;_dispCb=null;if(f)f()};
  d.showModal();
}
function money(n){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n))}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
