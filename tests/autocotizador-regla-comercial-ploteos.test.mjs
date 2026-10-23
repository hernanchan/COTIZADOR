import test from 'node:test';
import assert from 'node:assert/strict';
import {ajustarPlanoTecnicoPorPagina as ajustar} from '../integraciones/autocotizador/recepcion/regla-comercial-ploteos.mjs';
const base=(modo,cobertura,plenoContinuo)=>({modo,cobertura,plenoContinuo,coberturaColor:.04});
test('compilado real: pagina 1 poster; 3, 5 y 21 CAD',()=>{
 const caso=[['poster',.304,.107,'poster'],['revision',.293,.056,'cad'],
 ['revision',.179,.024,'cad'],['revision',.191,.025,'cad']];
 for(const [modo,cobertura,plenoContinuo,esperado] of caso)
  assert.equal(ajustar(base(modo,cobertura,plenoContinuo),{rotuloTecnico:true}).modo,esperado);
});
test('no reclasifica posters por rótulo ni por mayoría',()=>{
 assert.equal(ajustar(base('poster',.26,.05),{rotuloTecnico:true}).modo,'poster');
 assert.equal(ajustar(base('revision',.25,.05),{rotuloTecnico:false}).modo,'revision');
 assert.equal(ajustar(base('revision',.32,.05),{rotuloTecnico:true}).modo,'revision');
});
test('fotografia realmente plena prevalece aun con rótulo',()=>{
 assert.equal(ajustar(base('cad',.35,.11),{rotuloTecnico:true}).modo,'poster');
});
