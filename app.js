// Cotizador v1 - Librería Saber
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
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function showError(where, msg){ where.innerText = msg; where.style.display = "block"; }
function clearError(where){ where.innerText = ""; where.style.display = "none"; }

// ======================
// IMPRESIONES - FORM
// ======================

function getImpresionesInputs(){
  const mode = $("imp_mode").value; // bn | color
  const faz = $("imp_faz").value;   // sf | df (faz del/los archivos que estás cargando ahora)
  const copias = clampInt($("imp_copias").value, 1);

  const fileRows = Array.from(document.querySelectorAll(".imp-file-row"));
  const pagesPerFile = fileRows
    .map(r => clampInt(r.querySelector("input").value, 0))
    .filter(x => x > 0);

  const anillado = $("imp_anillado").value; // no | si
  const anilladoModo = $("imp_anillado_modo").value; // juntos | separados

  return { mode, faz, copias, pagesPerFile, anillado, anilladoModo };
}

function calcImpresionesFormOnly(){
  const inp = getImpresionesInputs();
  if (inp.pagesPerFile.length === 0){
    return { ok:false, error:"Ingresá al menos 1 archivo con páginas." };
  }
  return { ok:true };
}

function getImpresionesRawNormalized(){
  const inp = getImpresionesInputs();
  // Guardamos archivos con su faz (esto es lo que te faltaba)
  const files = inp.pagesPerFile.map(p => ({ pages: p, faz: inp.faz }));

  return {
    kind: "impresiones",
    mode: inp.mode,                 // bn | color
    ejemplares: inp.copias,         // cantidad de veces
    files,                          // [{pages, faz}]
    anillado: inp.anillado,         // no | si
    anilladoModo: inp.anilladoModo  // juntos | separados
  };
}

