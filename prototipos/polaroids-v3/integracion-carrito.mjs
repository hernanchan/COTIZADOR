/**
 * Contrato de integración V3 para la rama de pruebas.
 * Este módulo NO carga fotos ni afirma que llegaron al servidor: solo acepta
 * el evento SABER_POLAROID_READY emitido por el editor tras /complete exitoso.
 * Antes de producción hay que validar la referencia contra la API autorizada.
 */
const REF_PATTERN = /^PS-[0-9]{6}-[0-9A-F]{7}$/;
const FORMAT = '85x90_6up_A4_v1.1';

export function validarEventoPolaroid(evento, ventanaEditor, origenEsperado) {
  if (!evento || evento.origin !== origenEsperado || evento.source !== ventanaEditor) return null;
  const d = evento.data;
  if (!d || d.type !== 'SABER_POLAROID_READY') return null;
  if (d.format !== FORMAT || typeof d.reference !== 'string' || !REF_PATTERN.test(d.reference)) return null;
  if (!Number.isInteger(d.sheets) || d.sheets < 1 || d.sheets > 10 || d.photos !== d.sheets * 6) return null;
  return { referencia:d.reference, hojas:d.sheets, fotos:d.photos };
}

export function cotizarPedidoPolaroid(recibido, precioPorHoja) {
  if (!recibido || !REF_PATTERN.test(recibido.referencia)) throw new Error('Referencia inválida');
  if (!Number.isInteger(recibido.hojas) || recibido.hojas < 1 || recibido.hojas > 10 ||
      recibido.fotos !== recibido.hojas*6) throw new Error('Cantidad de hojas inválida');
  // El precio siempre debe venir del cotizador, nunca de event.data.
  if (!Number.isFinite(precioPorHoja) || precioPorHoja <= 0) throw new Error('Precio no configurado');
  const total=Math.round(recibido.hojas*precioPorHoja);
  return {
    id:'POL-'+recibido.referencia, type:'print',
    name:'Polaroids · '+recibido.hojas+' hoja'+(recibido.hojas===1?'':'s')+' de 6',
    price:total, qty:1,
    detail:'Referencia de fotos recibidas: '+recibido.referencia+
      ' · '+recibido.hojas+' hoja(s) A4 · '+recibido.fotos+' Polaroids · 85 × 90 mm',
    deposit:Math.round(total*0.5)
  };
}
