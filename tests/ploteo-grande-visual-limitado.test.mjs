import test from 'node:test';
import assert from 'node:assert/strict';
import {clasificarPloteoGrandeVisualLimitado,MAX_VISUAL_GRANDE_BYTES}
 from '../integraciones/autocotizador/recepcion/clasificar-ploteo-grande-visual-limitado.mjs';
const MiB=1048576;
const medidas=[
 {numero:1,anchoCm:47.003,altoCm:31.001},
 {numero:2,anchoCm:45.923,altoCm:31.001},
 {numero:3,anchoCm:45.923,altoCm:31.001}
];
const file=(name='DCTO CABAÑAS POSE.pdf',size=45655680)=>({
 name,size,async arrayBuffer(){throw Error('NO DEBE LEER EL ORIGINAL EN EL TEST')}
});
test('3 páginas 43.54 MiB (medidas reales): permite clasificación por imagen, no por nombre',async()=>{
 let calls=0;
 const analizador=async(f,opt)=>{calls++;assert.equal(opt.maxPaginas,4);
  return medidas.map(p=>({numero:p.numero,modo:'poster',cobertura:.84}));
 };
 const x=await clasificarPloteoGrandeVisualLimitado(file(),{paginas:medidas,analizador});
 const y=await clasificarPloteoGrandeVisualLimitado(file('planos CAD.pdf'),{paginas:medidas,analizador});
 assert.equal(calls,2);
 assert.equal(x.altaConfianza,true);
 assert.deepEqual(x.paginas.map(p=>p.modo),['poster','poster','poster']);
 assert.deepEqual(y.paginas.map(p=>p.modo),['poster','poster','poster']);
 assert.equal(x.originalSubido,false);
 assert.equal(x.permiteImprimirSinRevisar,false);
});
test('sin análisis válido: no inventa Pleno ni fuerza CAD',async()=>{
 for(const analizador of [
  async()=>[{numero:1,modo:'poster'}],
  async()=>[{numero:1,modo:'poster'},{numero:2,modo:'poster'},{numero:3,modo:'revision'}],
  async()=>[{numero:1,modo:'poster'},{numero:2,modo:'poster'},{numero:2,modo:'poster'}],
  async()=>{throw Error('PDF incorrecto')}
 ]){
  assert.equal(await clasificarPloteoGrandeVisualLimitado(file(),{paginas:medidas,analizador}),null);
 }
});
test('PDF de más de 48 MiB o demasiadas páginas conserva la revisión sin leer 150 MiB',async()=>{
 assert.equal(MAX_VISUAL_GRANDE_BYTES,48*MiB);
 let calls=0;const analizador=async()=>{calls++;throw Error('no llamar')};
 for(const f of [file('grande.pdf',150*MiB),file('limite.pdf',48*MiB+1),file('pequeño.pdf',39*MiB)]){
  assert.equal(await clasificarPloteoGrandeVisualLimitado(f,{paginas:medidas,analizador}),null);
 }
 assert.equal(await clasificarPloteoGrandeVisualLimitado(file(),{paginas:[...medidas,...medidas],analizador}),null);
 assert.equal(calls,0);
});
test('CAD y Pleno detectados por página se conservan, sin precio ni material inferidos',async()=>{
 const r=await clasificarPloteoGrandeVisualLimitado(file('archivo.pdf'),{paginas:medidas,
  analizador:async()=>[{numero:1,modo:'poster'},{numero:2,modo:'cad'},{numero:3,modo:'poster'}]});
 assert.deepEqual(r.paginas.map(x=>x.modo),['poster','cad','poster']);
 assert.ok(!Object.hasOwn(r,'papelPoster'));
 assert.ok(!Object.hasOwn(r,'importeArs'));
});
