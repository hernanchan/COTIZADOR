import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {leerPdfFase4Privado} from '../integraciones/autocotizador/recepcion/leer-pdf-fase4-privado.mjs';
const receiptId='DOC-12345678-1234-4234-8234-1234567890ab';
const session={uploadId:receiptId,token:'token-de-fase4-privada-largo'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=Uint8Array.from({length:345678},(_,i)=>i%253);
bytes.set(new TextEncoder().encode('%PDF-1.4'),0);
const sha256=hash(bytes);
const consultarFirmado=async ({offset})=>{
 const c=bytes.subarray(offset,Math.min(bytes.length,offset+256*1024));
 return {ok:true,receiptId,offset,length:c.length,bytes:bytes.length,sha256,
  chunkSha256:hash(c),dataBase64:Buffer.from(c).toString('base64')};
};
const request=(overrides={})=>leerPdfFase4Privado({
 session,receiptId,bytes:bytes.length,sha256,consultarFirmado,...overrides
});
test('recupera exactamente 2 fragmentos verificados del PDF de Drive',async()=>{
 const found=await request();assert.deepEqual(found,bytes);
});
test('rechaza sesión, recibo o hash no coincidente antes de leer',async()=>{
 await assert.rejects(request({session:{...session,uploadId:'DOC-87654321-1234-4234-8234-1234567890ab'}}));
 await assert.rejects(request({sha256:'a'.repeat(64)}));
 await assert.rejects(request({bytes:0}));
});
test('fragmento truncado, reordenado o corrupto nunca confirma recepción',async()=>{
 await assert.rejects(request({consultarFirmado:async p=>({...await consultarFirmado(p),offset:p.offset+1})}));
 await assert.rejects(request({consultarFirmado:async p=>({...await consultarFirmado(p),chunkSha256:'f'.repeat(64)})}));
 await assert.rejects(request({consultarFirmado:async p=>({...await consultarFirmado(p),dataBase64:'AA=='})}));
});
