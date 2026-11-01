/**
 * Una miniatura pequeña puede fusionar cientos de líneas finas rojas
 * de un CAD y parecer un pleno. Contrastar ocupación a dos escalas
 * SOLO si el texto del PDF revela un plano técnico. Un póster de color
 * sólido permanece estable al duplicar resolución.
 *
 * El resultado es ORIENTATIVO y se valida en servidor antes de D1.
 * No modifica PDF, no cambia tarifas y no envía datos del documento.
 */
export function evidenciaPlanoTecnico(texto){
 const t=String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const plano=/\b(planimetria|planta baja|planta alta|planta techo|plano de|plano municipal|fachada|corte [a-z]-[a-z]|corte detalle)\b/.test(t);
 const escala=/\bescala\b|\besc\.?\s*1\s*[:.]\s*\d+|\bproyecto\b|\bmedidas\b/.test(t);
 return plano&&escala;
}
export function esCadVectorialDenso({miniatura,detalle,texto}={}){
 if(!evidenciaPlanoTecnico(texto)||!miniatura||!detalle||
    miniatura.modo!=='poster')return false;
 const a=miniatura.cobertura,b=detalle.cobertura;
 if(!Number.isFinite(a)||!Number.isFinite(b)||a<0.3||b<=0||b>a||
    a-b<0.11||b/a>0.73)return false;
 // Al menos algo de la sobrecobertura en la miniatura proviene de
 // componentes cromáticos; para gris/negro no introducir una corrección
 // basada solamente en el rótulo técnico.
 if(!Number.isFinite(miniatura.coberturaColor)||miniatura.coberturaColor<0.12)
  return false;
 return true;
}