// Compatibilidad para "fusionar" (mismo tipo + mismo anillado/mode)
function impresionesKey(raw){
  return [
    raw.mode,
    raw.anillado,
    raw.anillado === "si" ? raw.anilladoModo : "na"
  ].join("|");
}
function findCompatibleImpresionesItem(raw){
  const key = impresionesKey(raw);
  return CART.find(it => it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones" && impresionesKey(it.raw) === key) || null;
}

function buildImpresionesDisplayFromRaw(raw){
  const cfg = CONFIG.items.impresiones;

  const label = (raw.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
  const files = raw.files || [];

  // Contadores por faz (1 ejemplar)
  const oneSfPages = files.reduce((s,f)=> s + ((f.faz==="sf") ? (f.pages||0) : 0), 0);
  const oneDfPages = files.reduce((s,f)=> s + ((f.faz==="df") ? (f.pages||0) : 0), 0);

  const ej = raw.ejemplares || 1;
  const totalSf = oneSfPages * ej;
  const totalDf = oneDfPages * ej;

  const breakdown = [
    ["Archivos", String(files.length)],
    ["Ejemplares", String(ej)],
    ["Páginas B/N/Color SF (total)", String(totalSf)],
    ["Páginas B/N/Color DF (total)", String(totalDf)],
    ["Anillado", (raw.anillado === "si") ? (raw.anilladoModo === "separados" ? "Separados" : "Juntos") : "No"],
    ["Total ítem", moneyARS(0)]
  ];

  return {
    title: cfg.label,
    subtitle: label,
    total: 0,
    breakdown
  };
}

// Hojas por archivo según faz
function sheetsForFile(pages, faz){
  const p = Math.max(0, Number(pages)||0);
  return (faz === "df") ? ceilDiv(p, 2) : p;
}
function splitPacks350(totalSheets){
  let r = Math.max(0, Number(totalSheets)||0);
  const packs = [];
  while (r > 0){
    const chunk = Math.min(350, r);
    packs.push(chunk);
    r -= chunk;
  }
  return packs;
}

// Recalcula impresiones agrupando: color / bn_sf / bn_df
function recalcImpresionesGlobal(){
  const cfg = CONFIG.items.impresiones;
  const impItems = CART.filter(it => it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones");
  if (impItems.length === 0) return;

  // Armo grupos por escala:
  // - Color: una escala, indep. de faz
  // - B/N: dos escalas distintas por faz
  const groups = { color: [], bn_sf: [], bn_df: [] };

  for (const it of impItems){
    const r = it.raw;
    const files = r.files || [];

    if (r.mode === "color"){
      groups.color.push(it);
    } else {
      // B/N: el mismo ítem puede tener SF y DF: lo “partimos” lógicamente para el cálculo unitario,
      // pero el ítem final sigue siendo uno (solo separa páginas para precio).
      // Lo resolvemos calculando páginas SF/DF y sumándolas a los grupos correspondientes,
      // manteniendo referencia al ítem.
      groups.bn_sf.push(it);
      groups.bn_df.push(it);
    }
  }

  // Total páginas por grupo (para obtener unitario)
  let totalColorPages = 0;
  let totalBnSfPages = 0;
  let totalBnDfPages = 0;

  for (const it of impItems){
    const r = it.raw;
    const ej = r.ejemplares || 1;
    const files = r.files || [];
    const sfPages = files.reduce((s,f)=> s + ((f.faz==="sf") ? (f.pages||0) : 0), 0) * ej;
    const dfPages = files.reduce((s,f)=> s + ((f.faz==="df") ? (f.pages||0) : 0), 0) * ej;

    if (r.mode === "color"){
      totalColorPages += (sfPages + dfPages); // color cobra por página igual
    } else {
      totalBnSfPages += sfPages;
      totalBnDfPages += dfPages;
    }
  }

  // Unitarios
  let unitColor = tierPrice(cfg.color.price_tiers_per_page, totalColorPages);
  if (unitColor === null) unitColor = 0;

  let unitBnSf = tierPrice(cfg.bn.sf, totalBnSfPages);
  if (unitBnSf === null) unitBnSf = 0;

  let unitBnDf = tierPrice(cfg.bn.df, totalBnDfPages);
  if (unitBnDf === null) unitBnDf = 0;

  // Aplico a cada ítem
  for (const it of impItems){
    const r = it.raw;
    const ej = r.ejemplares || 1;
    const files = r.files || [];

    const sfPages = files.reduce((s,f)=> s + ((f.faz==="sf") ? (f.pages||0) : 0), 0) * ej;
    const dfPages = files.reduce((s,f)=> s + ((f.faz==="df") ? (f.pages||0) : 0), 0) * ej;

    let printing = 0;
    let unitApplied = 0;

    if (r.mode === "color"){
      const pages = sfPages + dfPages;
      unitApplied = unitColor;
      printing = pages * unitApplied;
    } else {
      // B/N: se desagrupa por faz
      printing = (sfPages * unitBnSf) + (dfPages * unitBnDf);
    }

    // Anillado (se calcula por hojas, respetando DF)
    let binding = 0;
    let bindingDetail = "No";
    let bindingSheetsOne = 0;
    let bindingPacks = [];

    if (r.anillado === "si"){
      const sheetsByFile = files.map(f => sheetsForFile(f.pages||0, f.faz||"sf"));
      if (r.anilladoModo === "separados"){
        // cada archivo por separado, con regla de 350 (si pasa, se parte en 2+ anillados)
        let perCopyTotal = 0;
        let packTextArr = [];
        for (const s of sheetsByFile){
          const packs = splitPacks350(s);
          // costo = suma del costo de cada pack
          const costFile = packs.reduce((acc, p)=> acc + bindingPrice(cfg.binding.tiers_by_sheets, p), 0);
          perCopyTotal += costFile;
          packTextArr.push(packs.join("+"));
        }
        binding = perCopyTotal * ej;
        bindingDetail = "Separados";
        // para mostrar algo “claro”: sumamos hojas por ejemplar
        bindingSheetsOne = sheetsByFile.reduce((a,b)=>a+b,0);
        bindingPacks = packTextArr;
      } else {
        // juntos: suma total de hojas por ejemplar y aplica regla de 350 (parte en packs)
        const totalSheetsOne = sheetsByFile.reduce((a,b)=>a+b,0);
        const packs = splitPacks350(totalSheetsOne);
        const costPerCopy = packs.reduce((acc, p)=> acc + bindingPrice(cfg.binding.tiers_by_sheets, p), 0);
        binding = costPerCopy * ej;

        bindingDetail = "Juntos";
        bindingSheetsOne = totalSheetsOne;
        bindingPacks = packs;
      }
    }

    it.total = printing + binding;

    // Subtítulo y breakdown claro para cliente + operativo
    const label = (r.mode === "color") ? "Impresiones Color" : "Impresiones B/N";
    const filesDesc = files.map((f,i)=> `A${i+1}:${f.pages}p ${f.faz==="df"?"DF":"SF"}`).join(" | ");

    // Anillado operativo packs
    let bindingPackTxt = "";
    if (r.anillado === "si"){
      if (r.anilladoModo === "juntos"){
        bindingPackTxt = "Packs 350: " + (Array.isArray(bindingPacks) ? bindingPacks.join(" + ") : "");
      } else {
        bindingPackTxt = "Packs 350 por archivo: " + (Array.isArray(bindingPacks) ? bindingPacks.join(" | ") : "");
      }
    }

    it.subtitle = label;

    it.breakdown = [
      ["Archivos", filesDesc],
      ["Ejemplares", String(ej)],
      ["Páginas SF (total)", String(sfPages)],
      ["Páginas DF (total)", String(dfPages)],
      ["Grupo Color (pág)", String(totalColorPages)],
      ["Grupo B/N SF (pág)", String(totalBnSfPages)],
      ["Grupo B/N DF (pág)", String(totalBnDfPages)],
      ["Precio pág Color", moneyARS(unitColor)],
      ["Precio pág B/N SF", moneyARS(unitBnSf)],
      ["Precio pág B/N DF", moneyARS(unitBnDf)],
      ["Subtotal impresión", moneyARS(printing)],
      ["Anillado", (r.anillado === "si") ? bindingDetail : "No"],
      ...(r.anillado === "si" ? [
        ["Hojas por ejemplar (anillado)", String(bindingSheetsOne)],
        ["División 350", bindingPackTxt],
        ["Subtotal anillado", moneyARS(binding)]
      ] : []),
      ["Total ítem", moneyARS(it.total)]
    ];
  }
}

// ======================
// PLOTEOS / FOTOS / ADHESIVO (igual que antes)
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
// WHATSAPP (claro para ambos)
// ======================

function buildWhatsAppMessage(){
  const biz = CONFIG.business;
  const total = cartTotal();

  let msg = "PEDIDO - " + (biz.name || "Librería Saber") + "\n";
  msg += "==============================\n\n";

  // RESUMEN (cliente)
  msg += "RESUMEN\n";
  CART.forEach((it, idx) => {
    msg += (idx+1) + ") " + it.subtitle + " — " + moneyARS(it.total) + "\n";
  });
  msg += "\nTOTAL: " + moneyARS(total) + "\n\n";

  const notes = ($("order_notes")?.value || "").trim();
  if (notes) msg += "OBSERVACIONES:\n" + notes + "\n\n";

  // DETALLE (producción)
  msg += "DETALLE PARA PRODUCCIÓN\n";
  msg += "------------------------------\n";
  CART.forEach((it, idx) => {
    msg += (idx+1) + ") " + it.title + " — " + it.subtitle + "\n";

    if (it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones"){
      const r = it.raw;
      const files = r.files || [];
      msg += "   Tipo: " + (r.mode === "color" ? "COLOR" : "B/N") + "\n";
      msg += "   Ejemplares: " + (r.ejemplares || 1) + "\n";
      msg += "   Archivos:\n";
      files.forEach((f,i)=>{
        const hojas = sheetsForFile(f.pages||0, f.faz||"sf");
        msg += "     - A" + (i+1) + ": " + (f.pages||0) + " pág " + (f.faz==="df"?"DF":"SF") + " (" + hojas + " hojas)\n";
      });
      if (r.anillado === "si"){
        msg += "   Anillado: " + (r.anilladoModo === "separados" ? "SEPARADOS" : "JUNTOS") + "\n";
        if (r.anilladoModo === "juntos"){
          const totalSheetsOne = files.reduce((s,f)=> s + sheetsForFile(f.pages||0, f.faz||"sf"), 0);
          const packs = splitPacks350(totalSheetsOne);
          msg += "   Hojas por ejemplar (juntos): " + totalSheetsOne + "\n";
          msg += "   División 350: " + packs.join(" + ") + "\n";
        }
      } else {
        msg += "   Anillado: NO\n";
      }
      msg += "   Total ítem: " + moneyARS(it.total) + "\n";
    } else {
      // Para ploteos/fotos/adhesivo, el breakdown ya es suficiente
      (it.breakdown || []).forEach(([k,v]) => {
        msg += "   " + k + ": " + v + "\n";
      });
      msg += "   Total ítem: " + moneyARS(it.total) + "\n";
    }

    msg += "\n";
  });

  msg += "==============================\n";
  msg += "PAGO POR TRANSFERENCIA:\n";
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
// UI helpers
// ======================

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

function setImpresionesFormFromRaw(raw){
  $("imp_mode").value = raw.mode || "bn";
  // En edición, seteo faz en base al primer archivo (si hay mezcla, igual lo dejás como referencia)
  const firstFaz = (raw.files && raw.files[0] && raw.files[0].faz) ? raw.files[0].faz : "sf";
  $("imp_faz").value = firstFaz;
  $("imp_copias").value = raw.ejemplares ?? 1;

  // reconstruir filas SOLO con páginas (el selector de faz define cómo interpretás las nuevas filas)
  $("imp_files").innerHTML = "";
  (raw.files || []).forEach(f => addImpresionesFileRow(String(f.pages || "")));

  $("imp_anillado").value = raw.anillado || "no";
  updateImpresionesAnilladoUI();
  $("imp_anillado_modo").value = raw.anilladoModo || "juntos";

  $("imp_btn_add").innerText = "Actualizar ítem";
}

function resetImpresionesForm(){
  $("imp_mode").value = "bn";
  $("imp_faz").value = "sf";
  $("imp_copias").value = 1;
  $("imp_anillado").value = "no";
  updateImpresionesAnilladoUI();
  $("imp_anillado_modo").value = "juntos";
  $("imp_files").innerHTML = "";
  addImpresionesFileRow("");
}

function clearImpresionesEditMode(){
  EDITING_ID = null;
  EDITING_KIND = null;
  $("imp_btn_add").innerText = "Agregar al carrito";
  resetImpresionesForm();
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
  updatePloteosPaperOptions();

  recalcImpresionesGlobal();
  renderCart();
}

function initEvents(){
  // Impresiones
  $("imp_add_file").addEventListener("click", () => addImpresionesFileRow(""));
  $("imp_anillado").addEventListener("change", updateImpresionesAnilladoUI);

  $("imp_btn_add").addEventListener("click", () => {
    const err = $("imp_err"); clearError(err);

    const v = calcImpresionesFormOnly();
    if (!v.ok) return showError(err, v.error);

    const rawNew = getImpresionesRawNormalized();

    // Editando: REEMPLAZA raw completo (nota: en edición, las filas no distinguen faz;
    // si querés editar mezcla SF/DF en un mismo ítem, lo hacemos con UI más avanzada)
    if (EDITING_KIND === "impresiones" && EDITING_ID){
      const display = buildImpresionesDisplayFromRaw(rawNew);
      updateCartItem(EDITING_ID, display, { kind:"impresiones", raw: rawNew });
      clearImpresionesEditMode();
      recalcImpresionesGlobal();
      renderCart();
      return;
    }

    // No editando: fusiona con compatible (mismo mode/anillado)
    const existing = findCompatibleImpresionesItem(rawNew);
    if (existing){
      // mantiene ejemplares del último (regla simple)
      existing.raw.ejemplares = rawNew.ejemplares;

      // concatena archivos, respetando faz del bloque que se agregó
      existing.raw.files = (existing.raw.files || []).concat(rawNew.files || []);

      const display = buildImpresionesDisplayFromRaw(existing.raw);
      updateCartItem(existing.id, display, { kind:"impresiones", raw: existing.raw });

      resetImpresionesForm();
      recalcImpresionesGlobal();
      renderCart();
      return;
    }

    // Nuevo ítem
    const display = buildImpresionesDisplayFromRaw(rawNew);
    addToCart(display, { kind:"impresiones", raw: rawNew });

    resetImpresionesForm();
    recalcImpresionesGlobal();
    renderCart();
  });

  // Ploteos
  $("plo_kind").addEventListener("change", updatePloteosPaperOptions);
  $("plo_btn_add").addEventListener("click", () => {
    const err = $("plo_err"); clearError(err);
    const r = calcPloteos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
    renderCart();
  });

  // Fotos
  $("foto_btn_add").addEventListener("click", () => {
    const err = $("foto_err"); clearError(err);
    const r = calcFotos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
    renderCart();
  });

  // Adhesivo
  $("adh_btn_add").addEventListener("click", () => {
    const err = $("adh_err"); clearError(err);
    const r = calcAdhesivo();
    if (!r.ok) return showError(err, r.error);
    addToCart(r);
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
    alert("Error carg
