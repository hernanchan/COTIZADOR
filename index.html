// Cotizador v1 - Librería Saber
let CONFIG = null;

let EDITING_ID = null;     // id del ítem del carrito que estoy editando
let EDITING_KIND = null;   // "impresiones" | etc

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
// IMPRESIONES
// ======================

function getImpresionesInputs(){
  const ejemplares = clampInt($("imp_ejemplares").value, 1);
  const anillado = $("imp_anillado").value; // no | si

  const fileRows = Array.from(document.querySelectorAll(".imp-file-row"));
  const files = fileRows.map(r => {
    const pages = clampInt(r.querySelector('input[type="number"]').value, 0);
    const mode = r.querySelector('select[data-field="mode"]').value; // bn|color
    const faz  = r.querySelector('select[data-field="faz"]').value;  // sf|df
    return { pages, mode, faz };
  }).filter(f => f.pages > 0);

  return { ejemplares, anillado, files };
}

function getImpresionesRawNormalized(){
  const inp = getImpresionesInputs();
  return {
    kind: "impresiones",
    ejemplares: inp.ejemplares,
    anillado: inp.anillado,
    files: inp.files.map(f => ({ pages:f.pages, mode:f.mode, faz:f.faz }))
  };
}

function impresionesKey(raw){
  // Se fusiona SOLO si coincide el anillado (y si anillado es sí, también modo).
  // En esta versión, el tipo/faz se guarda por archivo, así que la clave no incluye mode/faz.
  return [
    raw.anillado
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
  if (!inp.files || inp.files.length === 0){
    return { ok:false, error:"Ingresá al menos 1 archivo con páginas." };
  }
  return { ok:true };
}

function buildImpresionesDisplaySkeleton(raw){
  const cfg = CONFIG.items.impresiones;

  // resumen de archivos (A1:156p B/N SF, etc)
  const filesLabel = (raw.files || []).map((f, i) => {
    const m = (f.mode === "color") ? "Color" : "B/N";
    const z = (f.faz === "df") ? "DF" : "SF";
    return `A${i+1}:${f.pages}p ${m} ${z}`;
  });

  const totalFiles = (raw.files || []).length;

  // Totales por grupo (para precio unitario por grupo)
  const sumGroup = (mode, faz) => {
    return (raw.files || [])
      .filter(f => (f.mode === mode) && (mode === "color" ? true : f.faz === faz))
      .reduce((s, f) => s + f.pages, 0) * (raw.ejemplares || 1);
  };

  const bn_sf_pages = sumGroup("bn","sf");
  const bn_df_pages = sumGroup("bn","df");
  const color_pages = sumGroup("color","sf");

  const breakdown = [
    ["Archivos", `${totalFiles} — ${filesLabel.join(" | ")}`],
    ["Ejemplares", String(raw.ejemplares || 1)],
    ["Grupo B/N SF", `${bn_sf_pages} pág`],
    ["Grupo B/N DF", `${bn_df_pages} pág`],
    ["Grupo Color", `${color_pages} pág`],
    ["Anillado", raw.anillado === "si" ? "Sí" : "No"],
    ["Total ítem", moneyARS(0)]
  ];

  return {
    title: cfg.label,
    subtitle: `Impresiones — ${totalFiles} archivo(s)`,
    total: 0,
    breakdown
  };
}

function recalcImpresionesGlobal(){
  const cfg = CONFIG.items.impresiones;

  const impItems = CART.filter(it => it.kind === "impresiones" && it.raw && it.raw.kind === "impresiones");
  if (impItems.length === 0) return;

  // 1) juntamos TODOS los archivos del carrito en 3 grupos de escala:
  // - B/N SF
  // - B/N DF
  // - Color (faz no cambia el unitario en tu config)
  const allFiles = [];
  for (const it of impItems){
    const r = it.raw;
    const ej = r.ejemplares || 1;
    for (const f of (r.files || [])){
      allFiles.push({ ownerId: it.id, pages: f.pages, mode: f.mode, faz: f.faz, ejemplares: ej });
    }
  }

  const groupPages = {
    bn_sf: 0,
    bn_df: 0,
    color: 0
  };

  for (const f of allFiles){
    const pages = f.pages * (f.ejemplares || 1);
    if (f.mode === "color"){
      groupPages.color += pages;
    } else {
      if (f.faz === "df") groupPages.bn_df += pages;
      else groupPages.bn_sf += pages;
    }
  }

  // 2) precio unitario por grupo según escala (tiers)
  let price_bn_sf = tierPrice(cfg.bn.sf, groupPages.bn_sf); if (price_bn_sf === null) price_bn_sf = 0;
  let price_bn_df = tierPrice(cfg.bn.df, groupPages.bn_df); if (price_bn_df === null) price_bn_df = 0;
  let price_color = tierPrice(cfg.color.price_tiers_per_page, groupPages.color); if (price_color === null) price_color = 0;

  // 3) recalcular cada ítem: suma de sus archivos * unitario del grupo + anillado
  for (const it of impItems){
    const r = it.raw;
    const ej = r.ejemplares || 1;

    let itemPages_bn_sf = 0;
    let itemPages_bn_df = 0;
    let itemPages_color = 0;

    for (const f of (r.files || [])){
      const p = f.pages * ej;
      if (f.mode === "color") itemPages_color += p;
      else if (f.faz === "df") itemPages_bn_df += p;
      else itemPages_bn_sf += p;
    }

    const printing =
      (itemPages_bn_sf * price_bn_sf) +
      (itemPages_bn_df * price_bn_df) +
      (itemPages_color * price_color);

    // Anillado: en esta versión lo dejamos por “ítem” (no se mezcla entre ítems),
    // y si supera 350 hojas se divide (2 anillados, 3, etc).
    let binding = 0;
    if (r.anillado === "si"){
      // hojas = páginas/2 si DF, páginas si SF, color no cambia hojas (igual)
      const sheets = (r.files || []).reduce((s, f) => {
        const isDF = (f.mode !== "color" && f.faz === "df"); // DF aplica a B/N; si tu color también puede ser DF, decímelo y lo ajusto
        const sh = isDF ? ceilDiv(f.pages, 2) : f.pages;
        return s + sh;
      }, 0) * ej;

      // límite 350 hojas por anillado
      const parts = Math.max(1, Math.ceil(sheets / 350));

      // precio del anillado por parte (según tiers por hojas) * partes
      // (si querés tiers distintos para “doble anillado”, se puede)
      const sheetsPerPart = Math.ceil(sheets / parts);
      const per = bindingPrice(cfg.binding.tiers_by_sheets, sheetsPerPart);
      binding = per * parts;
    }

    it.total = printing + binding;

    // breakdown para WhatsApp (detalle)
    const totalFiles = (r.files || []).length;
    const filesLabel = (r.files || []).map((f, i) => {
      const m = (f.mode === "color") ? "Color" : "B/N";
      const z = (f.faz === "df") ? "DF" : "SF";
      return `A${i+1}:${f.pages}p ${m} ${z}`;
    });

    it.title = cfg.label;
    it.subtitle = `Impresiones — ${totalFiles} archivo(s)`;

    it.breakdown = [
      ["Archivos", `${totalFiles} — ${filesLabel.join(" | ")}`],
      ["Ejemplares", String(ej)],
      ["Grupo B/N SF", `${itemPages_bn_sf} pág (grupo: ${groupPages.bn_sf}) — ${moneyARS(price_bn_sf)}/p`],
      ["Grupo B/N DF", `${itemPages_bn_df} pág (grupo: ${groupPages.bn_df}) — ${moneyARS(price_bn_df)}/p`],
      ["Grupo Color", `${itemPages_color} pág (grupo: ${groupPages.color}) — ${moneyARS(price_color)}/p`],
      ["Subtotal impresión", moneyARS(printing)],
      ["Anillado", (r.anillado === "si") ? "Sí" : "No"],
      ["Subtotal anillado", moneyARS(binding)],
      ["Total ítem", moneyARS(it.total)]
    ];
  }
}

// ======================
// PLOTEOS
// ======================

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
    ["Rollo elegido", best.roll + " cm"],
    ["Copias", String(inp.copias)],
    ["Subtotal", moneyARS(best.cost)]
  ];

  return { ok:true, title: cfg.label, subtitle: kindLabel + " - " + paperLabel, total: best.cost, breakdown };
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
  const breakdown = [
    ["Tamaño", def.label],
    ["Cantidad", String(inp.qty)],
    ["Subtotal", moneyARS(subtotal)]
  ];
  return { ok:true, title: cfg.label, subtitle: def.label, total: subtotal, breakdown };
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
  const breakdown = [
    ["Tipo", def.label],
    ["Cantidad", String(inp.qty)],
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

  function pickRows(rows, wanted){
    const out = [];
    for (const k of wanted){
      const found = rows.find(([kk]) => String(kk).toLowerCase() === String(k).toLowerCase());
      if (found) out.push(found);
    }
    return out;
  }

  function compactRowsForItem(it){
    const rows = Array.isArray(it.breakdown) ? it.breakdown : [];
    if (it.kind === "impresiones"){
      return pickRows(rows, ["Archivos", "Ejemplares", "Anillado", "Total ítem"]);
    }
    if (it.kind === "ploteos"){
      return pickRows(rows, ["Tipo", "Papel", "Medida ingresada (cm)", "Copias", "Subtotal"]);
    }
    if (it.kind === "fotos"){
      return pickRows(rows, ["Tamaño", "Cantidad", "Subtotal"]);
    }
    if (it.kind === "adhesivo"){
      return pickRows(rows, ["Tipo", "Cantidad", "Total"]);
    }
    return rows.slice(0, 3);
  }

  for (const it of CART){
    const card = document.createElement("div");
    card.className = "cart-card";

    const rowsAll = Array.isArray(it.breakdown) ? it.breakdown : [];
    const rowsCompact = compactRowsForItem(it);

    const compactHtml = rowsCompact
      .map(([k,v]) => `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
      .join("");

    const detailHtml = rowsAll
      .map(([k,v]) => `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
      .join("");

    const hasDetails = rowsAll.length > rowsCompact.length;

    card.innerHTML = `
      <div class="cart-head">
        <div>
          <div class="cart-title">${escapeHtml(it.title || "Ítem")}</div>
          <div class="cart-sub">${escapeHtml(it.subtitle || "")}</div>
        </div>
        <div class="cart-price">${moneyARS(it.total)}</div>
      </div>

      <div class="cart-body cart-compact">${compactHtml}</div>

      ${hasDetails ? `
        <div class="cart-actions" style="justify-content:flex-start; gap:8px;">
          <button class="btn btn-small btn-ghost" data-tg="${it.id}">Ver detalle</button>
        </div>
        <div class="cart-body cart-detail" data-det="${it.id}" style="display:none;">${detailHtml}</div>
      ` : ``}

      <div class="cart-actions" style="gap:8px;">
        ${it.kind === "impresiones" ? `<button class="btn btn-small btn-ghost" data-ed="${it.id}">Editar</button>` : ``}
        <button class="btn btn-small btn-ghost" data-rm="${it.id}">Quitar</button>
      </div>
    `;
    host.appendChild(card);
  }

  // Toggle detalle
  host.querySelectorAll("button[data-tg]").forEach(b => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-tg");
      const det = host.querySelector(`div[data-det="${CSS.escape(id)}"]`);
      if (!det) return;
      const isOpen = det.style.display !== "none";
      det.style.display = isOpen ? "none" : "block";
      b.textContent = isOpen ? "Ver detalle" : "Ocultar detalle";
    });
  });

  // Quitar
  host.querySelectorAll("button[data-rm]").forEach(b => {
    b.addEventListener("click", () => removeFromCart(b.getAttribute("data-rm")));
  });

  // Editar (Impresiones)
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

