/** Política comercial por página:
 * Póster sólo si la evaluación visual aporta evidencia positiva de pleno.
 * Cuando el análisis fue válido pero ambiguo, cotizar CAD.
 * Los errores de lectura/renderización del PDF siguen bloqueando cotización.
 */
export function ajustarPlanoTecnicoPorPagina(c,{rotuloTecnico=false}={}){
 if(!c||!['cad','poster','revision'].includes(c.modo))throw Error('Clasificación visual inválida');
 const p=c.plenoContinuo;
 const datosValidos=Number.isFinite(c.cobertura)&&c.cobertura>=0&&c.cobertura<=1&&
  (p===null||(Number.isFinite(p)&&p>=0&&p<=1));
 if(!datosValidos)return {...c,regla:'metricas_invalidas'};
 // La superficie continua suficientemente intensa en un plano rotulado
 // evidencia impresión plena aun cuando la cobertura visual global sea baja.
 if(rotuloTecnico&&Number.isFinite(p)&&p>=0.085)
  return {...c,modo:'poster',regla:'pleno_continuo_tecnico',modoVisual:c.modo};
 if(c.modo==='revision')
  return {...c,modo:'cad',regla:'duda_comercial_se_cotiza_cad',modoVisual:'revision'};
 return {...c,regla:'visual'};
}
