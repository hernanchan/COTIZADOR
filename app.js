// Cotizador v1 - Librería Saber
let CONFIG = null;
let CART = [];

function $(id){ return document.getElementById(id); }

function moneyARS(n){
  const v = Math.round(Number(n) || 0);
  return "$" + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function clampInt(x, minVal=0){
  const n = parseInt(x, 10);
  if (isNaN(n)) return minVal;
  return Math.max(minVal, n);
}
function ceilDiv(a,b){ return Math.floor((a + b - 1) / b); }

function tierPrice(tiers, qty){
  for (const t of tiers){
    const min = (t.min ?? 0);
    const max = (t.max === null || t.max === undefined) ? Infinity : t.max;
    if (qty >= min && qty <= max) return t.price;
  }
  return null;
}
function bindingPrice(bindingTiers, sheets){
  for (const t of bindingTiers){
    const max = (t.max_sheets === null || t.max_sheets === undefined) ? Infinity : t.max_sheets;
    if (sheets <= max) return t.price;
  }
  return 0;
}

// ---------- IMPRESIONES ----------
function getImpresionesInputs(){
  const mode = $("imp_mode").value; // bn | color
  const faz = $("imp_faz").value;   // sf | df
  const copias = clampInt($("imp_copias").value, 1);

  const fileRows = Array.from(document.querySelectorAll(".imp-file-row"));
  const pagesPerFile = fileRows
    .map(r => clampInt(r.querySelector("input").value, 0))
    .filter(x => x > 0);

  const anillado = $("imp_anillado").value; // no | si
  const anilladoModo = $("imp_anillado_modo").value; // juntos | separados
  return { mode, faz, copias, pagesPerFile, anillado, anilladoModo };
}
function buildImpresionesItem(){
  const cfg = CONFIG.items.impresiones;
  const inp = getImpresionesInputs();

  if (inp.pagesPerFile.length === 0){
    return { ok:false, error:"Ingresá al menos 1 archivo con páginas." };
  }

  const label = (inp.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
  const fazLabel = (inp.faz === "df") ? "Doble faz" : "Simple faz";

  // Este ítem NO calcula total final: guarda datos
  const raw = {
    kind: "impresiones",
    mode: inp.mode,
    faz: inp.faz,
    ejemplares: inp.copias, // si renombrás, cambiá acá
    pagesPerFile: inp.pagesPerFile.slice(),
    anillado: inp.anillado,
    anilladoModo: inp.anilladoModo
  };

  // Subtotal “provisorio” solo para mostrar algo antes del recálculo global
  const pagesOne = inp.pagesPerFile.reduce((a,b)=>a+b,0);
  const totalPages = pagesOne * inp.copias;

  const breakdown = [
    ["Archivos", inp.pagesPerFile.length + " (" + inp.pagesPerFile.join(" + ") + " pág)"],
    ["Ejemplares", String(inp.copias)],
    ["Páginas (este archivo)", String(totalPages)],
    ["Tipo", label + " - " + fazLabel],
    ["Anillado", (inp.anillado === "si") ? ((inp.anilladoModo === "juntos") ? "Juntos" : "Separados") : "No"],
  ];

  return { ok:true, title: cfg.label, subtitle: label + " - " + fazLabel, total: 0, breakdown, raw };
}

function calcImpresiones(){
  const cfg = CONFIG.items.impresiones;
  const inp = getImpresionesInputs();

  if (inp.pagesPerFile.length === 0){
    return { ok:false, error:"Ingresá al menos 1 archivo con páginas." };
  }

  const totalPagesOneCopy = inp.pagesPerFile.reduce((a,b)=>a+b,0);
  const totalPages = totalPagesOneCopy * inp.copias;

  let unitPrice = 0;
  if (inp.mode === "color"){
    unitPrice = tierPrice(cfg.color.price_tiers_per_page, totalPages);
    if (unitPrice === null) return { ok:false, error:"No se pudo determinar el precio unitario (color)." };
  } else {
    const tiers = (inp.faz === "df") ? cfg.bn.df : cfg.bn.sf;
    unitPrice = tierPrice(tiers, totalPages);
    if (unitPrice === null) return { ok:false, error:"No se pudo determinar el precio unitario (B/N)." };
  }

  const printing = totalPages * unitPrice;

  let binding = 0;
  if (inp.anillado === "si"){
    const sheetsPerFile = inp.pagesPerFile.map(p => (inp.faz === "df" ? ceilDiv(p,2) : p));
    if (inp.anilladoModo === "separados"){
      const perCopy = sheetsPerFile.reduce((sum, s)=> sum + bindingPrice(cfg.binding.tiers_by_sheets, s), 0);
      binding = perCopy * inp.copias;
    } else {
      const totalSheetsOneCopy = sheetsPerFile.reduce((a,b)=>a+b,0);
      const perCopy = bindingPrice(cfg.binding.tiers_by_sheets, totalSheetsOneCopy);
      binding = perCopy * inp.copias;
    }
  }

  const total = printing + binding;

  const label = (inp.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
  const fazLabel = (inp.faz === "df") ? "Doble faz" : "Simple faz";

  const breakdown = [
    ["Archivos", inp.pagesPerFile.length + " (" + inp.pagesPerFile.join(" + ") + " pág)"],
    ["Copias", String(inp.copias)],
    ["Total páginas facturadas", String(totalPages)],
    ["Tipo", label + " - " + fazLabel],
    ["Precio por página aplicado", moneyARS(unitPrice)],
    ["Subtotal impresión", moneyARS(printing)],
    ["Anillado", (inp.anillado === "si") ? ((inp.anilladoModo === "juntos") ? "Juntos" : "Separados") : "No"],
    ["Subtotal anillado", moneyARS(binding)],
  ];

  return { ok:true, title: cfg.label, subtitle: label + " - " + fazLabel, total, breakdown };
}

// ---------- PLOTEOS ----------
function isFinitePos(n){ return typeof n === "number" && isFinite(n) && n > 0; }

function getPloteosInputs(){
  const kind = $("plo_kind").value;   // cad|pleno
  const paper = $("plo_paper").value; // obra|recubierto
  const width = Number($("plo_w").value);
  const height = Number($("plo_h").value);
  const copias = clampInt($("plo_copias").value, 1);
  return { kind, paper, width, height, copias };
}

function calcPloteos(){
  const cfg = CONFIG.items.ploteos;
  const inp = getPloteosInputs();

  if (!isFinitePos(inp.width) || !isFinitePos(inp.height)){
    return { ok:false, error:"Ingresá ancho y alto en cm (valores > 0)." };
  }

  const kindDef = cfg.kinds.find(k => k.value === inp.kind);
  if (!kindDef) return { ok:false, error:"Tipo de ploteo inválido." };
  if (!kindDef.allowed_papers.includes(inp.paper)){
    return { ok:false, error:"Ese tipo de ploteo no está disponible para ese papel." };
  }

  const rolls = cfg.rolls[inp.paper] || [];
  const prices = cfg.prices_per_meter?.[inp.paper]?.[inp.kind] || null;
  if (!prices) return { ok:false, error:"No hay precios configurados para ese papel/tipo." };

  function bestForOrientation(w, h){
    const eligible = rolls.filter(r => w <= r).sort((a,b)=>a-b);
    if (eligible.length === 0) return null;
    let best = null;
    for (const r of eligible){
      const pm = prices[String(r)];
      if (pm === undefined) continue;
      const meters = (h / 100) * inp.copias; // exact
      const cost = meters * pm;
      const cand = { roll:r, meters, cost, w, h, pm };
      if (!best || cand.cost < best.cost) best = cand;
    }
    return best;
  }

  const a = bestForOrientation(inp.width, inp.height);
  const b = bestForOrientation(inp.height, inp.width);
  const best = (!a) ? b : (!b ? a : (b.cost < a.cost ? b : a));
  if (!best) return { ok:false, error:"Las medidas no entran en ningún rollo disponible." };

  const paperLabel = cfg.paper_types.find(p=>p.value===inp.paper)?.label || inp.paper;
  const kindLabel = kindDef.label;

  const breakdown = [
    ["Tipo", kindLabel],
    ["Papel", paperLabel],
    ["Medida ingresada (cm)", inp.width + " × " + inp.height],
    ["Orientación elegida (cm)", best.w + " × " + best.h],
    ["Rollo elegido", best.roll + " cm"],
    ["Precio por metro", moneyARS(best.pm)],
    ["Metros cobrados", best.meters.toFixed(2)],
    ["Copias", String(inp.copias)],
    ["Subtotal", moneyARS(best.cost)]
  ];

  return { ok:true, title: cfg.label, subtitle: kindLabel + " - " + paperLabel, total: best.cost, breakdown };
}

// ---------- FOTOS ----------
function getFotosInputs(){
  const size = $("foto_size").value;
  const qty = clampInt($("foto_qty").value, 1);
  return { size, qty };
}
function calcFotos(){
  const cfg = CONFIG.items.fotos;
  const inp = getFotosInputs();
  const def = cfg.sizes.find(s => s.value === inp.size);
  if (!def) return { ok:false, error:"Tamaño inválido." };
  const subtotal = inp.qty * def.price;
  const breakdown = [
    ["Tamaño", def.label],
    ["Cantidad", String(inp.qty)],
    ["Precio unitario", moneyARS(def.price)],
    ["Subtotal", moneyARS(subtotal)]
  ];
  return { ok:true, title: cfg.label, subtitle: def.label, total: subtotal, breakdown };
}

// ---------- ADHESIVO ----------
function getAdhInputs(){
  const type = $("adh_type").value;
  const qty = clampInt($("adh_qty").value, 1);
  return { type, qty };
}
function calcAdhesivo(){
  const cfg = CONFIG.items.adhesivo_a4;
  const inp = getAdhInputs();
  const def = cfg.types.find(t => t.value === inp.type);
  if (!def) return { ok:false, error:"Tipo inválido." };
  const subtotal = inp.qty * def.price;
  const disc = (inp.qty >= cfg.discount.min_qty) ? (subtotal * (cfg.discount.percent/100)) : 0;
  const total = subtotal - disc;
  const breakdown = [
    ["Tipo", def.label],
    ["Cantidad", String(inp.qty)],
    ["Precio unitario", moneyARS(def.price)],
    ["Subtotal", moneyARS(subtotal)],
    ["Descuento", disc>0 ? (cfg.discount.percent + "% (" + moneyARS(disc) + ")") : "No aplica"],
    ["Total", moneyARS(total)]
  ];
  return { ok:true, title: cfg.label, subtitle: def.label, total, breakdown };
}

// ---------- CART ----------
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function addToCart(result){
  CART.push({
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    title: result.title,
    subtitle: result.subtitle,
    total: result.total,
    breakdown: result.breakdown,
    raw: result.raw || null
  });
  recalcCart();  // <-- en vez de renderCart directo
}
function recalcCart(){
  // 1) Recalcula IMPRESIONES como bloque global
  recalcImpresionesGlobal();

  // 2) Renderiza
  renderCart();
}

function recalcImpresionesGlobal(){
  const cfg = CONFIG.items.impresiones;

  // Tomo todos los ítems del carrito que sean impresiones
  const impItems = CART.filter(it => it.raw && it.raw.kind === "impresiones");
  if (impItems.length === 0) return;

  // Si hay mezclas (color + BN) o mezclas de faz en BN, NO se puede mezclar escala:
  // se calculan por grupo.
  // Armamos grupos por "mode" y "faz" (en color faz no afecta unitario, pero sí anillado)
  const groups = {};
  for (const it of impItems){
    const r = it.raw;
    const key = r.mode === "color" ? "color" : ("bn_" + r.faz);
    if (!groups[key]) groups[key] = [];
    groups[key].push(it);
  }

  // Para cada grupo aplico escala por TOTAL páginas del grupo
  for (const key of Object.keys(groups)){
    const items = groups[key];

    // Total páginas del grupo
    let groupTotalPages = 0;
    for (const it of items){
      const r = it.raw;
      const pagesOneCopy = r.pagesPerFile.reduce((a,b)=>a+b,0);
      groupTotalPages += pagesOneCopy * r.ejemplares;
    }

    // Unitario por página según escala
    let unitPrice = 0;
    if (key === "color"){
      unitPrice = tierPrice(cfg.color.price_tiers_per_page, groupTotalPages);
    } else {
      const faz = key.replace("bn_","");
      const tiers = (faz === "df") ? cfg.bn.df : cfg.bn.sf;
      unitPrice = tierPrice(tiers, groupTotalPages);
    }
    if (unitPrice === null) unitPrice = 0;

    // Total impresión del grupo
    const groupPrinting = groupTotalPages * unitPrice;

    // Ahora asigno a cada ítem su “parte” proporcional (según sus páginas)
    for (const it of items){
      const r = it.raw;
      const pagesOneCopy = r.pagesPerFile.reduce((a,b)=>a+b,0);
      const itemPages = pagesOneCopy * r.ejemplares;

      const itemPrinting = itemPages * unitPrice;

      // Anillado por ítem (se mantiene por archivo: juntos/separados por ítem)
      let binding = 0;
      if (r.anillado === "si"){
        const sheetsPerFile = r.pagesPerFile.map(p => (r.faz === "df" ? ceilDiv(p,2) : p));
        if (r.anilladoModo === "separados"){
          const perCopy = sheetsPerFile.reduce((sum, s)=> sum + bindingPrice(cfg.binding.tiers_by_sheets, s), 0);
          binding = perCopy * r.ejemplares;
        } else {
          const totalSheetsOneCopy = sheetsPerFile.reduce((a,b)=>a+b,0);
          const perCopy = bindingPrice(cfg.binding.tiers_by_sheets, totalSheetsOneCopy);
          binding = perCopy * r.ejemplares;
        }
      }

      it.total = itemPrinting + binding;

      // Actualizo breakdown para que sea claro
      // (podés ajustar textos)
      const label = (r.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
      const fazLabel = (r.faz === "df") ? "Doble faz" : "Simple faz";

      it.subtitle = label + " - " + fazLabel;
      it.breakdown = [
        ["Archivos", r.pagesPerFile.length + " (" + r.pagesPerFile.join(" + ") + " pág)"],
        ["Ejemplares", String(r.ejemplares)],
        ["Páginas (este ítem)", String(itemPages)],
        ["Páginas totales (grupo)", String(groupTotalPages)],
        ["Precio por página aplicado", moneyARS(unitPrice)],
        ["Subtotal impresión (este ítem)", moneyARS(itemPrinting)],
        ["Anillado", (r.anillado === "si") ? ((r.anilladoModo === "juntos") ? "Juntos" : "Separados") : "No"],
        ["Subtotal anillado", moneyARS(binding)],
        ["Total ítem", moneyARS(it.total)],
      ];
    }
  }
}


function removeFromCart(id){
  CART = CART.filter(x => x.id !== id);
  renderCart();
}

function cartTotal(){
  return CART.reduce((s, x) => s + (Number(x.total)||0), 0);
}

function renderCart(){
  const host = $("cart_items");
  host.innerHTML = "";
  if (CART.length === 0){
    host.innerHTML = '<div class="muted">Todavía no agregaste ítems.</div>';
    $("cart_total").innerText = moneyARS(0);
    return;
  }

  for (const it of CART){
    const card = document.createElement("div");
    card.className = "cart-card";
    const lines = it.breakdown.map(([k,v]) => `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join("");
    card.innerHTML = `
      <div class="cart-head">
        <div>
          <div class="cart-title">${escapeHtml(it.title)}</div>
          <div class="cart-sub">${escapeHtml(it.subtitle)}</div>
        </div>
        <div class="cart-price">${moneyARS(it.total)}</div>
      </div>
      <div class="cart-body">${lines}</div>
      <div class="cart-actions">
        <button class="btn btn-small btn-ghost" data-rm="${it.id}">Quitar</button>
      </div>
    `;
    host.appendChild(card);
  }

  host.querySelectorAll("button[data-rm]").forEach(b => {
    b.addEventListener("click", () => removeFromCart(b.getAttribute("data-rm")));
  });

  $("cart_total").innerText = moneyARS(cartTotal());
}

// ---------- WHATSAPP ----------
function buildWhatsAppMessage(){
  const biz = CONFIG.business;
  const total = cartTotal();
  let msg = "Hola! Quiero confirmar este pedido:\n\n";
  CART.forEach((it, idx) => {
    msg += (idx+1) + ") " + it.title + " — " + it.subtitle + " — " + moneyARS(it.total) + "\n";
  });
  msg += "\nTOTAL: " + moneyARS(total) + "\n\n";
  const notes = ($("order_notes")?.value || "").trim();
if (notes) msg += "\nOBSERVACIONES:\n" + notes + "\n";

  msg += "Pago por transferencia:\n";
  msg += "Alias: " + biz.payment.alias + "\n";
  msg += "Titular: " + biz.payment.titular + "\n";
  msg += "CUIL: " + biz.payment.cuil + "\n\n";
  msg += "Adjunto comprobante y archivos.\n";
  msg += biz.delivery_note;
  return msg.trim();
}
function openWhatsApp(){
  if (CART.length === 0){
    alert("Agregá al menos un ítem al carrito antes de enviar por WhatsApp.");
    return;
  }
  const phone = CONFIG.business.whatsapp_phone;
  const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(buildWhatsAppMessage());
  window.open(url, "_blank");
}

// ---------- UI ----------
function addImpresionesFileRow(pages=""){
  const host = $("imp_files");
  const row = document.createElement("div");
  row.className = "imp-file-row";
  row.innerHTML = `
    <input type="number" min="1" step="1" placeholder="Páginas del archivo" value="${pages}">
    <button type="button" class="btn btn-small btn-ghost">Quitar</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  host.appendChild(row);
}
function updateImpresionesAnilladoUI(){
  $("imp_anillado_modo_wrap").style.display = ($("imp_anillado").value === "si") ? "block" : "none";
}
function updatePloteosPaperOptions(){
  const cfg = CONFIG.items.ploteos;
  const kind = $("plo_kind").value;
  const kindDef = cfg.kinds.find(k => k.value === kind);
  const paperSel = $("plo_paper");
  paperSel.innerHTML = "";
  for (const p of cfg.paper_types){
    if (!kindDef.allowed_papers.includes(p.value)) continue;
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = p.label;
    paperSel.appendChild(opt);
  }
}
function showError(where, msg){ where.innerText = msg; where.style.display = "block"; }
function clearError(where){ where.innerText = ""; where.style.display = "none"; }

async function loadConfig(){
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar config.json");
  CONFIG = await res.json();
  $("biz_name").innerText = CONFIG.business.name;
  $("pay_alias").innerText = CONFIG.business.payment.alias;
  $("pay_titular").innerText = CONFIG.business.payment.titular;
  $("pay_cuil").innerText = CONFIG.business.payment.cuil;
  $("delivery_note").innerText = CONFIG.business.delivery_note;

  addImpresionesFileRow("");
  updateImpresionesAnilladoUI();
  updatePloteosPaperOptions();
  renderCart();
}

function initEvents(){
  $("imp_add_file").addEventListener("click", () => addImpresionesFileRow(""));
  $("imp_anillado").addEventListener("change", updateImpresionesAnilladoUI);
  $("imp_btn_add").addEventListener("click", () => {
    const err = $("imp_err"); clearError(err);
    const r = buildImpresionesItem();

    if (!r.ok) return showError(err, r.error);
    addToCart(r);
  });

  $("plo_kind").addEventListener("change", updatePloteosPaperOptions);
  $("plo_btn_add").addEventListener("click", () => {
    const err = $("plo_err"); clearError(err);
    const r = calcPloteos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
  });

  $("foto_btn_add").addEventListener("click", () => {
    const err = $("foto_err"); clearError(err);
    const r = calcFotos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
  });

  $("adh_btn_add").addEventListener("click", () => {
    const err = $("adh_err"); clearError(err);
    const r = calcAdhesivo();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
  });

  $("btn_whatsapp").addEventListener("click", openWhatsApp);
}

document.addEventListener("DOMContentLoaded", async () => {
  try{
    await loadConfig();
    initEvents();
  } catch(e){
    console.error(e);
    alert("Error cargando el cotizador: " + (e.message || e));
  }
});