// =====================================================
// WHATSAPP
// =====================================================

function buildWhatsAppMessage(){
  const biz = CONFIG.business;
  const total = cartTotal();

  let msg = "Hola! Quiero confirmar este pedido:\n\n";

  CART.forEach((it, idx) => {
    msg += (idx+1) + ") " + (it.title || "Ítem") + " — " + moneyARS(it.total) + "\n";
    if (it.subtitle) msg += "   " + it.subtitle + "\n";

    // Detalle para que vos puedas producirlo sin dudas
    const rows = Array.isArray(it.breakdown) ? it.breakdown : [];
    for (const [k,v] of rows){
      if (String(k).toLowerCase().includes("total")) continue;
      msg += "   - " + k + ": " + v + "\n";
    }
    msg += "\n";
  });

  msg += "TOTAL: " + moneyARS(total) + "\n";

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
// UI helpers
// ======================

function addImpresionesFileRow(pages="", mode="bn", faz="sf"){
  const host = $("imp_files");
  const row = document.createElement("div");
  row.className = "imp-file-row";
  row.innerHTML = `
    <input type="number" min="1" step="1" placeholder="Páginas" value="${pages}">
    <select data-field="mode">
      <option value="bn">B/N</option>
      <option value="color">Color</option>
    </select>
    <select data-field="faz">
      <option value="sf">Simple faz</option>
      <option value="df">Doble faz</option>
    </select>
    <button type="button" class="btn btn-small btn-ghost">Quitar</button>
  `;
  row.querySelector('select[data-field="mode"]').value = mode;
  row.querySelector('select[data-field="faz"]').value = faz;
  row.querySelector("button").addEventListener("click", () => row.remove());
  host.appendChild(row);
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
  $("imp_ejemplares").value = raw.ejemplares ?? 1;
  $("imp_anillado").value = raw.anillado || "no";

  $("imp_files").innerHTML = "";
  (raw.files || []).forEach(f => addImpresionesFileRow(String(f.pages), f.mode, f.faz));

  $("imp_btn_add").innerText = "Actualizar ítem";
}

function resetImpresionesForm(){
  $("imp_ejemplares").value = 1;
  $("imp_anillado").value = "no";

  $("imp_files").innerHTML = "";
  addImpresionesFileRow("");
}

function resetPloteosForm(){
  $("plo_kind").value = "cad";
  updatePloteosPaperOptions();
  $("plo_w").value = "";
  $("plo_h").value = "";
  $("plo_copias").value = 1;
}

function resetFotosForm(){
  $("foto_size").value = "10x15";
  $("foto_qty").value = 1;
}

function resetAdhForm(){
  $("adh_type").value = "foto";
  $("adh_qty").value = 1;
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

  $("imp_btn_add").addEventListener("click", () => {
    const err = $("imp_err"); clearError(err);

    const v = calcImpresionesFormOnly();
    if (!v.ok) return showError(err, v.error);

    const raw = getImpresionesRawNormalized();

    // Editar
    if (EDITING_KIND === "impresiones" && EDITING_ID){
      const display = buildImpresionesDisplaySkeleton(raw);
      updateCartItem(EDITING_ID, display, { kind:"impresiones", raw });
      clearImpresionesEditMode();
      recalcImpresionesGlobal();
      renderCart();
      return;
    }

    // Fusionar por anillado (misma condición)
    const existing = findCompatibleImpresionesItem(raw);
    if (existing){
      existing.raw.files = (existing.raw.files || []).concat(raw.files || []);
      existing.raw.ejemplares = raw.ejemplares;
      const display = buildImpresionesDisplaySkeleton(existing.raw);
      updateCartItem(existing.id, display, { kind:"impresiones", raw: existing.raw });
      recalcImpresionesGlobal();
      renderCart();
      resetImpresionesForm();
      return;
    }

    // Nuevo
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
    addToCart(r, { kind:"ploteos" });
    resetPloteosForm();
    renderCart();
  });

  // Fotos
  $("foto_btn_add").addEventListener("click", () => {
    const err = $("foto_err"); clearError(err);
    const r = calcFotos();
    if (!r.ok) return showError(err, r.error);
    addToCart(r, { kind:"fotos" });
    resetFotosForm();
    renderCart();
  });

  // Adhesivo
  $("adh_btn_add").addEventListener("click", () => {
    const err = $("adh_err"); clearError(err);
    const r = calcAdhesivo();
    if (!r.ok) return showError(err, r.error);
    addToCart(r, { kind:"adhesivo" });
    resetAdhForm();
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
