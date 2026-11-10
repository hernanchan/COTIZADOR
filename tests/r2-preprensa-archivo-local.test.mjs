import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,open,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {revisarPdfR2Local,compararGeometriaR2,cotejarFichaCotizadaR2}
 from '../integraciones/autocotizador/recepcion/preprensa-r2-archivo-local.mjs';
const web='WEB-ENSAYO-255BFE122477AC6C7666EB6D342707FE';
const commercial='66f10bd2-77ce-46ef-930c-49dc3d22d23e';
const receipt='DOC-12345678-1234-4123-8123-123456789abc';
const a1=[{numero:1,anchoCm:59.4,altoCm:84.1,modo:'cad'}];
const gib=1024*1024;
async function make(){
 const dir=await mkdtemp(join(tmpdir(),'saber-r2-preflight-'));
 const filePath=join(dir,'original.pdf');
 const count=41*gib;
 const fd=await open(filePath,'w');
 const sha=createHash('sha256');
 let pos=0;const offs=[0];
 const put=async x=>{
  const b=Buffer.isBuffer(x)?x:Buffer.from(x);
  await fd.write(b,0,b.length,pos);pos+=b.length;sha.update(b)
 };
 await put('%PDF-1.4\n');
 const defs=[[1,'<< /Type /Catalog /Pages 2 0 R >>'],
  [2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
  [3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1683.78 2383.94] /Contents 4 0 R /Resources << >> >>']];
 for(const [id,value] of defs){
  offs[id]=pos;await put(id+' 0 obj\n'+value+'\nendobj\n');
 }
 offs[4]=pos;await put('4 0 obj\n<< /Length '+count+' >>\nstream\n');
 const blank=Buffer.alloc(gib,32);
 for(let i=0;i<41;i++)await put(blank);
 await put('\nendstream\nendobj\n');
 const xref=pos;
 await put('xref\n0 5\n0000000000 65535 f \n');
 for(let i=1;i<=4;i++)await put(String(offs[i]).padStart(10,'0')+' 00000 n \n');
 await put('trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
 await fd.close();
 return {dir,filePath,expectedSha256:sha.digest('hex'),expectedBytes:pos};
}
function params(f,paginasDeclaradas=a1){
 return {filePath:f.filePath,webOrderId:web,commercialOrderId:commercial,
  receiptId:receipt,expectedSha256:f.expectedSha256,
  expectedBytes:f.expectedBytes,paginasDeclaradas,amountArs:4400};
}
test('geometría estricta; página o escala distintas exige revisión',()=>{
 const real=[{anchoCm:59.4,altoCm:84.1}];
 assert.equal(compararGeometriaR2(a1,real).coinciden,true);
 assert.equal(compararGeometriaR2(a1,[{anchoCm:50,altoCm:84.1}]).coinciden,false);
 assert.equal(compararGeometriaR2(a1,[{anchoCm:59.4,altoCm:84.1},{anchoCm:59.4,altoCm:84.1}]).issues?.length,undefined);
 assert.equal(compararGeometriaR2(a1,[...real,...real]).inconsistencias[0].tipo,'CANTIDAD_PAGINAS');
 // Un PDF A4 de 100 MB usa R2 por peso, pero sigue siendo documento.
 assert.equal(compararGeometriaR2([{...a1[0],modo:'sin-clasificar'}],real).coinciden,true);
 assert.equal(compararGeometriaR2([{numero:1,anchoCm:21,altoCm:29.7,
  modo:'sin-clasificar'}],[{anchoCm:21,altoCm:29.7}]).coinciden,true);
});
test('PDF A1 grande local: SHA, páginas y medidas reales; NO imprime ni reconfirma precio',async()=>{
 const f=await make();
 try{
  const z=await revisarPdfR2Local(params(f));
  assert.equal(z.sha256Verificado,true);
  assert.equal(z.bytesVerificados,f.expectedBytes);
  assert.equal(z.measuredPages,1);
  assert.equal(z.measuredDimensions[0].anchoCm,59.4);
  assert.equal(z.measuredDimensions[0].altoCm,84.1);
  assert.equal(z.geometryMatchesQuote,true);
  assert.equal(z.priceRecalculated,false);
  assert.equal(z.cadPosterClassificationVerified,false);
  assert.equal(z.productionAuthorized,false);
  assert.equal(z.readyForPrinting,false);
  assert.equal(z.status,'CONTENIDO_Y_PRECIO_PENDIENTES_REVISION');
  const mismatch=await revisarPdfR2Local(params(f,[{...a1[0],anchoCm:42}]));
  assert.equal(mismatch.geometryMatchesQuote,false);
  assert.equal(mismatch.status,'MEDIDAS_DISTINTAS_REQUIERE_RECOTIZACION');
  assert.ok(mismatch.issues.some(x=>x.tipo==='MEDIDA_PAGINA'));
  await assert.rejects(revisarPdfR2Local({...params(f),expectedSha256:'a'.repeat(64)}),
   /R2_PREPRENSA_SHA256_DIFERENTE/);
  await assert.rejects(revisarPdfR2Local({...params(f),expectedBytes:f.expectedBytes+1}),
   /R2_PREPRENSA_LONGITUD_INCORRECTA/);
 }finally{await rm(f.dir,{recursive:true,force:true})}
});
test('PDF no legible o cifrado no pasa a producción',async()=>{
 const f=await make();
 try{
  await assert.rejects(revisarPdfR2Local({...params(f),preparacion:async()=>{throw Error('password')}}),
   /R2_PREPRENSA_PDF_NO_ANALIZABLE/);
 }finally{await rm(f.dir,{recursive:true,force:true})}
});

test('La ficha pagada conserva papel/copias/rollo; geometría real puede coincidir pero impresión sigue prohibida',()=>{
 const quoteSnapshot={schema:'saber-r2-cotizacion-firmada-v1',
  nombre:'A1 cotizado.pdf',seleccion:'original',
  modoImpresion:'bn',copias:2,papelPoster:'obra80',
  rolloBase:'rollo60',importeArs:4400,
  paginas:[[59.4,84.1,'cad','rollo60','obra80']]};
 const actual=[{anchoCm:59.4,altoCm:84.1,modo:'sin-clasificar'}];
 const ok=cotejarFichaCotizadaR2(quoteSnapshot,actual,4400);
 assert.equal(ok.geometryMatchesQuote,true);
 assert.equal(ok.quoteSnapshotAvailable,true);
 assert.equal(ok.declaredCopies,2);
 assert.equal(ok.declaredPaper,'obra80');
 assert.equal(ok.declaredRoll,'rollo60');
 assert.equal(ok.priceRecalculated,false);
 assert.equal(ok.classificationVerified,false);
 assert.equal(ok.materialsVerified,false);
 assert.equal(ok.productionAuthorized,false);
 assert.equal(ok.state,'GEOMETRIA_COINCIDE_RESTA_VALIDAR_CONTENIDO_Y_PRECIO');
 const wrong=cotejarFichaCotizadaR2(quoteSnapshot,[{anchoCm:42,altoCm:84.1}],4400);
 assert.equal(wrong.geometryMatchesQuote,false);
 assert.ok(wrong.issues.some(x=>x.tipo==='MEDIDA_PAGINA'));
 const price=cotejarFichaCotizadaR2(quoteSnapshot,actual,5500);
 assert.ok(price.issues.some(x=>x.tipo==='IMPORTE_PAGADO_NO_COINCIDE_CON_FICHA'));
 assert.equal(price.productionAuthorized,false);
 const old=cotejarFichaCotizadaR2(null,actual,4400);
 assert.equal(old.quoteSnapshotAvailable,false);
 assert.equal(old.state,'REQUIERE_REVISION_COMERCIAL');
 assert.throws(()=>cotejarFichaCotizadaR2({...quoteSnapshot,copias:0},actual,4400),
  /R2_PREPRENSA_FICHA_COTIZADA_INVALIDA/);
});
