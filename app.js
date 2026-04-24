// Cotizador v1 - Librería Saber (Opción B: por archivo)
const BUILD_ID = "wiz-promos-active-2026-04-24";
console.log("Cotizador BUILD:", BUILD_ID);

let CONFIG = null;

let EDITING_ID = null;     // id del ítem del carrito editando
let EDITING_KIND = null;   // "impresiones"

let CART = [];
let SHOW_DETAIL = false;

// Promociones / cupones (1 código a la vez)
let PROMO_APPLIED = null; // {code,label,type,percent,kinds}
let PROMO_LAST_DISCOUNT = 0;

// Overrides (para Modo asistido si el modo avanzado no tiene esos campos)
let FOTO_LINE_OVERRIDE = null;
let FOTO_SIZE_OVERRIDE = null;
let FOTO_QTY_OVERRIDE = null;

function $(id){ return document.getElementById(id); }

function moneyARS(n){
  const v = Math.round(Number(n) || 0);
  return "$" + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


function parseMoneyARS(s){
  // "$1.234" -> 1234
  if (s === null || s === undefined) return 0;
  const t = String(s).replace(/\s/g, "");
  const digits = t.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
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
  const lineSel = $("foto_line");
  const sizeSel = $("foto_size");
  const qtyInp  = $("foto_qty");

  // Si viene del Modo asistido, los overrides mandan (evita que el modo avanzado fuerce "normal")
  const line = (FOTO_LINE_OVERRIDE !== null && FOTO_LINE_OVERRIDE !== undefined)
    ? FOTO_LINE_OVERRIDE
    : ((lineSel && lineSel.value) ? lineSel.value : "normal");

  const size = (FOTO_SIZE_OVERRIDE !== null && FOTO_SIZE_OVERRIDE !== undefined)
    ? FOTO_SIZE_OVERRIDE
    : ((sizeSel && sizeSel.value) ? sizeSel.value : "");

  const qty = (FOTO_QTY_OVERRIDE !== null && FOTO_QTY_OVERRIDE !== undefined)
    ? FOTO_QTY_OVERRIDE
    : ((qtyInp && qtyInp.value) ? clampInt(qtyInp.value, 1) : 1);

  return { line, size, qty };
}

function getFotosLineDef(cfg, lineValue){
  const lines = (cfg && cfg.lines && Array.isArray(cfg.lines) && cfg.lines.length)
    ? cfg.lines
    : [{ value:"normal", label: cfg.label, short:"Normal", description:"", sizes: (cfg.sizes || []) }];

  return lines.find(l => l.value === lineValue) || lines[0];
}

function populateFotosUI(){
  const cfg = CONFIG.items.fotos;
  const lineSel = $("foto_line");
  const sizeSel = $("foto_size");
  const note = $("foto_line_note");

  if (!lineSel || !sizeSel) return;

  const lines = (cfg.lines && Array.isArray(cfg.lines) && cfg.lines.length)
    ? cfg.lines
    : [{ value:"normal", label: cfg.label, short:"Normal", description:"", sizes: (cfg.sizes || []) }];

  // líneas
  lineSel.innerHTML = "";
  for (const l of lines){
    const opt = document.createElement("option");
    opt.value = l.value;
    opt.textContent = l.label;
    lineSel.appendChild(opt);
  }

  // por defecto: normal si existe
  const hasNormal = lines.some(l => l.value === "normal");
  lineSel.value = hasNormal ? "normal" : lines[0].value;

  function fillSizes(){
    const ld = getFotosLineDef(cfg, lineSel.value);
    const sizes = ld.sizes || [];
    sizeSel.innerHTML = "";
    for (const s of sizes){
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      sizeSel.appendChild(opt);
    }
    // nota
    if (note){
      note.innerText = ld.description ? ld.description : "";
      note.style.display = ld.description ? "block" : "none";
    }
  }

  fillSizes();
  lineSel.addEventListener("change", fillSizes);
}

function calcFotos(){
  const cfg = CONFIG.items.fotos;
  const inp = getFotosInputs();

  const lineDef = getFotosLineDef(cfg, inp.line);
  const def = (lineDef.sizes || []).find(s => s.value === inp.size);

  if (!def) return { ok:false, error:"Tamaño inválido." };

  const subtotal = inp.qty * def.price;

  const shortLine = lineDef.short || lineDef.label || inp.line;
  const breakdown = [
    ["Línea", shortLine],
    ["Tamaño", def.label],
    ["Cantidad", String(inp.qty)],
    ["Precio unitario", moneyARS(def.price)],
    ["Subtotal", moneyARS(subtotal)]
  ];

  return {
    ok:true,
    title: cfg.label,
    subtitle: `${def.label} — ${shortLine}`,
    total: subtotal,
    breakdown
  };
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


function sumImpresiones(raw){
  const ej = raw?.ejemplares || 1;
  const files = raw?.files || [];

  let bn_sf = 0, bn_df = 0, color = 0;
  for (const f of files){
    const pages = Number(f.pages) || 0;
    if (f.mode === "color") color += pages;
    else if (f.faz === "df") bn_df += pages;
    else bn_sf += pages;
  }

  return { ej, filesCount: files.length, bn_sf, bn_df, color };
}

function resumenClienteCartItem(it){
  // Devuelve filas cortas [k,v]
  if (it.kind === "impresiones" && it.raw){
    const r = it.raw;
    const s = sumImpresiones(r);

    const parts = [];
    if (s.bn_sf) parts.push(`B/N SF: ${s.bn_sf}`);
    if (s.bn_df) parts.push(`B/N DF: ${s.bn_df}`);
    if (s.color) parts.push(`Color: ${s.color}`);
    const pagesTxt = parts.length ? parts.join(" | ") : "Sin páginas";

    const an = (r.anillado === "si")
      ? (r.anilladoModo === "juntos" ? "Sí (juntos)" : "Sí (separados)")
      : "No";

    return [
      ["Ejemplares", String(s.ej)],
      ["Archivos", String(s.filesCount)],
      ["Páginas", pagesTxt],
      ["Anillado", an],
    ];
  }

  // Para el resto: recorto a 4 filas
  const b = (it.breakdown || []).slice(0, 4);
  return b.length ? b : [];
}


function getPromoDef(code){
  const promos = CONFIG?.promos;
  if (!promos || !promos.enabled) return null;
  const list = Array.isArray(promos.codes) ? promos.codes : [];
  const norm = String(code || "").trim().toUpperCase();
  if (!norm) return null;
  return list.find(p => {
    const c = String(p.code || "").trim().toUpperCase();
    const a = (p.active === true); // por seguridad: si falta, NO está vigente
    return a && c === norm;
  }) || null;
}

function calcPromoDiscount(){
  // Devuelve descuento en pesos (>=0). No modifica totales de ítems.
  if (!PROMO_APPLIED) return 0;
  const p = PROMO_APPLIED;

  // total actual sin descuento
  const total = cartTotal();

  if (p.type === "percent_total"){
    const pct = Number(p.percent) || 0;
    return Math.max(0, Math.round(total * (pct/100)));
  }

  if (p.type === "percent_kinds"){
    const pct = Number(p.percent) || 0;
    const kinds = Array.isArray(p.kinds) ? p.kinds : [];
    const base = CART.filter(it => kinds.includes(it.kind)).reduce((s,it)=> s + (Number(it.total)||0), 0);
    return Math.max(0, Math.round(base * (pct/100)));
  }

  if (p.type === "free_binding"){
    // Suma los subtotales de anillado de todos los ítems "impresiones"
    let sum = 0;
    for (const it of CART){
      if (it.kind !== "impresiones") continue;
      const rows = it.breakdown || [];
      // Buscar "Subtotal anillado"
      const row = rows.find(([k,_]) => String(k).toLowerCase().includes("subtotal anillado"));
      if (row){
        sum += parseMoneyARS(row[1]);
      }
    }
    return Math.max(0, sum);
  }


if (p.type === "percent_adh_types"){
  const pct = Number(p.percent) || 0;
  const types = Array.isArray(p.types) ? p.types : [];
  let base = 0;
  for (const it of CART){
    if (it.kind !== "adhesivo") continue;
    const t = it.raw?.type;
    if (types.includes(t)) base += (Number(it.total)||0);
  }
  return Math.max(0, Math.round(base * (pct/100)));
}

if (p.type === "photo_premium_to_normal"){
  const fotosCfg = CONFIG?.items?.fotos;
  const lines = fotosCfg?.lines || [];
  const normal = lines.find(x => x.value === "normal") || lines[0];
  const luster = lines.find(x => x.value === "luster");
  if (!normal || !luster) return 0;

  const normalPrices = {};
  for (const s of (normal.sizes || [])){ normalPrices[s.value] = Number(s.price)||0; }
  const lusterPrices = {};
  for (const s of (luster.sizes || [])){ lusterPrices[s.value] = Number(s.price)||0; }

  const eligible = ["10x15","13x18","a4"]; // A3 fuera

  let disc = 0;
  for (const it of CART){
    if (it.kind !== "fotos") continue;
    const r = it.raw || {};
    if (r.line !== "luster") continue;
    const size = r.size;
    const qty = Number(r.qty)||0;
    if (!eligible.includes(size)) continue;
    const prem = lusterPrices[size] || 0;
    const normp = normalPrices[size] || 0;
    const diff = Math.max(0, prem - normp);
    disc += diff * qty;
  }

  const maxBase = CART
    .filter(it => it.kind==="fotos" && it.raw?.line==="luster" && eligible.includes(it.raw?.size))
    .reduce((s,it)=> s + (Number(it.total)||0), 0);

  return Math.max(0, Math.min(disc, maxBase));
}

  return 0;
}

function cartTotalFinal(){
  const t = cartTotal();
  const d = calcPromoDiscount();
  PROMO_LAST_DISCOUNT = d;
  return Math.max(0, t - d);
}

function renderCart(){
  const host = $("cart_items");
  host.innerHTML = "";

  if (CART.length === 0){
    host.innerHTML = '<div class="muted">Todavía no agregaste ítems.</div>';
    $("cart_total").innerText = moneyARS(0);
    const pa = $("promo_applied"); if (pa){ pa.style.display="none"; pa.innerHTML=""; }
    const pe = $("promo_err"); if (pe) clearError(pe);
    return;
  }

  for (const it of CART){
    const card = document.createElement("div");
    card.className = "cart-card";

    const rowsToShow = SHOW_DETAIL ? (it.breakdown || []) : resumenClienteCartItem(it);

    const lines = rowsToShow
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

  $("cart_total").innerText = moneyARS(cartTotalFinal());

  // promo UI
  const pa = $("promo_applied");
  if (pa){
    if (PROMO_APPLIED){
      const d = PROMO_LAST_DISCOUNT || 0;
      pa.style.display = "block";
      pa.innerHTML = `<b>Aplicado:</b> ${escapeHtml(PROMO_APPLIED.code)} — ${escapeHtml(PROMO_APPLIED.label || "")} — <b>- ${moneyARS(d)}</b> <button type="button" class="btn btn-small btn-ghost" id="promo_clear" style="margin-left:8px;">Quitar</button>`;
      setTimeout(()=>{
        $("promo_clear")?.addEventListener("click", ()=>{ PROMO_APPLIED=null; PROMO_LAST_DISCOUNT=0; renderCart(); });
      }, 0);
    } else {
      pa.style.display = "none";
      pa.innerHTML = "";
    }
  }
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

  const discount = calcPromoDiscount();
  const finalTotal = Math.max(0, total - discount);
  if (PROMO_APPLIED && discount > 0){
    msg += "\nSUBTOTAL: " + moneyARS(total) + "\n";
    msg += "DESCUENTO (" + PROMO_APPLIED.code + "): - " + moneyARS(discount) + "\n";
    msg += "TOTAL: " + moneyARS(finalTotal) + "\n";
  } else {
    msg += "\nTOTAL: " + moneyARS(total) + "\n";
  }


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

/* =====================================================
   WIZARD (Modo asistido) - solo UI. Usa la misma lógica
   de cálculo / descuentos: rellena campos y dispara los
   mismos botones "Agregar al carrito".
===================================================== */

let WIZARD_ACTIVE = true;

const WIZ = {
  step: 0,
  flow: null,         // "imp"|"foto"|"adh"|"plo"
  imp: {
    fileIndex: 0,
    files: []        // {pages, mode, faz}
  }
};

function setModeButtons(){
  $("btn_mode_wiz")?.classList.toggle("active", WIZARD_ACTIVE);
  $("btn_mode_adv")?.classList.toggle("active", !WIZARD_ACTIVE);
}

function showWizard(active){
  WIZARD_ACTIVE = !!active;
  setModeButtons();

  const tabs = $("tabs");
  const wiz = $("sec_wiz");

  if (tabs) tabs.style.display = WIZARD_ACTIVE ? "none" : "flex";
  if (wiz) wiz.style.display = WIZARD_ACTIVE ? "block" : "none";

  // secciones avanzadas
  const sections = ["sec_imp","sec_plo","sec_foto","sec_adh"];
  sections.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.style.display = WIZARD_ACTIVE ? "none" : "";
  });

  // toggle detalle queda visible siempre (es del carrito), no lo tocamos

  if (WIZARD_ACTIVE){
    WIZ.step = 0;
    WIZ.flow = null;
    WIZ.imp = { fileIndex:0, files:[] };
    renderWizard();
  } else {
    // volver a mostrar la pestaña activa actual (como está)
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById("sec_imp")?.classList.add("active");
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelector('.tab[data-tab="imp"]')?.classList.add("active");
  }
}

function wizSetError(msg){
  const err = $("wiz_err");
  if (!err) return;
  if (!msg){
    err.innerText = "";
    err.style.display = "none";
  } else {
    err.innerText = msg;
    err.style.display = "block";
  }
}

function wizSetSteps(txt){
  const el = $("wiz_steps");
  if (el) el.textContent = txt || "";
}

function wizSetActions(html){
  const el = $("wiz_actions");
  if (el) el.innerHTML = html || "";
}

function renderWizard(){
  wizSetError("");
  const host = $("wiz_host");
  if (!host) return;

  // Paso 0: elegir rubro
  if (WIZ.step === 0){
    wizSetSteps("Paso 1/2 — Elegí qué querés cotizar");
    host.innerHTML = `
      <div class="muted">Respondé estas preguntas y el sistema arma el ítem y lo agrega al carrito.</div>

      <div class="wiz-grid2" style="margin-top:10px;">
        <button type="button" class="btn btn-primary" id="wiz_go_imp">Impresiones</button>
        <button type="button" class="btn btn-primary" id="wiz_go_foto">Fotos</button>
        <button type="button" class="btn btn-primary" id="wiz_go_adh">Adhesivo / Stickers</button>
        <button type="button" class="btn btn-primary" id="wiz_go_plo">Ploteos</button>
      </div>
    `;
    wizSetActions(`<button type="button" class="btn btn-ghost" id="wiz_to_adv">Ir al modo avanzado</button>`);
    $("wiz_go_imp").onclick = ()=>{ WIZ.flow="imp"; WIZ.step=10; WIZ.imp={fileIndex:0, files:[]}; renderWizard(); };
    $("wiz_go_foto").onclick = ()=>{ WIZ.flow="foto"; WIZ.step=20; renderWizard(); };
    $("wiz_go_adh").onclick = ()=>{ WIZ.flow="adh"; WIZ.step=30; renderWizard(); };
    $("wiz_go_plo").onclick = ()=>{ WIZ.flow="plo"; WIZ.step=40; renderWizard(); };
    $("wiz_to_adv").onclick = ()=> showWizard(false);
    return;
  }

  // IMPRESIONES
  if (WIZ.flow === "imp"){
    // Paso 10: cuántos archivos
    if (WIZ.step === 10){
      wizSetSteps("Impresiones — Paso 1/3 — ¿Cuántos archivos vas a imprimir?");
      host.innerHTML = `
        <label>Cantidad de archivos</label>
        <input id="wiz_imp_n" type="number" min="1" step="1" value="${Math.max(1, WIZ.imp.files.length || 1)}" />
        <div class="muted">Cada archivo puede tener distinta cantidad de páginas, color y faz.</div>
      `;
      wizSetActions(`
        <button type="button" class="btn btn-ghost" id="wiz_back0">Volver</button>
        <button type="button" class="btn btn-secondary" id="wiz_next_imp_n">Siguiente</button>
      `);
      $("wiz_back0").onclick = ()=>{ WIZ.step=0; WIZ.flow=null; renderWizard(); };
      $("wiz_next_imp_n").onclick = ()=>{
        const n = clampInt($("wiz_imp_n").value, 1);
        WIZ.imp.files = Array.from({length:n}, (_,i)=> WIZ.imp.files[i] || {pages:0, mode:"bn", faz:"sf"});
        WIZ.imp.fileIndex = 0;
        WIZ.step = 11;
        renderWizard();
      };
      return;
    }

    // Paso 11: archivo i
    if (WIZ.step === 11){
      const i = WIZ.imp.fileIndex;
      const total = WIZ.imp.files.length;
      const f = WIZ.imp.files[i] || {pages:0, mode:"bn", faz:"sf"};
      wizSetSteps(`Impresiones — Paso 2/3 — Archivo ${i+1} de ${total}`);
      host.innerHTML = `
        <div class="muted">Completá este archivo. Después pasamos al siguiente.</div>

        <div class="wiz-grid3" style="margin-top:10px;">
          <div>
            <label>Páginas</label>
            <input id="wiz_imp_pages" type="number" min="1" step="1" value="${f.pages ? escapeHtml(String(f.pages)) : ""}" placeholder="Ej: 12" />
          </div>
          <div>
            <label>Color</label>
            <select id="wiz_imp_mode">
              <option value="bn">B/N</option>
              <option value="color">Color</option>
            </select>
          </div>
          <div>
            <label>Faz</label>
            <select id="wiz_imp_faz">
              <option value="sf">Simple faz</option>
              <option value="df">Doble faz</option>
            </select>
          </div>
        </div>
      `;
      $("wiz_imp_mode").value = f.mode || "bn";
      $("wiz_imp_faz").value = f.faz || "sf";

      const backBtn = (i===0) ? `<button type="button" class="btn btn-ghost" id="wiz_back_imp_n">Atrás</button>`
                              : `<button type="button" class="btn btn-ghost" id="wiz_prev_file">Archivo anterior</button>`;
      const nextLabel = (i === total-1) ? "Continuar" : "Siguiente archivo";

      wizSetActions(`
        <button type="button" class="btn btn-ghost" id="wiz_cancel_imp">Cancelar</button>
        ${backBtn}
        <button type="button" class="btn btn-secondary" id="wiz_next_file">${nextLabel}</button>
      `);

      $("wiz_cancel_imp").onclick = ()=>{ WIZ.step=0; WIZ.flow=null; renderWizard(); };
      if (i===0){
        $("wiz_back_imp_n").onclick = ()=>{ WIZ.step=10; renderWizard(); };
      } else {
        $("wiz_prev_file").onclick = ()=>{
          const ok = wizSaveImpFile();
          if (!ok) return;
          WIZ.imp.fileIndex = Math.max(0, WIZ.imp.fileIndex - 1);
          renderWizard();
        };
      }

      $("wiz_next_file").onclick = ()=>{
        const ok = wizSaveImpFile();
        if (!ok) return;
        if (WIZ.imp.fileIndex < total-1){
          WIZ.imp.fileIndex += 1;
          renderWizard();
        } else {
          WIZ.step = 12;
          renderWizard();
        }
      };
      return;
    }

    // Paso 12: ejemplares + anillado
    if (WIZ.step === 12){
      wizSetSteps("Impresiones — Paso 3/3 — Ejemplares y anillado");
      host.innerHTML = `
        <div class="wiz-grid3" style="margin-top:10px;">
          <div>
            <label>Ejemplares</label>
            <input id="wiz_imp_ej" type="number" min="1" step="1" value="1" />
            <div class="muted">Cuántas copias de todo el conjunto.</div>
          </div>
          <div>
            <label>Anillado</label>
            <select id="wiz_imp_an">
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>
          <div id="wiz_imp_an_modo_wrap" style="display:none;">
            <label>¿Juntos o separados?</label>
            <select id="wiz_imp_an_modo">
              <option value="juntos">Juntos</option>
              <option value="separados">Separados</option>
            </select>
          </div>
        </div>

        <div class="muted" style="margin-top:10px;">
          Tip: si todos tus archivos son iguales (mismo tipo y faz), podés cargar menos archivos sumando las páginas.
        </div>
      `;

      const updateAn = ()=>{
        const v = $("wiz_imp_an").value;
        $("wiz_imp_an_modo_wrap").style.display = (v==="si") ? "block" : "none";
      };
      $("wiz_imp_an").addEventListener("change", updateAn);
      updateAn();

      wizSetActions(`
        <button type="button" class="btn btn-ghost" id="wiz_back_files">Atrás</button>
        <button type="button" class="btn btn-secondary" id="wiz_add_imp">Agregar al carrito</button>
        <button type="button" class="btn btn-ghost" id="wiz_home">Otra cotización</button>
      `);

      $("wiz_back_files").onclick = ()=>{ WIZ.step=11; WIZ.imp.fileIndex = Math.max(0, WIZ.imp.files.length-1); renderWizard(); };

      $("wiz_add_imp").onclick = ()=>{
        // Relleno los campos del modo avanzado y disparo el mismo botón
        // 1) reset form para tener rows limpias
        clearImpresionesEditMode(); // vuelve a estado base
        $("imp_ejemplares").value = clampInt($("wiz_imp_ej").value, 1);
        $("imp_anillado").value = $("wiz_imp_an").value;
        updateImpresionesAnilladoUI();
        if ($("wiz_imp_an").value === "si"){
          $("imp_anillado_modo").value = $("wiz_imp_an_modo").value;
        }

        // files
        $("imp_files").innerHTML = "";
        for (const f of WIZ.imp.files){
          addImpresionesFileRow(String(f.pages||""), f.mode || "bn", f.faz || "sf");
        }

        // click original (misma lógica)
        $("imp_btn_add").click();

        // Si no hubo error, vuelvo al inicio del wizard
        const impErr = $("imp_err");
        const hadErr = impErr && impErr.style.display !== "none" && (impErr.innerText || "").trim();
        if (hadErr){
          wizSetError("Revisá: " + hadErr);
          return;
        }

        WIZ.step=0; WIZ.flow=null; WIZ.imp={fileIndex:0, files:[]};
        renderWizard();
      };

      $("wiz_home").onclick = ()=>{ WIZ.step=0; WIZ.flow=null; renderWizard(); };
      return;
    }

    return;
  }

  // FOTOS
  if (WIZ.flow === "foto"){
    wizSetSteps("Fotos — Elegí línea, tamaño y cantidad");
    const lines = (CONFIG?.items?.fotos?.lines || []);
    const sizes = (CONFIG?.items?.fotos?.sizes || []);
    const lineOptions = lines.map(l => `<option value="${escapeHtml(l.value)}">${escapeHtml(l.label)}</option>`).join("");
    host.innerHTML = `
      <div class="muted" id="wiz_foto_desc"></div>

      <div class="wiz-grid3" style="margin-top:10px;">
        <div>
          <label>Línea</label>
          <select id="wiz_foto_line">${lineOptions}</select>
        </div>
        <div>
          <label>Tamaño</label>
          <select id="wiz_foto_size"></select>
        </div>
        <div>
          <label>Cantidad</label>
          <input id="wiz_foto_qty" type="number" min="1" step="1" value="1" />
        </div>
      </div>
    `;

    
function applyFotoLine(){
  const lv = $("wiz_foto_line").value;
  const line = lines.find(x=>x.value===lv) || lines[0];

  // descripción breve
  const desc = line?.description || line?.desc || "";
  $("wiz_foto_desc").textContent = desc;

  // tamaños: si la línea trae tamaños propios, se usan esos (incluye A3 en Luster)
  const lineSizes = Array.isArray(line?.sizes) && line.sizes.length ? line.sizes : null;

  const sel = $("wiz_foto_size");
  sel.innerHTML = "";

  const source = lineSizes ? lineSizes : sizes;

  for (const s of source){
    // soporta config en formato objeto {value,label,price} o lista de values
    const v = (typeof s === "string") ? s : s.value;
    const label = (typeof s === "string")
      ? (sizes.find(x=>x.value===s)?.label || s)
      : (s.label || v);

    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = label;
    sel.appendChild(opt);
  }
}
$("wiz_foto_line").addEventListener("change", applyFotoLine);("change", applyFotoLine);
    applyFotoLine();

    wizSetActions(`
      <button type="button" class="btn btn-ghost" id="wiz_back0b">Volver</button>
      <button type="button" class="btn btn-secondary" id="wiz_add_foto">Agregar al carrito</button>
    `);

    $("wiz_back0b").onclick = ()=>{ WIZ.step=0; WIZ.flow=null; renderWizard(); };
    $("wiz_add_foto").onclick = ()=>{
      // set overrides (por si el modo avanzado no tiene esos campos visibles/opciones)
      FOTO_LINE_OVERRIDE = $("wiz_foto_line").value;
      FOTO_SIZE_OVERRIDE = $("wiz_foto_size").value;
      FOTO_QTY_OVERRIDE  = clampInt($("wiz_foto_qty").value, 1);

      // set advanced form fields when exist
      if ($("foto_line")) $("foto_line").value = FOTO_LINE_OVERRIDE;
      populateFotosUI();
      if ($("foto_size")) $("foto_size").value = FOTO_SIZE_OVERRIDE;
      if ($("foto_qty")) $("foto_qty").value = FOTO_QTY_OVERRIDE;

      $("foto_btn_add").click();

      const err = $("foto_err");
      const hadErr = err && err.style.display !== "none" && (err.innerText||"").trim();
      if (hadErr){ wizSetError("Revisá: " + hadErr); return; }

      // clear overrides after successful add
      FOTO_LINE_OVERRIDE = null;
      FOTO_SIZE_OVERRIDE = null;
      FOTO_QTY_OVERRIDE = null;

      WIZ.step=0; WIZ.flow=null; renderWizard();
    };
    return;
  }

  // ADHESIVO
  if (WIZ.flow === "adh"){
    wizSetSteps("Adhesivo / Stickers — Elegí tipo y cantidad");
    host.innerHTML = `
      <div class="muted">A4 y A3 adhesivo. Stickers con precorte en adhesivo fotográfico.</div>

      <div class="wiz-grid2" style="margin-top:10px;">
        <div>
          <label>Tipo</label>
          <select id="wiz_adh_type">
            <option value="foto">Adhesivo fotográfico A4</option>
            <option value="obra">Adhesivo obra A4</option>
            <option value="foto_a3">Adhesivo fotográfico A3</option>
            <option value="obra_a3">Adhesivo obra A3</option>
            <option value="stickers_a4">Stickers con precorte A4 (adhesivo fotográfico)</option>
            <option value="stickers_a3">Stickers con precorte A3 (adhesivo fotográfico)</option>
          </select>
        </div>
        <div>
          <label>Cantidad</label>
          <input id="wiz_adh_qty" type="number" min="1" step="1" value="1" />
        </div>
      </div>
    `;

    wizSetActions(`
      <button type="button" class="btn btn-ghost" id="wiz_back0c">Volver</button>
      <button type="button" class="btn btn-secondary" id="wiz_add_adh">Agregar al carrito</button>
    `);

    $("wiz_back0c").onclick = ()=>{ WIZ.step=0; WIZ.flow=null; renderWizard(); };
    $("wiz_add_adh").onclick = ()=>{
      $("adh_type").value = $("wiz_adh_type").value;
      $("adh_qty").value = clampInt($("wiz_adh_qty").value, 1);
      $("adh_btn_add").click();

      const err = $("adh_err");
      const hadErr = err && err.style.display !== "none" && (err.innerText||"").trim();
      if (hadErr){ wizSetError("Revisá: " + hadErr); return; }

      // clear overrides after successful add
      FOTO_LINE_OVERRIDE = null;
      FOTO_SIZE_OVERRIDE = null;
      FOTO_QTY_OVERRIDE = null;

      WIZ.step=0; WIZ.flow=null; renderWizard();
    };
    return;
  }

  // PLOTEOS
  if (WIZ.flow === "plo"){
    wizSetSteps("Ploteos — Elegí tipo, papel y medida");
    host.innerHTML = `
      <div class="muted">Se cobra por metro lineal. El sistema rota y elige el rollo más conveniente.</div>

      <div class="wiz-grid2" style="margin-top:10px;">
        <div>
          <label>Tipo</label>
          <select id="wiz_plo_kind">
            <option value="cad">Planos / líneas (CAD)</option>
            <option value="pleno">Afiche / Póster (Pleno)</option>
          </select>
        </div>
        <div>
          <label>Papel</label>
          <select id="wiz_plo_paper"></select>
        </div>
      </div>

      <div class="wiz-grid3" style="margin-top:10px;">
        <div>
          <label>Ancho (cm)</label>
          <input id="wiz_plo_w" type="number" min="1" step="0.1" placeholder="Ej: 60" />
        </div>
        <div>
          <label>Alto (cm)</label>
          <input id="wiz_plo_h" type="number" min="1" step="0.1" placeholder="Ej: 40" />
        </div>
        <div>
          <label>Copias</label>
          <input id="wiz_plo_c" type="number" min="1" step="1" value="1" />
        </div>
      </div>
    `;

    function applyPlo(){
      $("plo_kind").value = $("wiz_plo_kind").value;
      updatePloteosPaperOptions();
      // copy papers to wizard select
      const advPaper = $("plo_paper");
      const wizPaper = $("wiz_plo_paper");
      wizPaper.innerHTML = "";
      Array.from(advPaper.options).forEach(o=>{
        const opt = document.createElement("option");
        opt.value = o.value;
        opt.textContent = o.textContent;
        wizPaper.appendChild(opt);
      });
    }
    $("wiz_plo_kind").addEventListener("change", applyPlo);
    applyPlo();

    wizSetActions(`
      <button type="button" class="btn btn-ghost" id="wiz_back0d">Volver</button>
      <button type="button" class="btn btn-secondary" id="wiz_add_plo">Agregar al carrito</button>
    `);

    $("wiz_back0d").onclick = ()=>{ WIZ.step=0; WIZ.flow=null; renderWizard(); };
    $("wiz_add_plo").onclick = ()=>{
      $("plo_kind").value = $("wiz_plo_kind").value;
      updatePloteosPaperOptions();
      $("plo_paper").value = $("wiz_plo_paper").value;
      $("plo_w").value = $("wiz_plo_w").value;
      $("plo_h").value = $("wiz_plo_h").value;
      $("plo_copias").value = clampInt($("wiz_plo_c").value, 1);
      $("plo_btn_add").click();

      const err = $("plo_err");
      const hadErr = err && err.style.display !== "none" && (err.innerText||"").trim();
      if (hadErr){ wizSetError("Revisá: " + hadErr); return; }

      // clear overrides after successful add
      FOTO_LINE_OVERRIDE = null;
      FOTO_SIZE_OVERRIDE = null;
      FOTO_QTY_OVERRIDE = null;

      WIZ.step=0; WIZ.flow=null; renderWizard();
    };
    return;
  }
}

function wizSaveImpFile(){
  const pages = clampInt($("wiz_imp_pages").value, 0);
  if (pages <= 0){
    wizSetError("Ingresá páginas (> 0).");
    return false;
  }
  const mode = $("wiz_imp_mode").value;
  const faz  = $("wiz_imp_faz").value;

  const i = WIZ.imp.fileIndex;
  WIZ.imp.files[i] = { pages, mode, faz };
  wizSetError("");
  return true;
}

function initWizard(){
  // Botones modo
  $("btn_mode_wiz")?.addEventListener("click", ()=> showWizard(true));
  $("btn_mode_adv")?.addEventListener("click", ()=> showWizard(false));

  // Default: asistido
  showWizard(true);
}

// INIT
// =====================================================


async function loadRemotePromos(){
  const promos = CONFIG?.promos;
  if (!promos) return null;

  const src = promos.source || "local";
  const url = (promos.remote_url || "").trim();

  if ((src === "remote" || src === "remote_then_local") && url){
    try{
      const u = promos.cache_bust ? (url + (url.includes("?") ? "&" : "?") + "v=" + Date.now()) : url;
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || typeof data !== "object") throw new Error("JSON inválido");

      const merged = { ...promos, ...data };
      merged.codes = Array.isArray(merged.codes) ? merged.codes : [];
      return merged;
    } catch(e){
      console.warn("Promos remotas: no se pudo cargar (" + (e.message||e) + ").");
      if (src === "remote") return { ...promos, enabled:false, codes:[] };
      return null;
    }
  }
  return null;
}

async function loadConfig(){
  const res = await fetch("./config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar config.json");
  CONFIG = await res.json();

  // Promos remotas (opcional)
  const remotePromos = await loadRemotePromos();
  if (remotePromos){
    CONFIG.promos = remotePromos;
  }


  $("biz_name").innerText = CONFIG.business.name;
  $("pay_alias").innerText = CONFIG.business.payment.alias;
  $("pay_titular").innerText = CONFIG.business.payment.titular;
  $("pay_cuil").innerText = CONFIG.business.payment.cuil;
  $("delivery_note").innerText = CONFIG.business.delivery_note || "";

  // impresiones
  resetImpresionesForm();

  // ploteos
  updatePloteosPaperOptions();

  // fotos
  populateFotosUI();

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
    const inp = getFotosInputs();
    addToCart(r, { kind:"fotos", raw:{ line: inp.line, size: inp.size, qty: inp.qty } });
    renderCart();
  });

  // Adhesivo
  $("adh_btn_add").addEventListener("click", () => {
    const err = $("adh_err"); clearError(err);
    const r = calcAdhesivo();
    if (!r.ok) return showError(err, r.error);
    const inp = getAdhInputs();
    addToCart(r, { kind:"adhesivo", raw:{ type: inp.type } });
    renderCart();
  });

  // WhatsApp
  $("btn_whatsapp").addEventListener("click", openWhatsApp);

  // Promos
  $("promo_apply")?.addEventListener("click", ()=>{
    const err = $("promo_err"); if (err) clearError(err);
    const code = ($("promo_code")?.value || "").trim().toUpperCase();
    if (!code){
      if (err) return showError(err, "Ingresá un código.");
      return;
    }
    const def = getPromoDef(code);
    if (!def){
      if (err) return showError(err, "Código inválido o promoción no vigente.");
      return;
    }
    PROMO_APPLIED = {
      code: String(def.code||"").trim().toUpperCase(),
      label: def.label || "",
      type: def.type || "",
      percent: def.percent,
      kinds: def.kinds
    };
    if ($("promo_code")) $("promo_code").value = PROMO_APPLIED.code;
    renderCart();
  });

  $("promo_code")?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter"){
      e.preventDefault();
      $("promo_apply")?.click();
    }
  });

  // Carrito (resumen vs detalle)
  $("toggle_detail")?.addEventListener("change", (e) => {
    SHOW_DETAIL = !!e.target.checked;
    renderCart();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try{
    await loadConfig();
    initEvents();
  
    initWizard();
} catch(e){
    console.error(e);
    alert("Error cargando el cotizador: " + (e.message || e));
  }
});
