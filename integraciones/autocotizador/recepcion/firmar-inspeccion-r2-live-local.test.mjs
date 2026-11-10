import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {firmarInformeR2LiveLocal} from './firmar-inspeccion-r2-live-local.mjs';
const info={schema:'saber-r2-informe-preprensa-local-v1',
 webOrderId:'WEB-ENSAYO-'+'A'.repeat(32),
 commercialOrderId:'123e4567-e89b-42d3-a456-426614174000',
 receiptId:'DOC-123e4567-e89b-42d3-a456-426614174001',
 sha256Verificado:true,sha256Original:'a'.repeat(64),bytesVerificados:60*1048576,
 originalPreserved:true,priceRecalculated:false,
 productionAuthorized:false,readyForPrinting:false,
 geometryMatchesQuote:true,measuredPages:1,declaredPages:1,
 measuredDimensions:[{numero:1,anchoCm:59.4,altoCm:84.1}],
 issues:[{tipo:'FICHA_COTIZADA_NO_DISPONIBLE'}]};
const options={fileId:'pdf_0',quoteHash:'b'.repeat(64),
 secret:'R2_INSPECTION_HMAC_SECRET_2026_123456789',
 issuedAt:1794320000};
test('firma sólo el resumen de un PDF real inspeccionado, no bytes originales',()=>{
 const signed=firmarInformeR2LiveLocal({informe:info,...options});
 assert.equal(signed.proof.sha256,info.sha256Original);
 assert.equal(signed.proof.measuredDimensions[0].anchoCm,59.4);
 assert.equal(signed.proof.quoteHash,options.quoteHash);
 const expected=createHmac('sha256',options.secret)
  .update(JSON.stringify(signed.proof)).digest('hex');
 assert.equal(signed.signature,expected);
 assert.equal(JSON.stringify(signed).includes('originalPdfBytes'),false);
});
test('retiene original si SHA, geometría, páginas, precio o preprensa no coincide',()=>{
 const changes=[
  {sha256Verificado:false},{geometryMatchesQuote:false},
  {measuredPages:2},{bytesVerificados:100},
  {readyForPrinting:true},{productionAuthorized:true},
  {issues:[{tipo:'MEDIDA_PAGINA'}]},
  {issues:[{tipo:'IMPORTE_PAGADO_NO_COINCIDE_CON_FICHA'}]}
 ];
 for(const change of changes)
  assert.throws(()=>firmarInformeR2LiveLocal({
   informe:{...info,...change},...options
  }),/NO_APTO/);
});
