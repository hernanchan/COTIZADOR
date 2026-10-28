import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {leerPdfFase4Privado} from '../integraciones/autocotizador/recepcion/leer-pdf-fase4-privado.mjs';

const CHUNK=256*1024;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const id='DOC-'+randomUUID();
const session={uploadId:id,token:'token-testing-only-abcdefghijklmnopqrstuvwxyz'};
const pdfBytes=Uint8Array.from({length:CHUNK*5+37},(_,i)=>(i*19+(i>>10)*13)%256);
pdfBytes.set(Buffer.from('%PDF-'),0);
const fingerprint=sha(pdfBytes);

function options(consultarFirmado){
 return {session,receiptId:id,bytes:pdfBytes.length,sha256:fingerprint,
  consultarFirmado,maxFileBytes:20*1024*1024,subtle:webcrypto.subtle};
}

test('lectura privada: 3 maximo en vuelo y armado intacto pese a respuestas fuera de orden',async()=>{
 let active=0,peak=0,calls=0;
 const read=async ({op,uploadId,token,receiptId,offset})=>{
  assert.equal(op,'multiReadPart');
  assert.equal(uploadId,id);assert.equal(token,session.token);
  assert.equal(receiptId,id);
  assert.equal(offset%CHUNK,0);
  active++;peak=Math.max(peak,active);calls++;
  await new Promise(resolve=>setTimeout(resolve,11-(offset/CHUNK)%7));
  active--;
  const part=pdfBytes.subarray(offset,Math.min(offset+CHUNK,pdfBytes.length));
  return {ok:true,receiptId:id,offset,length:part.length,bytes:pdfBytes.length,
   sha256:fingerprint,chunkSha256:sha(part),dataBase64:Buffer.from(part).toString('base64')};
 };
 const restored=await leerPdfFase4Privado(options(read));
 assert.deepEqual(restored,pdfBytes);
 assert.equal(calls,Math.ceil(pdfBytes.length/CHUNK));
 assert.ok(peak>1,'lecturas efectivamente concurrentes');
 assert.ok(peak<=3,'prohibido superar el maximo fijo de concurrencia');
});

test('lectura privada: rechaza un fragmento con hash alterado',async()=>{
 const read=async ({offset})=>{
  const part=pdfBytes.subarray(offset,Math.min(offset+CHUNK,pdfBytes.length));
  return {ok:true,receiptId:id,offset,length:part.length,bytes:pdfBytes.length,
   sha256:fingerprint,chunkSha256:'0'.repeat(64),
   dataBase64:Buffer.from(part).toString('base64')};
 };
 await assert.rejects(leerPdfFase4Privado(options(read)),/hash incorrecto/);
});

test('lectura privada: no acepta offsets incorrectos ni un estado de otro recibo',async()=>{
 const read=async ({offset})=>{
  const part=pdfBytes.subarray(offset,Math.min(offset+CHUNK,pdfBytes.length));
  return {ok:true,receiptId:'DOC-'+randomUUID(),offset:offset+CHUNK,length:part.length,
   bytes:pdfBytes.length,sha256:fingerprint,chunkSha256:sha(part),
   dataBase64:Buffer.from(part).toString('base64')};
 };
 await assert.rejects(leerPdfFase4Privado(options(read)),/fragmento esperado/);
});

test('lectura privada: comprueba SHA final aunque cada bloque tenga SHA correcto',async()=>{
 const read=async ({offset})=>{
  const part=Uint8Array.from(pdfBytes.subarray(offset,Math.min(offset+CHUNK,pdfBytes.length)));
  part[0]^=1;
  return {ok:true,receiptId:id,offset,length:part.length,bytes:pdfBytes.length,
   sha256:fingerprint,chunkSha256:sha(part),
   dataBase64:Buffer.from(part).toString('base64')};
 };
 await assert.rejects(leerPdfFase4Privado(options(read)),/PDF reconstruido difiere/);
});

test('Worker replica el limite de 3 lecturas y conserva SHA por fragmento',()=>{
 const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs',import.meta.url),'utf8');
 assert.match(source,/Math\.min\(3,offsets\.length\).*lectorPrivado/);
 assert.match(source,/safeHash\(chunk\)!==part\.chunkSha256/);
 assert.match(source,/op:'multiReadPart'/);
 assert.match(source,/lap\('lecturaPrivadaMs'\)/);
});

test('Central sigue validando metadata y estado firmados independientemente',()=>{
 const source=readFileSync(new URL('../integraciones/autocotizador/recepcion/fase4-ficha-central-lote-privada.mjs',import.meta.url),'utf8');
 assert.match(source,/const \[info,status\]=await Promise\.all/);
 assert.match(source,/info\.sha256!==status\.sha256/);
 assert.match(source,/info\.pages!==status\.pages/);
 assert.match(source,/status\.storageVerified!==true/);
});
