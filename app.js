// Cotizador v1 - Librería Saber (Opción B: por archivo)
let CONFIG = null;

let EDITING_ID = null;     // id del ítem del carrito editando
let EDITING_KIND = null;   // "impresiones"

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

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function showError(where, msg){ where.innerText = msg; where.style.display = "block"; }
function clearError(where){ where.innerText = ""; where.style.display = "none"; }

// =====================================================
// IMPRESIONES (por archivo)
// =====================================================

function getImpresionesInputs(){
  const ejemplares = clampInt($("imp_ejemplares").value, 1);
  const anillado = $("imp_anillado").value; // no|si
  const anilladoModo = $("imp_anillado_modo").value; // juntos|separados

  const fileRows = Array.from(document.querySelectorAll(".imp-file-row"));
  const files = [];

  for (const r of fileRows){
    const pages = clampInt(r.querySelector('input[data-pages]').value, 0);
    const mode  = r.querySelector('select[data-mode]').value; // bn|color
    const faz   = r.querySelector('select[data-faz]').value;  // sf|df
    if (pages > 0){
      files.push({ pages, mode, faz });
    }
  }

  return { ejemplares, anillado, anilladoModo, files };
}

function validateImpresionesForm(){
  const inp = getImpresionesInputs();
  if (!inp.files || inp.files.length === 0){
    return { ok:false, error:"Ingresá al menos 1 archivo con páginas." };
  }
  return { ok:true };
}

// Clave para fusionar: mismo anillado, modo y ejemplares
function impresionesMergeKey(raw){
  return [
    raw.anillado,
    raw.anillado === "si" ? raw.anilladoModo : "na",
    String(raw.ejemplares || 1)
  ].join("|");
}

