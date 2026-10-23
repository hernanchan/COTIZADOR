import test from 'node:test';
import assert from 'node:assert/strict';
import {ajustarPlanoTecnicoPorPagina as ajustar} from '../integraciones/autocotizador/recepcion/regla-comercial-ploteos.mjs';
const base=(modo,cobertura,plenoContinuo)=>({modo,cobertura,plenoContinuo,coberturaColor:.04});
test('compilado: página 1 Póster y páginas 3,5,21 dudosas CAD',()=>{
 for(const [modo,coverage,pleno,expected] of [
  ['poster',.304,.107,'poster'],['revision',.293,.056,'cad'],
  ['revision',.179,.024,'cad'],['revision',.191,.025,'cad']])
  assert.equal(ajustar(base(modo,coverage,pleno),{rotuloTecnico:true}).modo,expected);
});
test('toda duda comercial válida va a CAD, incluso sin rótulo',()=>{
 for(const rotuloTecnico of [true,false]){
  for(const coverage of [0,.02,.20,.31,.42]){
   const x=ajustar(base('revision',coverage,.03),{rotuloTecnico});
   assert.equal(x.modo,'cad');
   assert.equal(x.regla,'duda_comercial_se_cotiza_cad');
  }
 }
});
test('PDF mixto conserva las páginas identificadas claramente como Póster',()=>{
 assert.equal(ajustar(base('poster',.36,.12),{rotuloTecnico:false}).modo,'poster');
 assert.equal(ajustar(base('poster',.26,.05),{rotuloTecnico:true}).modo,'poster');
 assert.equal(ajustar(base('cad',.13,.02),{rotuloTecnico:true}).modo,'cad');
});
test('pleno continuo en plano técnico se cobra Póster',()=>{
 assert.equal(ajustar(base('cad',.35,.11),{rotuloTecnico:true}).modo,'poster');
});
test('métricas ilegibles no se convierten artificialmente en CAD',()=>{
 assert.equal(ajustar(base('revision',Number.NaN,.05),{rotuloTecnico:true}).modo,'revision');
 assert.equal(ajustar(base('revision',.20,Number.NaN),{rotuloTecnico:true}).modo,'revision');
});
