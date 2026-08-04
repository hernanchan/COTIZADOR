(function(){
  "use strict";
  var frame=document.getElementById("cotizador-frame");
  var promoGrid=document.getElementById("promo-grid");
  var cartToggle=document.getElementById("offer-cart-toggle");
  var cartBackdrop=document.getElementById("cart-backdrop");
  var drawer=document.getElementById("offer-drawer");
  var drawerList=document.getElementById("drawer-list");
  var offerCount=document.getElementById("offer-count");
  var drawerTotal=document.getElementById("drawer-total");
  var sendProductsOnly=document.getElementById("send-products-only");
  var products=[];
  var promoCart=readCart();
  var frameState={doc:null,link:null,baseHref:"",suppress:false,observer:null};

  function money(value){return "$"+Math.round(Number(value)||0).toLocaleString("es-AR");}
  function readCart(){
    try{
      var value=JSON.parse(localStorage.getItem("saberPromoCart")||"[]");
      return Array.isArray(value)?value:[];
    }catch(e){return [];}
  }
  function saveCart(){
    localStorage.setItem("saberPromoCart",JSON.stringify(promoCart));
    renderDrawer();
    syncFrameOrder();
  }
  function activeProducts(data){
    if(!data||data.enabled===false)return [];
    var now=new Date();
    return (data.products||[]).filter(function(p){
      if(!p.active)return false;
      if(p.from&&now<new Date(p.from+"T00:00:00"))return false;
      if(p.to&&now>new Date(p.to+"T23:59:59"))return false;
      return Number(p.offer_price)>0;
    });
  }
  function demoProducts(){
    return [{
      id:"demo-producto",
      active:true,
      demo:true,
      name:"Ejemplo de producto en oferta",
      image:"",
      normal_price:8500,
      offer_price:6900,
      condition:"Ejemplo visible solo con ?demoPromos=1. Se puede exigir un trabajo de impresión.",
      requires_print_job:true,
      max_per_order:2,
      badge:"OFERTA DE PRUEBA"
    }];
  }
  async function loadProducts(){
    try{
      var response=await fetch("ofertas.json?v="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw new Error("No se pudo cargar ofertas.json");
      var data=await response.json();
      products=activeProducts(data);
    }catch(e){products=[];}
    if(!products.length&&new URLSearchParams(location.search).get("demoPromos")==="1")products=demoProducts();
    renderPromos();
  }
  function renderPromos(){
    promoGrid.textContent="";
    if(!products.length){
      var empty=document.createElement("div");
      empty.className="promo-empty";
      empty.style.gridColumn="1/-1";
      empty.innerHTML="<strong>No hay productos destacados activos en este momento.</strong><br>Los códigos de descuento se siguen aplicando dentro del cotizador.";
      promoGrid.appendChild(empty);
      return;
    }
    products.forEach(function(product){
      var card=document.createElement("article");
      card.className="promo-card";
      var media=document.createElement("div");
      media.className="promo-media";
      if(product.image){
        var img=document.createElement("img");
        img.src=product.image;
        img.alt=product.name;
        img.loading="lazy";
        media.appendChild(img);
      }else{
        var placeholder=document.createElement("div");
        placeholder.className="promo-placeholder";
        placeholder.textContent="✎";
        media.appendChild(placeholder);
      }
      var badge=document.createElement("span");
      badge.className="promo-badge";
      badge.textContent=product.badge||"OFERTA";
      media.appendChild(badge);
      var body=document.createElement("div");
      body.className="promo-body";
      var title=document.createElement("h3");
      title.textContent=product.name;
      var prices=document.createElement("div");
      prices.className="promo-prices";
      if(Number(product.normal_price)>0){
        var normal=document.createElement("span");
        normal.className="promo-normal";
        normal.textContent=money(product.normal_price);
        prices.appendChild(normal);
      }
      var offer=document.createElement("span");
      offer.className="promo-offer";
      offer.textContent=money(product.offer_price);
      prices.appendChild(offer);
      var condition=document.createElement("div");
      condition.className="promo-condition";
      condition.textContent=product.condition||"Disponible hasta agotar stock.";
      var action=document.createElement("div");
      action.className="promo-action";
      var qty=document.createElement("input");
      qty.type="number";qty.min="1";qty.max=String(product.max_per_order||99);qty.value="1";qty.className="qty-input";qty.setAttribute("aria-label","Cantidad");
      var add=document.createElement("button");
      add.className="btn btn-primary";add.type="button";add.textContent="Agregar al pedido";
      add.addEventListener("click",function(){
        addProduct(product,Math.max(1,Math.min(Number(qty.value)||1,Number(product.max_per_order)||99)));
      });
      action.appendChild(qty);action.appendChild(add);
      body.appendChild(title);body.appendChild(prices);body.appendChild(condition);body.appendChild(action);
      card.appendChild(media);card.appendChild(body);
      promoGrid.appendChild(card);
    });
  }
  function addProduct(product,qty){
    var existing=promoCart.find(function(item){return item.id===product.id;});
    if(existing)existing.qty=Math.min((existing.qty||0)+qty,Number(product.max_per_order)||99);
    else promoCart.push({
      id:product.id,
      name:product.name,
      price:Number(product.offer_price)||0,
      qty:qty,
      requires_print_job:!!product.requires_print_job,
      condition:product.condition||""
    });
    saveCart();
    openDrawer();
    if(typeof window.gtag==="function")window.gtag("event","producto_oferta_agregado",{item_name:product.name,value:Number(product.offer_price)||0,currency:"ARS"});
  }
  function cartTotal(){return promoCart.reduce(function(sum,item){return sum+(Number(item.price)||0)*(Number(item.qty)||0);},0);}
  function cartQty(){return promoCart.reduce(function(sum,item){return sum+(Number(item.qty)||0);},0);}
  function renderDrawer(){
    drawerList.textContent="";
    promoCart.forEach(function(item,index){
      var row=document.createElement("div");
      row.className="drawer-item";
      var copy=document.createElement("div");
      copy.innerHTML="<strong></strong><small></small>";
      copy.querySelector("strong").textContent=item.name;
      copy.querySelector("small").textContent=item.qty+" × "+money(item.price)+" = "+money(item.qty*item.price);
      var remove=document.createElement("button");
      remove.className="remove-offer";remove.type="button";remove.textContent="Quitar";
      remove.addEventListener("click",function(){promoCart.splice(index,1);saveCart();});
      row.appendChild(copy);row.appendChild(remove);drawerList.appendChild(row);
    });
    if(!promoCart.length){
      var empty=document.createElement("div");
      empty.className="promo-empty";empty.textContent="Todavía no agregaste productos.";
      drawerList.appendChild(empty);
    }
    offerCount.textContent=String(cartQty());
    drawerTotal.textContent=money(cartTotal());
    cartToggle.classList.toggle("is-visible",promoCart.length>0);
    sendProductsOnly.href=buildProductsOnlyHref();
  }
  function openDrawer(){drawer.classList.add("is-open");cartBackdrop.classList.add("is-open");}
  function closeDrawer(){drawer.classList.remove("is-open");cartBackdrop.classList.remove("is-open");}
  function offerLines(){
    return promoCart.map(function(item){
      return "• OFERTA: "+item.name+"\n  "+item.qty+" × "+money(item.price)+" = "+money(item.qty*item.price);
    });
  }
  function buildProductsOnlyHref(){
    var message="Hola, quiero consultar por estos productos en oferta.\n\n*PRODUCTOS EN OFERTA*\n"+offerLines().join("\n\n")+"\n\n*TOTAL: "+money(cartTotal())+"*";
    return "https://api.whatsapp.com/send?phone=5493513110130&text="+encodeURIComponent(message);
  }
  function parseWhatsappHref(href){
    try{
      var url=new URL(href,location.href);
      var text=url.searchParams.get("text");
      return {url:url,text:text||""};
    }catch(e){return null;}
  }
  function augmentMessage(baseMessage){
    if(!promoCart.length)return baseMessage;
    var extra=cartTotal();
    var block="\n\n*PRODUCTOS EN OFERTA*\n"+offerLines().join("\n\n");
    var totalMatch=baseMessage.match(/\*TOTAL:\s*\$([\d.]+)\*/i);
    var depositMatch=baseMessage.match(/\*SEÑA 50%:\s*\$([\d.]+)\*/i);
    if(totalMatch){
      var baseTotal=Number(totalMatch[1].replace(/\./g,""))||0;
      var combined=baseTotal+extra;
      var combinedDeposit=Math.round(combined*.5);
      var updated=baseMessage.replace(/\n\n\*TOTAL:/i,block+"\n\n*TOTAL:");
      updated=updated.replace(/\*TOTAL:\s*\$[\d.]+\*/i,"*TOTAL: "+money(combined)+"*");
      if(depositMatch)updated=updated.replace(/\*SEÑA 50%:\s*\$[\d.]+\*/i,"*SEÑA 50%: "+money(combinedDeposit)+"*");
      return updated;
    }
    return baseMessage+block+"\n\n*TOTAL PRODUCTOS EN OFERTA: "+money(extra)+"*";
  }
  function syncFrameOrder(){
    if(!frameState.doc||!frameState.link)return;
    var link=frameState.link;
    if(!frameState.baseHref)frameState.baseHref=link.getAttribute("href")||"";
    var parsed=parseWhatsappHref(frameState.baseHref);
    var summary=frameState.doc.getElementById("saber-offer-summary");
    if(!summary){
      summary=frameState.doc.createElement("div");
      summary.id="saber-offer-summary";
      summary.style.cssText="margin-top:12px;padding:12px 14px;border:1px solid #ffd59c;border-radius:12px;background:#fff4e5;color:#71440a;font:600 13px/1.45 Arial,sans-serif;";
      var priceBlock=frameState.doc.querySelector(".price-block");
      if(priceBlock)priceBlock.appendChild(summary);
    }
    if(!promoCart.length){
      summary.style.display="none";
      if(frameState.baseHref){
        frameState.suppress=true;
        link.setAttribute("href",frameState.baseHref);
        setTimeout(function(){frameState.suppress=false;},0);
      }
      return;
    }
    summary.style.display="block";
    summary.textContent=cartQty()+" producto(s) de oferta agregado(s) · "+money(cartTotal())+". Se sumarán al detalle y total final de WhatsApp.";
    if(parsed&&parsed.text){
      var message=augmentMessage(parsed.text);
      var phone=parsed.url.searchParams.get("phone")||"5493513110130";
      var finalHref="https://api.whatsapp.com/send?phone="+encodeURIComponent(phone)+"&text="+encodeURIComponent(message);
      frameState.suppress=true;
      link.setAttribute("href",finalHref);
      setTimeout(function(){frameState.suppress=false;},0);
    }
  }
  function connectFrame(){
    try{
      var doc=frame.contentDocument;
      if(!doc)return;
      frameState.doc=doc;
      frameState.link=doc.getElementById("proto-whatsapp");
      resizeFrame();
      if(frameState.observer)frameState.observer.disconnect();
      frameState.observer=new MutationObserver(function(mutations){
        resizeFrame();
        mutations.forEach(function(m){
          if(frameState.link&&m.target===frameState.link&&m.attributeName==="href"&&!frameState.suppress){
            frameState.baseHref=frameState.link.getAttribute("href")||"";
            syncFrameOrder();
          }
        });
      });
      frameState.observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:["href","class","style"]});
      if(frameState.link){
        frameState.baseHref=frameState.link.getAttribute("href")||"";
        frameState.link.addEventListener("click",syncFrameOrder,true);
      }
      syncFrameOrder();
    }catch(e){}
  }
  function resizeFrame(){
    try{
      var doc=frame.contentDocument;
      if(!doc)return;
      var height=Math.max(doc.documentElement.scrollHeight,doc.body.scrollHeight);
      if(height>400)frame.style.height=(height+18)+"px";
    }catch(e){}
  }
  function selectService(service){
    document.getElementById("cotizador").scrollIntoView({behavior:"smooth",block:"start"});
    setTimeout(function(){
      try{
        var target=frame.contentDocument.querySelector('[data-service="'+service+'"]');
        if(target)target.click();
      }catch(e){}
    },500);
  }

  document.querySelectorAll("[data-service-target]").forEach(function(button){
    button.addEventListener("click",function(){selectService(button.dataset.serviceTarget);});
  });
  cartToggle.addEventListener("click",openDrawer);
  cartBackdrop.addEventListener("click",closeDrawer);
  document.getElementById("drawer-close").addEventListener("click",closeDrawer);
  document.getElementById("go-quote").addEventListener("click",function(){closeDrawer();document.getElementById("cotizador").scrollIntoView({behavior:"smooth"});});
  frame.addEventListener("load",connectFrame);
  window.addEventListener("resize",resizeFrame);
  renderDrawer();
  loadProducts();
})();
