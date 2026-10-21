import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {leerPaginasLocales} from './lectura-local-pdf.mjs';

async function archivo(nombre,paginas){
 const pdf=await PDFDocument.create();
 for(let i=0;i<paginas;i++)pdf.addPage([210,297]);
 const bytes=await pdf.save();
 return {name:nombre,size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer};
}
test('10 PDF locales se cuentan sin llamadas de red y en orden',async()=>{
 const archivos=await Promise.all(Array.from({length:10},(_,i)=>archivo('a'+i+'.pdf',i+1)));
 let completados=0;
 const result=await leerPaginasLocales(archivos,{concurrencia:2,onProgreso:()=>completados++});
 assert.equal(result.documentos.length,10);
 assert.equal(result.paginasTotales,55);
 assert.equal(result.completos,true);
 assert.equal(result.aptoParaCobro,false);
 assert.equal(result.estado,'SOLO_PRELIMINAR');
 assert.equal(completados,10);
 assert.deepEqual(result.documentos.map(x=>x.paginas),[1,2,3,4,5,6,7,8,9,10]);
});
test('PDF inválido no obtiene páginas inventadas y no bloquea otros',async()=>{
 const valido=await archivo('ok.pdf',2);
 const roto={name:'roto.pdf',size:8,arrayBuffer:async()=>new TextEncoder().encode('not pdf!').buffer};
 const result=await leerPaginasLocales([roto,valido]);
 assert.equal(result.completos,false);
 assert.equal(result.paginasTotales,2);
 assert.equal(result.documentos[0].paginas,null);
 assert.equal(result.documentos[0].estado,'error');
 assert.equal(result.documentos[1].paginas,2);
});
test('no permite lote vacío ni concurrencia descontrolada',async()=>{
 await assert.rejects(leerPaginasLocales([]),/Seleccioná/);
 await assert.rejects(leerPaginasLocales([await archivo('a.pdf',1)],{concurrencia:100}),/Concurrencia/);
});
