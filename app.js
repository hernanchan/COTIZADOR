// Cotizador - Librería Saber (v1.2)
// Impresiones:
// - Cada archivo tiene su faz (SF/DF)
// - Escala por grupos: Color / B&N SF / B&N DF
// - Anillado: cuenta hojas reales por faz y divide en packs de 350 hojas (máximo por anillado)

let CONFIG = null;

let EDITING_ID = null;
let EDITING_KIND = null;

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

function sheetsForFile(pages, faz){
  return (faz === "df") ? ceilDiv(pages, 2) : pages;
}

// cobra 1 o más anillados: máximo 350 hojas por anillado
function bindingPriceWithMax(bindingTiers, sheetsTotal){
  let remaining = Math.max(0, Number(sheetsTotal) || 0);
  let sum = 0;
  while (remaining > 0){
    const chunk = Math.min(350, remaining);
    sum += bindingPrice(bindingTiers, chunk);
    remaining -= chunk;
  }
  return sum;
}

function escapeHtml(s){
  return String(s).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function showError(where, msg){ where.innerText = msg; where.style.display = "block"; }
function clearError(where){ where.innerText = ""; where.style.display = "none"; }

// ======================
// IMPRESIONES
// ======================

function addImpresionesFileRow(pages="", faz="sf"){
  const host = $("imp_files");
  const row = document.createElement("div");
  row.className = "imp-file-row";
  row.innerHTML = `
    <input class="imp-pages" type="number" min="1" step="1" placeholder="Páginas del archivo" value="${pages}">
    <select class="imp-faz">
      <option value="sf" ${faz==="sf" ? "selected" : ""}>Simple faz</option>
      <option value="df" ${faz==="df" ? "selected" : ""}>Doble faz</option>
    </select>
    <button type="button" class="btn btn-small btn-ghost">Quitar</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  host.appendChild(row);
}

function updateImpresionesAnilladoUI(){
  $("imp_anillado_modo_wrap").style.display = ($("imp_anillado").value === "si") ? "block" : "none";
}

function getImpresionesInputs(){
  const mode = $("imp_mode").value; // bn | color
  const copias = clampInt($("imp_copias").value, 1);

  const fileRows = Array.from(document.querySelectorAll(".imp-file-row"));
  const files = fileRows
    .map(r => {
      const pages = clampInt(r.querySelector(".imp-pages")?.value, 0);
      const faz = r.querySelector(".imp-faz")?.value || "sf";
      return (pages > 0) ? { pages, faz } : null;
    })
    .filter(x => x);

  const anillado = $("imp_anillado").value; // no | si
  const anilladoModo = $("imp_anillado_modo").value; // juntos | separados

  return { mode, copias, files, anillado, anilladoModo };
}

function getImpresionesRawNormalized(){
  const inp = getImpresionesInputs();
  return {
    kind: "impresiones",
    mode: inp.mode,
    ejemplares: inp.copias,
    files: inp.files.slice(), // [{pages,faz}]
    anillado: inp.anillado,
    anilladoModo: inp.anilladoModo
  };
}

function impresionesKey(raw){
  return [
    raw.mode,
    raw.anillado,
    raw.anillado === "si" ? raw.anilladoModo : "na"
  ].join("|");
}

function findCompatibleImpresionesItem(raw){
  const key = impresionesKey(raw);
  return CART.find(it =>
    it.kind === "impresiones" &&
    it.raw && it.raw.kind === "impresiones" &&
    impresionesKey(it.raw) === key
  ) || null;
}

function calcImpresionesFormOnly(){
  const inp = getImpresionesInputs();
  if (inp.files.length === 0){
    return { ok:false, error:"Ingresá al menos 1 archivo con páginas." };
  }
  return { ok:true };
}

function buildImpresionesDisplayFromRaw(raw){
  const cfg = CONFIG.items.impresiones;
  const label = (raw.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
  const filesDesc = (raw.files || []).map(f => `${f.pages}p ${f.faz==="df"?"DF":"SF"}`).join(" + ");
  const pagesOne = (raw.files || []).reduce((s,f)=> s + (f.pages||0), 0);
  const itemPages = pagesOne * (raw.ejemplares || 1);

  return {
    title: cfg.label,
    subtitle: label,
    total: 0,
    breakdown: [
      ["Archivos", `${(raw.files||[]).length} (${filesDesc || ""})`],
      ["Ejemplares", String(raw.ejemplares || 1)],
      ["Páginas (este ítem)", String(itemPages)],
      ["Tipo", label],
      ["Anillado", (raw.anillado === "si") ? ((raw.anilladoModo === "juntos") ? "Juntos" : "Separados") : "No"],
      ["Total ítem", moneyARS(0)]
    ]
  };
}

function recalcImpresionesGlobal(){
  const cfg = CONFIG.items.impresiones;

  const impItems = CART.filter(it => it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones");
  if (impItems.length === 0) return;

  let colorTotalPages = 0;
  let bnSfTotalPages = 0;
  let bnDfTotalPages = 0;

  for (const it of impItems){
    const r = it.raw;
    const files = r.files || [];
    const ej = r.ejemplares || 1;

    const pagesOneCopySf = files.reduce((s,f)=> s + ((f.faz==="sf") ? (f.pages||0) : 0), 0);
    const pagesOneCopyDf = files.reduce((s,f)=> s + ((f.faz==="df") ? (f.pages||0) : 0), 0);
    const pagesOneCopyAll = pagesOneCopySf + pagesOneCopyDf;

    if (r.mode === "color"){
      colorTotalPages += pagesOneCopyAll * ej;
    } else {
      bnSfTotalPages += pagesOneCopySf * ej;
      bnDfTotalPages += pagesOneCopyDf * ej;
    }
  }

  const colorUnit = tierPrice(cfg.color.price_tiers_per_page, colorTotalPages) ?? 0;
  const bnSfUnit = tierPrice(cfg.bn.sf, bnSfTotalPages) ?? 0;
  const bnDfUnit = tierPrice(cfg.bn.df, bnDfTotalPages) ?? 0;

  for (const it of impItems){
    const r = it.raw;
    const files = r.files || [];
    const ej = r.ejemplares || 1;

    const itemPagesSf = files.reduce((s,f)=> s + ((f.faz==="sf") ? (f.pages||0) : 0), 0) * ej;
    const itemPagesDf = files.reduce((s,f)=> s + ((f.faz==="df") ? (f.pages||0) : 0), 0) * ej;
    const itemPages = itemPagesSf + itemPagesDf;

    let printing = 0;
    let appliedUnitText = "";
    let groupInfo = "";

    if (r.mode === "color"){
      printing = itemPages * colorUnit;
      appliedUnitText = moneyARS(colorUnit);
      groupInfo = `Páginas totales (color): ${colorTotalPages}`;
    } else {
      printing = (itemPagesSf * bnSfUnit) + (itemPagesDf * bnDfUnit);
      appliedUnitText = `SF ${moneyARS(bnSfUnit)} / DF ${moneyARS(bnDfUnit)}`;
      groupInfo = `Páginas grupo B/N: SF ${bnSfTotalPages} / DF ${bnDfTotalPages}`;
    }

    let binding = 0;
    if (r.anillado === "si"){
      if (r.anilladoModo === "separados"){
        const perCopy = files.reduce((sum, f) => {
          const sheets = sheetsForFile(f.pages||0, f.faz||"sf");
          return sum + bindingPriceWithMax(cfg.binding.tiers_by_sheets, sheets);
        }, 0);
        binding = perCopy * ej;
      } else {
        const sheetsOneCopy = files.reduce((sum, f) => sum + sheetsForFile(f.pages||0, f.faz||"sf"), 0);
        const perCopy = bindingPriceWithMax(cfg.binding.tiers_by_sheets, sheetsOneCopy);
        binding = perCopy * ej;
      }
    }

    const total = printing + binding;

    const label = (r.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
    const filesDesc = files.map(f => `${f.pages}p ${f.faz==="df"?"DF":"SF"}`).join(" + ");

    it.title = cfg.label;
    it.subtitle = label;
    it.total = total;
    it.breakdown = [
      ["Archivos", `${files.length} (${filesDesc})`],
      ["Ejemplares", String(ej)],
      ["Páginas SF (este ítem)", String(itemPagesSf)],
      ["Páginas DF (este ítem)", String(itemPagesDf)],
      ["Páginas totales (este ítem)", String(itemPages)],
      ["Grupo / escala", groupInfo],
      ["Precio por página aplicado", appliedUnitText],
      ["Subtotal impresión", moneyARS(printing)],
      ["Anillado", (r.anillado === "si") ? ((r.anilladoModo === "juntos") ? "Juntos" : "Separados") : "No"],
      ["Subtotal anillado", moneyARS(binding)],
      ["Total ítem", moneyARS(total)]
    ];
  }
}

function setImpresionesFormFromRaw(raw){
  $("imp_mode").value = raw.mode || "bn";
  $("imp_copias").value = raw.ejemplares ?? 1;

  $("imp_files").innerHTML = "";
  (raw.files || []).forEach(f => addImpresionesFileRow(String(f.pages), f.faz || "sf"));

  $("imp_anillado").value = raw.anillado || "no";
  updateImpresionesAnilladoUI();
  $("imp_anillado_modo").value = raw.anilladoModo || "juntos";

  $("imp_btn_add").innerText = "Actualizar ítem";
}

function resetImpresionesForm(){
  $("imp_mode").value = "bn";
  $("imp_copias").value = 1;
  $("imp_anillado").value = "no";
  updateImpresionesAnilladoUI();
  $("imp_anillado_modo").value = "juntos";

  $("imp_files").innerHTML = "";
  addImpresionesFileRow("", "sf");
}

function clearImpresionesEditMode(){
  EDITING_ID = null;
  EDITING_KIND = null;
  $("imp_btn_add").innerText = "Agregar al carrito";
  resetImpresionesForm();
}

// ======================
// PLOTEOS
// ======================

function isFinitePos(n){ return typeof n === "number" && isFinite(n) && n > 0; }

function getPloteosInputs(){
  const kind = $("plo_kind").value;
  const paper = $("plo_paper").value;
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
      const meters = (h / 100) * inp.copias;
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

  return {
    ok:true,
    title: cfg.label,
    subtitle: kindLabel + " - " + paperLabel,
    total: best.cost,
    breakdown: [
      ["Tipo", kindLabel],
      ["Papel", paperLabel],
      ["Medida ingresada (cm)", inp.width + " × " + inp.height],
      ["Orientación elegida (cm)", best.w + " × " + best.h],
      ["Rollo elegido", best.roll + " cm"],
      ["Precio por metro", moneyARS(best.pm)],
      ["Metros cobrados", best.meters.toFixed(2)],
      ["Copias", String(inp.copias)],
      ["Subtotal", moneyARS(best.cost)]
    ]
  };
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

// ======================
// FOTOS
// ======================

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
  return {
    ok:true,
    title: cfg.label,
    subtitle: def.label,
    total: subtotal,
    breakdown: [
      ["Tamaño", def.label],
      ["Cantidad", String(inp.qty)],
      ["Precio unitario", moneyARS(def.price)],
      ["Subtotal", moneyARS(subtotal)]
    ]
  };
}

// ======================
// ADHESIVO
// ======================

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
  return {
    ok:true,
    title: cfg.label,
    subtitle: def.label,
    total,
    breakdown: [
      ["Tipo", def.label],
      ["Cantidad", String(inp.qty)],
      ["Precio unitario", moneyARS(def.price)],
      ["Subtotal", moneyARS(subtotal)],
      ["Descuento", disc>0 ? (cfg.discount.percent + "% (" + moneyARS(disc) + ")") : "No aplica"],
      ["Total", moneyARS(total)]
    ]
  };
}

// ======================
// CARRITO
// ======================

function addToCart(result, meta = null){
  CART.push({
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    kind: meta?.kind || null,
    raw: meta?.raw || null,
    title: result.title,
    subtitle: result.subtitle,
    total: result.total,
    breakdown: result.breakdown
  });
}

function updateCartItem(id, result, meta = null){
  const idx = CART.findIndex(x => x.id === id);
  if (idx === -1) return;

  CART[idx] = {
    ...CART[idx],
    kind: meta?.kind || CART[idx].kind,
    raw: meta?.raw || CART[idx].raw,
    title: result.title,
    subtitle: result.subtitle,
    total: result.total,
    breakdown: result.breakdown
  };
}

function removeFromCart(id){
  CART = CART.filter(x => x.id !== id);
  if (EDITING_ID === id) clearImpresionesEditMode();
  recalcImpresionesGlobal();
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

    const lines = (it.breakdown || [])
      .map(([k,v]) => `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
      .join("");

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
        ${it.kind === "impresiones" ? `<button class="btn btn-small btn-ghost" data-ed="${it.id}">Editar</button>` : ``}
        <button class="btn btn-small btn-ghost" data-rm="${it.id}">Quitar</button>
      </div>
    `;
    host.appendChild(card);
  }

  host.querySelectorAll("button[data-rm]").forEach(b => {
    b.addEventListener("click", () => removeFromCart(b.getAttribute("data-rm")));
  });

  host.querySelectorAll("button[data-ed]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-ed");
      const it = CART.find(x => x.id === id);
      if (!it || it.kind !== "impresiones" || !it.raw) return;

      EDITING_ID = id;
      EDITING_KIND = "impresiones";
      setImpresionesFormFromRaw(it.raw);

      document.querySelector('.tab[data-tab="imp"]')?.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  $("cart_total").innerText = moneyARS(cartTotal());
}

// ======================
// WHATSAPP
// ======================

function buildWhatsAppMessage(){
  const biz = CONFIG.business;
  const total = cartTotal();

  let msg = "Hola! Quiero confirmar este pedido:\n\n";
  CART.forEach((it, idx) => {
    msg += (idx+1) + ") " + it.title + " — " + it.subtitle + " — " + moneyARS(it.total) + "\n";
  });

  msg += "\nTOTAL: " + moneyARS(total) + "\n";

  const notes = ($("order_notes")?.value || "").trim();
  if (notes) msg += "\nOBSERVACIONES:\n" + notes + "\n";

  msg += "\nPago por transferencia:\n";
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

// ======================
// INIT
// ======================

async function loadConfig(){
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar config.json");
  CONFIG = await res.json();

  $("biz_name").innerText = CONFIG.business.name;
  $("pay_alias").innerText = CONFIG.business.payment.alias;
  $("pay_titular").innerText = CONFIG.business.payment.titular;
  $("pay_cuil").innerText = CONFIG.business.payment.cuil;
  $("delivery_note").innerText = CONFIG.business.delivery_note;

  resetImpresionesForm();
  updateImpresionesAnilladoUI();
  updatePloteosPaperOptions();

  recalcImpresionesGlobal();
  renderCart();
}

function initEvents(){
  $("imp_add_file").addEventListener("click", () => addImpresionesFileRow("", "sf"));
  $("imp_anillado").addEventListener("change", updateImpresionesAnilladoUI);

  $("imp_btn_add").addEventListener("click", () => {
    const err = $("imp_err"); clearError(err);

    const v = calcImpresionesFormOnly();
    if (!v.ok) return showError(err, v.error);

    const raw = getImpresionesRawNormalized();

    if (EDITING_KIND === "impresiones" && EDITING_ID){
      const display = buildImpresionesDisplayFromRaw(raw);
      updateCartItem(EDITING_ID, display, { kind:"impresiones", raw });
      clearImpresionesEditMode();
      recalcImpresionesGlobal();
      renderCart();
      return;
    }

    const existing = findCompatibleImpresionesItem(raw);
    if (existing){
      existing.raw.files = (existing.raw.files || []).concat(raw.files || []);
      existing.raw.ejemplares = raw.ejemplares;

      const display = buildImpresionesDisplayFromRaw(existing.raw);
      updateCartItem(existing.id, display, { kind:"impresiones", raw: existing.raw });

      clearImpresionesEditMode();
      recalcImpresionesGlobal();
      renderCart();
      return;
    }

    const display = buildImpresionesDisplayFromRaw(raw);
    addToCart(display, { kind:"impresiones", raw });

    clearImpresionesEditMode();
    recalcImpresionesGlobal();
    renderCart();
  });

  $("plo_kind").addEventListener("change", updatePloteosPaperOptions);
  $("plo_btn_add").addEventListener("click", () => {
    const err = $("plo_err"); clearError(err);
    const r = calcPloteos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
    renderCart();
  });

  $("foto_btn_add").addEventListener("click", () => {
    const err = $("foto_err"); clearError(err);
    const r = calcFotos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
    renderCart();
  });

  $("adh_btn_add").addEventListener("click", () => {
    const err = $("adh_err"); clearError(err);
    const r = calcAdhesivo();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
    renderCart();
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
