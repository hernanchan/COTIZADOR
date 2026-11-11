import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import prices from '../precios-web.json' with {type:'json'};
import {fichaPrearchivoUniversal} from '../integraciones/autocotizador/recepcion/ficha-prearchivo-universal.mjs';
import {cotizarCargaUnica} from '../integraciones/autocotizador/recepcion/cotizar-carga-unica.mjs';
import {verificarFichaUniversal} from '../integraciones/mercadopago/pruebas/r2-lote-universal-central.mjs';
const MiB=1048576;
const webOrderId='WEB-ENSAYO-00112233445566778899AABBCCDDEEFF';
const day=n=>Date.parse('2026-11-'+String(8+n).padStart(2,'0')+'T15:00:00Z');
const promotions={enabled:true,weekly:[
 {day:0,title:'Fin de semana',summary:'20%',kind:'percent',percent:20,enabled:true},
 {day:1,title:'Lunes de planos',summary:'10% CAD',kind:'percent',percent:10,minMeters:2,enabled:true},
 {day:2,title:'Martes de copias',summary:'10%',kind:'percent',percent:10,enabled:true},
 {day:3,title:'Miércoles de fotos',summary:'Luster normal',kind:'premium_to_normal',enabled:true},
 {day:4,title:'Jueves de anillado',summary:'Sin cargo',kind:'free_binding',enabled:true},
 {day:5,title:'Viernes de stickers',summary:'A3',kind:'percent',percent:10,enabled:true},
 {day:6,title:'Fin de semana',summary:'20%',kind:'percent',percent:20,enabled:true}
]};
const tariff={source:'private-d1-approved-only',revision:8,
 prices:{...prices,priceVersion:'d1-approved-revision-8'},promotions};
const base=(name,mode='bn')=>({nombre:name,
 paginas:[{numero:1,anchoCm:21,altoCm:29.7,modo:'sin-clasificar'}],
 seleccion:'a4',servicio:'auto',copias:1,modo:mode,caras:'simple',
 papelPoster:'obra80',materialColor:'',anillado:'ninguno',grupoAnillado:''});
const file=(cfg,i,bytes)=>({fileId:'f_'+i,nombre:cfg.nombre,
 bytes,sha256:String(i+1).repeat(64)});
const quote=(archivos,ahora)=>cotizarCargaUnica({archivos,precios:tariff.prices,
 promociones:promotions,ahora});
const ficha=(archivos,ahora,bytes=[])=>fichaPrearchivoUniversal({webOrderId,archivos,
 manifiestos:archivos.map((f,i)=>file(f,i,bytes[i]??(i===0?60*MiB:2*MiB))),
 tarifario:tariff,ahora});
