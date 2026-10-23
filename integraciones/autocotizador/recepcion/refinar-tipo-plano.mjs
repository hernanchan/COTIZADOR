/** Ajuste documental conservador: no cambiar modo solo por baja cobertura.
 * Exige mayoría visual CAD y rótulos técnicos explícitos por página.
 * Uso preliminar; los originales siempre se validan antes de cobrar.
 */
export function refinarTipoPlano(paginas){
 if(!Array.isArray(paginas)||!paginas.length)return paginas;
 const cad=paginas.filter(p=>p.modo==='cad').length;
 const ratio=cad/paginas.length;
 const evidencia=paginas.filter(p=>p.rotuloTecnico===true).length/paginas.length;
 // Dos páginas mixtas o un póster aislado NO obtienen corrección por consenso.
 if(paginas.length<4||ratio<0.70||evidencia<0.70)return paginas;
 return paginas.map(p=>{
  if(!p.rotuloTecnico||!['poster','revision'].includes(p.modo))return p;
  // Imágenes con cobertura superior al 45% se mantienen con su modo visual:
  // un póster mayoritariamente pleno no debe convertirse en CAD.
  if(!(Number.isFinite(p.cobertura)&&p.cobertura<0.45))return p;
  return {...p,modo:'cad',modoVisual:p.modo,refinadoPor:'rotulo_tecnico_y_consenso'};
 });
}
export function contieneRotuloTecnico(texto){
 const t=String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const dwg=/\.dwg\b/.test(t);
 const plano=/\b(planimetria|plano|planta baja|electricidad|canalizacion|fuerza motriz|senal debil)\b/.test(t);
 const referencia=/\b(escala|escalas|proyecto|archivo|item)\b/.test(t);
 return dwg&&plano&&referencia;
}
