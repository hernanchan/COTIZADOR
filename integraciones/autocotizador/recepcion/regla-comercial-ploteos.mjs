/** Regla experimental por página, no por mayoría de un PDF.
 * Una fotografía puntual no convierte un plano en póster.
 * Umbrales calibrados inicialmente con el compilado real de 24 planos.
 */
export function ajustarPlanoTecnicoPorPagina(c,{rotuloTecnico=false}={}){
 if(!c||!['cad','poster','revision'].includes(c.modo))throw Error('Clasificación visual inválida');
 const p=c.plenoContinuo;
 if(!rotuloTecnico||!Number.isFinite(p)||!Number.isFinite(c.cobertura))return {...c,regla:'visual'};
 // Una superficie realmente plena no se reclasifica por contener referencias DWG.
 if(p>=0.085)return {...c,modo:'poster',regla:'pleno_continuo_tecnico',modoVisual:c.modo};
 // Solo resolver dudas en páginas identificadas como planos. No abaratar
 // un póster ya detectado; tampoco usar votos de otras páginas.
 if(c.modo==='revision'&&p<=0.065&&c.cobertura<=0.30){
  return {...c,modo:'cad',regla:'lineas_en_plano_tecnico',modoVisual:'revision'};
 }
 return {...c,regla:'visual'};
}