async function signature(data){
 const quoteHash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
 return {...data,quoteHash};
}
test('miércoles: Luster 2 fotos $1600 => $1000 dentro de ficha CENTRAL firmable',async()=>{
 const cfg={...base('Fotos.pdf'),servicio:'fotos',productoFoto:'luster_10x15',
  paginas:[{numero:1,anchoCm:10,altoCm:15,modo:'sin-clasificar'},
   {numero:2,anchoCm:10,altoCm:15,modo:'sin-clasificar'}]};
 const q=quote([cfg],day(3)),f=ficha([cfg],day(3));
 assert.equal(q.total,1000);
 assert.equal(q.promocion.descuento,600);
 assert.equal(f.totalArs,1000);
 assert.equal(f.archivos[0].destino,'fotos');
 assert.equal(f.archivos[0].importeArs,1000);
 assert.equal(f.archivos[0].detalle.subtotalOriginal,1600);
 assert.equal(f.archivos[0].detalle.descuentoPromocion,600);
 assert.equal(f.archivos[0].detalle.subtotal,1000);
 assert.equal(f.pagoAutorizado,false);
 await verificarFichaUniversal(await signature(f),{subtle:webcrypto.subtle});
});
test('miércoles mixto: descuento sólo Luster, no baja precio B/N',async()=>{
 const fdoc=base('Apunte.pdf');
 const photo={...base('Luster.pdf'),servicio:'fotos',productoFoto:'luster_10x15',
  paginas:[{numero:1,anchoCm:10,altoCm:15,modo:'sin-clasificar'}]};
 const f=ficha([fdoc,photo],day(3));
 assert.equal(f.archivos[0].importeArs,100);
 assert.equal(f.archivos[1].importeArs,500);
 assert.equal(f.totalArs,600);
 await verificarFichaUniversal(await signature(f),{subtle:webcrypto.subtle});
});
test('martes copias: no rebaja anillado individual y monto central exacto',async()=>{
 const doc={...base('Anillado.pdf'),anillado:'individual'};
 const q=quote([doc],day(2)),f=ficha([doc],day(2));
 assert.equal(f.totalArs,q.total);
 assert.ok(f.archivos[0].detalle.descuentoPromocion>0);
 assert.equal(f.archivos[0].importeArs,q.total);
 await verificarFichaUniversal(await signature(f),{subtle:webcrypto.subtle});
});
test('jueves anillado conjunto: descuento cubre armado cero sin perder trabajo',async()=>{
 const a={...base('Capitulo 1.pdf'),anillado:'grupo',grupoAnillado:'1'};
 const b={...base('Capitulo 2.pdf'),anillado:'grupo',grupoAnillado:'1'};
 const q=quote([a,b],day(4)),f=ficha([a,b],day(4));
 assert.equal(f.totalArs,q.total);
 assert.equal(f.armados.length,1);
 assert.equal(f.armados[0].subtotal,0);
 assert.ok(f.armados[0].descuentoPromocion>0);
 await verificarFichaUniversal(await signature(f),{subtle:webcrypto.subtle});
});
test('sábado: descuento 20% distribuido a fotocopias, fotos y anillado',async()=>{
 const a={...base('A.pdf'),anillado:'grupo',grupoAnillado:'1'};
 const b={...base('B.pdf'),anillado:'grupo',grupoAnillado:'1'};
 const photo={...base('Fotos.pdf'),servicio:'fotos',productoFoto:'luster_10x15'};
 const q=quote([a,b,photo],day(6)),f=ficha([a,b,photo],day(6));
 assert.equal(f.totalArs,q.total);
 assert.equal(f.archivos.reduce((n,x)=>n+x.importeArs,0)+
  f.armados.reduce((n,x)=>n+x.subtotal,0),q.total);
 await verificarFichaUniversal(await signature(f),{subtle:webcrypto.subtle});
});
test('sin promoción aprobada conserva exactamente la ficha anterior',async()=>{
 const without={...tariff,promotions:{enabled:false,weekly:promotions.weekly}};
 const doc=base('Documento.pdf');
 const f=fichaPrearchivoUniversal({webOrderId,archivos:[doc],
  manifiestos:[file(doc,0,60*MiB)],tarifario:without,ahora:day(3)});
 assert.equal(f.totalArs,f.archivos[0].detalle.subtotal);
 assert.equal(f.archivos[0].detalle.descuentoPromocion,undefined);
 await verificarFichaUniversal(await signature(f),{subtle:webcrypto.subtle});
});
test('Central bloquea total y descuento adulterados aunque parezcan coherentes',async()=>{
 const cfg={...base('Fotos.pdf'),servicio:'fotos',productoFoto:'luster_10x15'};
 const f=ficha([cfg],day(3)),signed=await signature(f);
 await assert.rejects(verificarFichaUniversal({...signed,totalArs:1},
  {subtle:webcrypto.subtle}),/HASH|TOTAL/);
 await assert.rejects(verificarFichaUniversal({...signed,archivos:[{...f.archivos[0],
  importeArs:1}]},{subtle:webcrypto.subtle}),/HASH|TOTAL/);
});

test('fotos de 2 MiB usan sólo TUS en Sandbox con flag, hash y total Luster $500',async()=>{
 const foto={...base('Fotos pequeñas.pdf'),servicio:'fotos',productoFoto:'luster_10x15',
  paginas:[{numero:1,anchoCm:10,altoCm:15,modo:'sin-clasificar'}],
  modo:'color'};
 const args={webOrderId,archivos:[foto],manifiestos:[file(foto,0,2*MiB)],
  tarifario:tariff,ahora:day(3)};
 assert.throws(()=>fichaPrearchivoUniversal(args),/SIN_ARCHIVOS_GRANDES/);
 const q=fichaPrearchivoUniversal({...args,admitirFotosTusPruebas:true});
 assert.equal(q.totalArs,500);
 assert.equal(q.archivos[0].transporte,'tus');
 assert.equal(q.archivos[0].destino,'fotos');
 const signed=await signature(q);
 await verificarFichaUniversal(signed,{subtle:webcrypto.subtle,allowTusOnly:true});
 await assert.rejects(verificarFichaUniversal(signed,{subtle:webcrypto.subtle}),/RUTA_INVALIDA/);
 const doc=base('Apunte.pdf');
 assert.throws(()=>fichaPrearchivoUniversal({...args,archivos:[doc],
  manifiestos:[file(doc,0,2*MiB)],admitirFotosTusPruebas:true}),/SIN_ARCHIVOS_GRANDES/);
});
