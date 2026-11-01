const state={products:[],category:"",cart:JSON.parse(localStorage.getItem("computec_cart")||"[]")};
const $=s=>document.querySelector(s);
const PLACEHOLDER='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="100%" height="100%" fill="#f6f8fb"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle">Sin imagen</text></svg>');

document.addEventListener("DOMContentLoaded",()=>{
  loadProducts();renderCart();
  $("#searchInput").addEventListener("input",renderProducts);
  $("#categoryList").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(!b)return;state.category=b.dataset.cat;renderProducts()});
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
    state.products=Array.isArray(data)?data:(data.products||[]);
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
  const out=p.stock<=0;
  const stock=out?"":`<span class="stock ${p.stock<=5?"low":""}">${p.stock<=5?"Últimas "+p.stock+" piezas":"Disponible"}</span>`;
  return `<article class="product${out?" soldout":""}"><div class="product-img"><img loading="lazy" src="${esc(p.image||PLACEHOLDER)}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">${out?'<div class="soldout-banner">Agotado</div>':""}</div><div class="product-info"><span class="category">${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="price-row"><div><span class="price">${money(p.price)}</span>${stock}</div>${out?'<button class="add" disabled>Agotado</button>':`<button class="add" onclick="addToCart(${p.id})"><i class="fa fa-cart-plus"></i> Agregar</button>`}</div></div></article>`;
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
  const avail=list.filter(p=>p.stock>0),out=list.filter(p=>p.stock<=0);
  $("#resultsCount").textContent=list.length?`${list.length} producto${list.length===1?"":"s"}`:"";
  $("#productsGrid").innerHTML=avail.length?avail.map(productCard).join(""):`<div class="empty">${list.length?"No hay productos disponibles en esta categoría por ahora.":"No encontramos productos con esos criterios."}</div>`;
  $("#soldOutGrid").innerHTML=out.map(productCard).join("");
  $("#soldOutBlock").hidden=!out.length;
  renderCategories();
}

/* ---------- Carrito ---------- */
function syncCartWithStock(){
  state.cart=state.cart.filter(i=>state.products.some(p=>p.id==i.id&&p.stock>0)).map(i=>{const p=state.products.find(x=>x.id==i.id);return{...i,stock:p.stock,price:p.price,qty:Math.min(i.qty,p.stock)}});
  save();renderCart();
}
function addToCart(id){
  const p=state.products.find(x=>x.id==id);if(!p||p.stock<=0)return;
  const item=state.cart.find(x=>x.id==id);
  if(item){if(item.qty<p.stock)item.qty++}else state.cart.push({...p,qty:1});
  save();renderCart();openCart();
}
function changeQty(i,d){
  const it=state.cart[i];if(!it)return;
  const max=(state.products.find(p=>p.id==it.id)||it).stock;
  it.qty=Math.min(it.qty+d,max);
  if(it.qty<=0)state.cart.splice(i,1);
  save();renderCart();
}
function renderCart(){
  const count=state.cart.reduce((a,x)=>a+x.qty,0);
  $("#cartCount").textContent=count;
  $("#cartItems").innerHTML=state.cart.length?state.cart.map((p,i)=>`<div class="cart-item"><img src="${esc(p.image||PLACEHOLDER)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div><h4>${esc(p.name)}</h4><small>${p.qty} × ${money(p.price)}</small><div class="qty-ctl"><button onclick="changeQty(${i},-1)" aria-label="Menos">−</button><span>${p.qty}</span><button onclick="changeQty(${i},1)" aria-label="Más">+</button></div></div><button class="remove" onclick="removeItem(${i})"><i class="fa fa-trash"></i></button></div>`).join(""):'<div class="empty">Tu carrito está vacío.</div>';
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

  const checkoutCart = state.cart.map(item => ({
    id: Number(item.id),
    quantity: Math.max(1, Number(item.qty) || 1),
    qty: Math.max(1, Number(item.qty) || 1),
    cantidad: Math.max(1, Number(item.qty) || 1)
  }));

  // Mantiene el carrito en ambos storages para que checkout.html
  // pueda recuperarlo aunque cambie la navegación.
  localStorage.setItem("computec_cart", JSON.stringify(state.cart));
  sessionStorage.setItem("computec_checkout_cart", JSON.stringify(checkoutCart));

  window.location.href = "checkout.html";
}
function money(n){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n))}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
