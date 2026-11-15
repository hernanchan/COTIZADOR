const PERIODOS = Object.freeze([
  ['hoy', 'Hoy'],
  ['7d', 'Últimos 7 días'],
  ['30d', 'Últimos 30 días']
]);

const METRICAS = Object.freeze([
  ['visitas', 'Visitas al cotizador'],
  ['sesiones', 'Sesiones con visita'],
  ['iniciadas', 'Cotizaciones iniciadas'],
  ['cotizadas', 'Cotizaciones calculadas'],
  ['checkout', 'Inicios de pago'],
  ['pedidosPagados', 'Pedidos pagados']
]);

function entero(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? new Intl.NumberFormat('es-AR').format(n) : '—';
}

function elemento(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// La pantalla solo consume agregados del endpoint privado; nunca recibe pedidos
// individuales ni datos de contacto. Si no hay vínculo verificable, no inventa tasas.
export function montarPanelEstadisticas(root, {
  fetcher = globalThis.fetch?.bind(globalThis),
  endpoint = '/personal/api/live-analytics'
} = {}) {
  if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('Falta contenedor del panel');
  if (typeof fetcher !== 'function') throw new TypeError('Falta transporte HTTP');
  const doc = root.ownerDocument;
  if (!doc) throw new TypeError('El panel necesita un documento');

  const style = elemento(doc, 'style');
  style.textContent = `
    .saber-analytics{font-family:Arial,sans-serif;color:#1d252d;max-width:1100px;margin:auto;padding:16px}
    .saber-analytics h1{font-size:1.5rem;margin:0 0 8px;color:#0a3158}
    .saber-analytics p{line-height:1.45}
    .saber-analytics__toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:16px 0}
    .saber-analytics__toolbar button{border:1px solid #b7c1cc;background:#fff;border-radius:8px;padding:10px 14px;font:inherit;cursor:pointer}
    .saber-analytics__toolbar button[aria-pressed="true"]{background:#0a3158;color:#fff;border-color:#0a3158}
    .saber-analytics__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .saber-analytics__card{border:1px solid #dfe3e8;border-radius:12px;padding:16px;background:#fff;min-width:0}
    .saber-analytics__label{font-size:.95rem;color:#59636e;margin:0 0 8px}
    .saber-analytics__value{font-size:1.8rem;font-weight:700;color:#0a3158;margin:0;overflow-wrap:anywhere}
    .saber-analytics__note{margin-top:18px;padding:12px;border-radius:8px;background:#f6f7f8}
    .saber-analytics__status{min-height:1.5em}
    @media(max-width:700px){.saber-analytics{padding:12px}.saber-analytics__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.saber-analytics__value{font-size:1.5rem}}
    @media(max-width:420px){.saber-analytics__grid{grid-template-columns:1fr}.saber-analytics__toolbar button{flex:1}}
  `;
  const panel = elemento(doc, 'section', undefined, 'saber-analytics');
  panel.setAttribute('aria-labelledby', 'saber-analytics-title');
  const title = elemento(doc, 'h1', 'Estadísticas comerciales');
  title.id = 'saber-analytics-title';
  panel.append(title, elemento(doc, 'p', 'Las visitas y sesiones son métricas distintas. Los pedidos pagados se cuentan desde pagos confirmados por la Central.'));

  const toolbar = elemento(doc, 'div', undefined, 'saber-analytics__toolbar');
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Período de estadísticas');
  const status = elemento(doc, 'p', 'Seleccioná un período.', 'saber-analytics__status');
  status.setAttribute('role', 'status');
  const grid = elemento(doc, 'div', undefined, 'saber-analytics__grid');
  const values = new Map();
  for (const [key, label] of METRICAS) {
    const card = elemento(doc, 'article', undefined, 'saber-analytics__card');
    const heading = elemento(doc, 'h2', label, 'saber-analytics__label');
    const value = elemento(doc, 'p', '—', 'saber-analytics__value');
    card.append(heading, value);
    grid.append(card);
    values.set(key, value);
  }
  const note = elemento(doc, 'div', undefined, 'saber-analytics__note');
  const conversion = elemento(doc, 'p', 'Conversión visitante a comprador: no calculable sin vínculo verificable entre sesión y pedido.');
  const abandonment = elemento(doc, 'p', 'Abandono por etapa: no disponible hasta medir cada transición con una ventana de sesión definida.');
  note.append(conversion, abandonment);
  panel.append(toolbar, status, grid, note);

  let current = 'hoy';
  let busy = false;
  async function cargar(periodo) {
    if (busy) return;
    busy = true;
    current = periodo;
    for (const button of toolbar.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.periodo === periodo));
    status.textContent = 'Cargando estadísticas…';
    try {
      const url = new URL(endpoint, doc.baseURI);
      url.searchParams.set('periodo', periodo);
      const response = await fetcher(url.pathname + url.search, { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true || data.periodo !== periodo) throw new Error('No se pudieron consultar las estadísticas.');
      for (const [key] of METRICAS) values.get(key).textContent = entero(data[key]);
      status.textContent = `Período: ${PERIODOS.find(([id]) => id === periodo)?.[1] || periodo}.`;
    } catch {
      for (const value of values.values()) value.textContent = '—';
      status.textContent = 'No se pudieron consultar las estadísticas. Probá de nuevo.';
    } finally {
      busy = false;
    }
  }
  for (const [periodo, label] of PERIODOS) {
    const button = elemento(doc, 'button', label);
    button.type = 'button';
    button.dataset.periodo = periodo;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => void cargar(periodo));
    toolbar.append(button);
  }
  const retry = elemento(doc, 'button', 'Actualizar');
  retry.type = 'button';
  retry.addEventListener('click', () => void cargar(current));
  toolbar.append(retry);
  root.replaceChildren(style, panel);
  void cargar(current);
  return { cargar, destroy() { root.replaceChildren(); } };
}
