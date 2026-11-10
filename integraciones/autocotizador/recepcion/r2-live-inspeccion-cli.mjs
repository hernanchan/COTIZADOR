#!/usr/bin/env node
/** Estación de preprensa: genera evidencia R2 firmada desde un original real.
 * Uso offline (NO sube archivos ni llama a la web):
 * SABER_R2_INSPECTION_KEY=<secreto-local> node r2-live-inspeccion-cli.mjs \
 *   manifiesto-central.json original.pdf evidencia-r2.json "Operador Saber"
 *
 * El manifiesto se obtiene exclusivamente del pedido pagado en Central;
 * no inferir tamaño, modo CAD/póster ni precio del nombre del archivo.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {revisarPdfR2Local} from './preprensa-r2-archivo-local.mjs';
import {firmarInformeR2LiveLocal} from './firmar-inspeccion-r2-live-local.mjs';
const [manifestPath,filePath,outPath,operator]=process.argv.slice(2);
if(!manifestPath||!filePath||!outPath||typeof operator!=='string'||
 operator.trim().length<2||operator.trim().length>60)
 throw Error('R2_CLI_ARGUMENTOS: manifiesto.json original.pdf evidencia.json operador');
const key=process.env.SABER_R2_INSPECTION_KEY;
if(typeof key!=='string'||key.length<32)
 throw Error('R2_CLI_CLAVE_LOCAL_NO_CONFIGURADA');
const raw=await readFile(manifestPath,'utf8');
if(raw.length>64000)throw Error('R2_CLI_MANIFIESTO_LARGO');
const manifest=JSON.parse(raw);
if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
 manifest.schema!=='saber-r2-live-inspection-manifest-v1'||
 manifest.productionAuthorized!==false||
 !['quoteSnapshot'].every(k=>Object.hasOwn(manifest,k)))
 throw Error('R2_CLI_MANIFIESTO_INCOMPATIBLE');
const report=await revisarPdfR2Local({
 filePath,webOrderId:manifest.webOrderId,
 commercialOrderId:manifest.commercialOrderId,
 receiptId:manifest.receiptId,
 expectedSha256:manifest.expectedSha256,
 expectedBytes:manifest.expectedBytes,
 paginasDeclaradas:manifest.paginasDeclaradas,
 amountArs:manifest.amountArs,
 quoteSnapshot:manifest.quoteSnapshot
});
const signed=firmarInformeR2LiveLocal({
 informe:report,fileId:manifest.fileId,
 quoteHash:manifest.quoteHash,secret:key
});
const payload={operator:operator.trim(),confirmed:true,...signed};
await writeFile(outPath,JSON.stringify(payload,null,2)+'\n',{
 flag:'wx',mode:0o600});
console.log('R2_INSPECCION_FIRMADA_SHA_MEDIDAS_OK');
console.log('La evidencia requiere revisión del operador y envío autenticado a Central.');
console.log('El original permanece intacto. No se autorizó impresión ni pago.');