function findMergeTargetImpresiones(raw){
  const key = impresionesMergeKey(raw);
  return CART.find(it => it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones" && impresionesMergeKey(it.raw) === key) || null;
}

// Helpers de agrupación de precio por página
function groupKeyFromFile(f){
  if (f.mode === "color") return "color";
  // bn
  return (f.faz === "df") ? "bn_df" : "bn_sf";
}
function groupLabel(key){
  if (key === "color") return "Color";
  if (key === "bn_sf") return "B/N Simple faz";
  if (key === "bn_df") return "B/N Doble faz";
  return key;
}

// Hojas por archivo (para anillado)
function sheetsForFile(f){
  // SF: hojas = páginas; DF: hojas = ceil(páginas/2)
  return (f.faz === "df") ? ceilDiv(f.pages, 2) : f.pages;
}

// Divide anillado si supera 350 hojas (por anillado)
function bindingCostForSheetsWithSplit(cfg, totalSheetsOneCopy){
  const maxSheets = 350;
  let remaining = Math.max(0, totalSheetsOneCopy);
  let cost = 0;
  let parts = 0;

  while (remaining > 0){
    const chunk = Math.min(maxSheets, remaining);
    cost += bindingPrice(cfg.binding.tiers_by_sheets, chunk);
    remaining -= chunk;
    parts += 1;
  }
  return { cost, parts };
}

function buildImpresionesDisplaySkeleton(raw){
  const cfg = CONFIG.items.impresiones;

  const fileCount = raw.files?.length || 0;
  const totalPagesOneCopy = (raw.files || []).reduce((s,f)=> s + (f.pages || 0), 0);
  const totalSheetsOneCopy = (raw.files || []).reduce((s,f)=> s + sheetsForFile(f), 0);

  const groups = {};
  for (const f of (raw.files || [])){
    const gk = groupKeyFromFile(f);
    groups[gk] = (groups[gk] || 0) + (f.pages || 0);
  }

  const groupLines = Object.keys(groups).sort().map(k => `${groupLabel(k)}: ${groups[k]} pág`).join(" | ");

  const anillTxt = (raw.anillado === "si")
    ? (raw.anilladoModo === "juntos" ? "Sí (Juntos)" : "Sí (Separados)")
    : "No";

  return {
    title: cfg.label,
    subtitle: `${fileCount} archivo(s) — ${groupLines || "sin datos"}`,
    total: 0,
    breakdown: [
      ["Ejemplares", String(raw.ejemplares || 1)],
      ["Archivos", String(fileCount)],
      ["Páginas (1 ejemplar)", String(totalPagesOneCopy)],
      ["Hojas (1 ejemplar)", String(totalSheetsOneCopy)],
      ["Anillado", anillTxt],
      ["Total ítem", moneyARS(0)]
    ]
  };
}

// Recalcula TODAS las impresiones del carrito aplicando escala por páginas del grupo
function recalcImpresionesGlobal(){
  const cfg = CONFIG.items.impresiones;

  const impItems = CART.filter(it => it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones");
  if (impItems.length === 0) return;

  // Total de páginas por grupo (considera ejemplares)
  const groupTotals = { bn_sf:0, bn_df:0, color:0 };

  for (const it of impItems){
    const r = it.raw;
    const ej = r.ejemplares || 1;
    for (const f of (r.files || [])){
      const gk = groupKeyFromFile(f);
      groupTotals[gk] += (f.pages || 0) * ej;
    }
  }

  // Unit price por grupo
  const unit = { bn_sf:0, bn_df:0, color:0 };

  // Color
  if (groupTotals.color > 0){
    const up = tierPrice(cfg.color.price_tiers_per_page, groupTotals.color);
    unit.color = (up === null) ? 0 : up;
  }

  // BN SF
  if (groupTotals.bn_sf > 0){
    const up = tierPrice(cfg.bn.sf, groupTotals.bn_sf);
    unit.bn_sf = (up === null) ? 0 : up;
  }

  // BN DF
  if (groupTotals.bn_df > 0){
    const up = tierPrice(cfg.bn.df, groupTotals.bn_df);
    unit.bn_df = (up === null) ? 0 : up;
  }

  // Ahora actualizo cada ítem
  for (const it of impItems){
    const r = it.raw;
    const ej = r.ejemplares || 1;

    // Printing subtotal por grupo dentro del ítem
    const itemGroupPages = { bn_sf:0, bn_df:0, color:0 };
    for (const f of (r.files || [])){
      const gk = groupKeyFromFile(f);
      itemGroupPages[gk] += (f.pages || 0);
    }

    const itemGroupPagesWithEj = {
      bn_sf: itemGroupPages.bn_sf * ej,
      bn_df: itemGroupPages.bn_df * ej,
      color: itemGroupPages.color * ej,
    };

    const sub_bn_sf = itemGroupPagesWithEj.bn_sf * unit.bn_sf;
    const sub_bn_df = itemGroupPagesWithEj.bn_df * unit.bn_df;
    const sub_color = itemGroupPagesWithEj.color * unit.color;

    const printingTotal = sub_bn_sf + sub_bn_df + sub_color;

    // Binding
    let bindingTotal = 0;
    let bindingPartsPerCopy = 0;

    if (r.anillado === "si"){
      if (r.anilladoModo === "juntos"){
        const totalSheetsOneCopy = (r.files || []).reduce((s,f)=> s + sheetsForFile(f), 0);
        const { cost, parts } = bindingCostForSheetsWithSplit(cfg, totalSheetsOneCopy);
        bindingPartsPerCopy = parts;
        bindingTotal = cost * ej;
      } else {
        // separados: cada archivo puede dividirse si >350 hojas
        let perCopy = 0;
        let parts = 0;
        for (const f of (r.files || [])){
          const sheets = sheetsForFile(f);
          const res = bindingCostForSheetsWithSplit(cfg, sheets);
          perCopy += res.cost;
          parts += res.parts;
        }
        bindingPartsPerCopy = parts;
        bindingTotal = perCopy * ej;
      }
    }

    it.total = printingTotal + bindingTotal;

    // Armado de breakdown claro (para vos por WhatsApp)
    const lines = [];

    // Resumen de archivos
    const files = r.files || [];
    const fileSummary = files.map((f, idx) => {
      const t = (f.mode === "color") ? "Color" : "B/N";
      const z = (f.faz === "df") ? "DF" : "SF";
      return `A${idx+1}:${f.pages}p ${t} ${z}`;
    }).join(", ");

    lines.push(["Archivos", `${files.length} — ${fileSummary}`]);
    lines.push(["Ejemplares", String(ej)]);

    // Grupos y escalas
    const gt = groupTotals;
    lines.push(["Grupo B/N SF", `${itemGroupPagesWithEj.bn_sf} pág (grupo: ${gt.bn_sf}) — ${moneyARS(unit.bn_sf)}/p — ${moneyARS(sub_bn_sf)}`]);
    lines.push(["Grupo B/N DF", `${itemGroupPagesWithEj.bn_df} pág (grupo: ${gt.bn_df}) — ${moneyARS(unit.bn_df)}/p — ${moneyARS(sub_bn_df)}`]);
    lines.push(["Grupo Color", `${itemGroupPagesWithEj.color} pág (grupo: ${gt.color}) — ${moneyARS(unit.color)}/p — ${moneyARS(sub_color)}`]);

    lines.push(["Subtotal impresión", moneyARS(printingTotal)]);

    const anillTxt = (r.anillado === "si")
      ? (r.anilladoModo === "juntos" ? `Sí (Juntos)` : `Sí (Separados)`)
      : "No";

    if (r.anillado === "si"){
      lines.push(["Anillado", `${anillTxt} — ${bindingPartsPerCopy} anillado(s) por ejemplar (máx 350 hojas c/u)`]);
      lines.push(["Subtotal anillado", moneyARS(bindingTotal)]);
    } else {
      lines.push(["Anillado", "No"]);
      lines.push(["Subtotal anillado", moneyARS(0)]);
    }

    lines.push(["Total ítem", moneyARS(it.total)]);

    it.subtitle = `Impresiones — ${files.length} archivo(s)`;
    it.breakdown = lines;
  }
}

// =====================================================
// PLOTEOS / FOTOS / ADHESIVO (igual que antes)
// =====================================================

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

// =====================================================
// CARRITO
// =====================================================

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
  if (EDITING_ID === id){
    clearImpresionesEditMode();
  }
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
          <div class="cart-sub">${escapeHtml(it.subtitle || "")}</div>
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

      // Pestaña Impresiones
      document.querySelector('.tab[data-tab="imp"]')?.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  $("cart_total").innerText = moneyARS(cartTotal());
}

// =====================================================
// WHATSAPP
// =====================================================

function buildWhatsAppMessage(){
  const biz = CONFIG.business;
  const total = cartTotal();

  let msg = "Hola! Quiero confirmar este pedido:\n\n";

  CART.forEach((it, idx) => {
    msg += (idx+1) + ") " + it.title + " — " + (it.subtitle || "") + " — " + moneyARS(it.total) + "\n";
    // detalle corto (solo lo más importante)
    if (it.kind === "impresiones" && it.raw && it.raw.files){
      const r = it.raw;
      const files = r.files.map((f,i) => {
        const t = (f.mode === "color") ? "Color" : "B/N";
        const z = (f.faz === "df") ? "DF" : "SF";
        return `A${i+1}:${f.pages}p ${t} ${z}`;
      }).join(", ");
      const an = (r.anillado === "si") ? (r.anilladoModo === "juntos" ? "Anillado: Juntos" : "Anillado: Separados") : "Anillado: No";
      msg += "   - Ejemplares: " + (r.ejemplares || 1) + "\n";
      msg += "   - " + an + "\n";
      msg += "   - Archivos: " + files + "\n";
    }
  });

  msg += "\nTOTAL: " + moneyARS(total) + "\n";

  const notes = ($("order_notes")?.value || "").trim();
  if (notes) msg += "\nOBSERVACIONES:\n" + notes + "\n";

  msg += "\nPago por transferencia:\n";
  msg += "Alias: " + biz.payment.alias + "\n";
  msg += "Titular: " + biz.payment.titular + "\n";
  msg += "CUIL: " + biz.payment.cuil + "\n\n";
  msg += "Adjunto comprobante y archivos.\n";
  msg += (biz.delivery_note || "");

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

// =====================================================
// UI helpers
// =====================================================

function addImpresionesFileRow(pages="", mode="bn", faz="sf"){
  const host = $("imp_files");
  const row = document.createElement("div");
  row.className = "imp-file-row";

  row.innerHTML = `
    <input data-pages type="number" min="1" step="1" placeholder="Páginas" value="${pages}">
    <select data-mode>
      <option value="bn">B/N</option>
      <option value="color">Color</option>
    </select>
    <select data-faz>
      <option value="sf">Simple faz</option>
      <option value="df">Doble faz</option>
    </select>
    <button type="button" class="btn btn-small btn-ghost">Quitar</button>
  `;

  row.querySelector('select[data-mode]').value = mode;
  row.querySelector('select[data-faz]').value = faz;

  row.querySelector("button").addEventListener("click", () => row.remove());

  // mobile: si se vuelve 2 columnas, hacemos que el input ocupe 2
  if (window.matchMedia && window.matchMedia("(max-width: 560px)").matches){
    row.querySelector('input[data-pages]').classList.add("span2");
  }

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

function resetImpresionesForm(){
  $("imp_ejemplares").value = 1;
  $("imp_anillado").value = "no";
  updateImpresionesAnilladoUI();
  $("imp_anillado_modo").value = "juntos";

  $("imp_files").innerHTML = "";
  addImpresionesFileRow("", "bn", "sf");

  $("imp_btn_add").innerText = "Agregar al carrito";
}

function setImpresionesFormFromRaw(raw){
  $("imp_ejemplares").value = raw.ejemplares ?? 1;
  $("imp_anillado").value = raw.anillado || "no";
  updateImpresionesAnilladoUI();
  $("imp_anillado_modo").value = raw.anilladoModo || "juntos";

  $("imp_files").innerHTML = "";
  for (const f of (raw.files || [])){
    addImpresionesFileRow(String(f.pages || ""), f.mode || "bn", f.faz || "sf");
  }
  if ((raw.files || []).length === 0){
    addImpresionesFileRow("", "bn", "sf");
  }

  $("imp_btn_add").innerText = "Actualizar ítem";
}

function clearImpresionesEditMode(){
  EDITING_ID = null;
  EDITING_KIND = null;
  resetImpresionesForm();
}

// =====================================================
// INIT
// =====================================================

async function loadConfig(){
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar config.json");
  CONFIG = await res.json();

  $("biz_name").innerText = CONFIG.business.name;
  $("pay_alias").innerText = CONFIG.business.payment.alias;
  $("pay_titular").innerText = CONFIG.business.payment.titular;
  $("pay_cuil").innerText = CONFIG.business.payment.cuil;
  $("delivery_note").innerText = CONFIG.business.delivery_note || "";

  // impresiones
  resetImpresionesForm();

  // ploteos
  updatePloteosPaperOptions();

  // carrito
  recalcImpresionesGlobal();
  renderCart();
}

function initEvents(){
  // Impresiones
  $("imp_add_file").addEventListener("click", () => addImpresionesFileRow("", "bn", "sf"));
  $("imp_anillado").addEventListener("change", updateImpresionesAnilladoUI);

  $("imp_btn_add").addEventListener("click", () => {
    const err = $("imp_err"); clearError(err);

    const v = validateImpresionesForm();
    if (!v.ok) return showError(err, v.error);

    const inp = getImpresionesInputs();
    const raw = {
      kind: "impresiones",
      ejemplares: inp.ejemplares,
      anillado: inp.anillado,
      anilladoModo: inp.anilladoModo,
      files: inp.files.slice()
    };

    // EDITANDO
    if (EDITING_KIND === "impresiones" && EDITING_ID){
      const display = buildImpresionesDisplaySkeleton(raw);
      updateCartItem(EDITING_ID, display, { kind:"impresiones", raw });
      clearImpresionesEditMode();
      recalcImpresionesGlobal();
      renderCart();
      return;
    }

    // NO EDITANDO: intento fusionar
    const existing = findMergeTargetImpresiones(raw);
    if (existing){
      existing.raw.files = (existing.raw.files || []).concat(raw.files || []);
      // ejemplares: mantenemos el del formulario (si querés otra regla, lo ajusto)
      existing.raw.ejemplares = raw.ejemplares;

      const display = buildImpresionesDisplaySkeleton(existing.raw);
      updateCartItem(existing.id, display, { kind:"impresiones", raw: existing.raw });

      recalcImpresionesGlobal();
      renderCart();
      resetImpresionesForm();
      return;
    }

    // nuevo
    const display = buildImpresionesDisplaySkeleton(raw);
    addToCart(display, { kind:"impresiones", raw });

    recalcImpresionesGlobal();
    renderCart();
    resetImpresionesForm();
  });

  // Ploteos
  $("plo_kind").addEventListener("change", updatePloteosPaperOptions);
  $("plo_btn_add").addEventListener("click", () => {
    const err = $("plo_err"); clearError(err);
    const r = calcPloteos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r, { kind:"ploteos", raw:null });
    renderCart();
  });

  // Fotos
  $("foto_btn_add").addEventListener("click", () => {
    const err = $("foto_err"); clearError(err);
    const r = calcFotos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r, { kind:"fotos", raw:null });
    renderCart();
  });

  // Adhesivo
  $("adh_btn_add").addEventListener("click", () => {
    const err = $("adh_err"); clearError(err);
    const r = calcAdhesivo();
    if (!r.ok) return showError(err, r.error);
    addToCart(r, { kind:"adhesivo", raw:null });
    renderCart();
  });

  // WhatsApp
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
