/**
 * Verifica el contrato de recepción con un servidor simulado en memoria.
 * NO demuestra envío a Google Drive ni comprobación real de páginas PDF.
 * Node 20+: node tests/autocotizador-subida.test.mjs
 */
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import {uploadPdfResumable,PDF_PART_BYTES} from '../integraciones/autocotizador/pruebas/subida-reanudable.mjs';

async function hex(data){
  return Buffer.from(await webcrypto.subtle.digest('SHA-256',data)).toString('hex');
}
function fakePdf(size=PDF_PART_BYTES*2+314){
  const bytes=Buffer.alloc(size);
  bytes.write('%PDF-1.7\n'); // prueba de transporte; NO PDF válido para imprenta
  for(let i=9;i<bytes.length;i++)bytes[i]=i%239;
  return new File([bytes],'apuntes.pdf',{type:'application/pdf'});
}
function server({lostReplyPart=-1,failedPart=-1,finishOverride=null}={}){
  let sessions=new Map(),lastSession=null,partsAttempted=0,duplicateParts=0,lostOnce=false;
  const gateway={
    async start(meta){
      const key=meta.orderId+'-'+meta.sha256+'-'+meta.mode;
      let s=sessions.get(key);
      if(!s){s={meta,uploadId:'upl_12345678901234567890',token:'private_test_token_12345678',
        accepted:new Map(),parts:meta.parts};
        sessions.set(key,s)}
      lastSession=s;
      return {uploadId:s.uploadId,token:s.token};
    },
    async status(c){assert.equal(c.token,lastSession.token);return {acceptedParts:[...lastSession.accepted.keys()]}},
    async part(data){
      assert.equal(data.token,lastSession.token);
      partsAttempted++;
      const buf=Buffer.from(data.dataBase64,'base64');
      assert.equal(buf.byteLength,data.bytes);
      assert.equal(await hex(buf),data.sha256);
      if(data.index===failedPart)throw Error('Conexión suspendida');
      if(lastSession.accepted.has(data.index))duplicateParts++;
      lastSession.accepted.set(data.index,buf);
      if(data.index===lostReplyPart&&!lostOnce){lostOnce=true;throw Error('Respuesta perdida tras guardar');}
      return {accepted:true};
    },
    async finish(data){
      assert.equal(lastSession.accepted.size,lastSession.parts);
      const chunks=Array.from({length:lastSession.parts},(_,i)=>lastSession.accepted.get(i));
      assert(chunks.every(Boolean));
      const joined=Buffer.concat(chunks);
      assert.equal(joined.length,lastSession.meta.bytes);
      assert.equal(await hex(joined),lastSession.meta.sha256);
      return finishOverride||{verified:true,sha256:lastSession.meta.sha256,bytes:joined.length,pdfPages:3,receiptId:'recibo-test'};
    }
  };
  return {gateway,stats:()=>({partsAttempted,duplicateParts,storedParts:lastSession?.accepted.size||0})};
}
const file=fakePdf();
const progress=[];
const reliable=server({lostReplyPart:0});
const receipt=await uploadPdfResumable({file,orderId:'WEB-123456',fileId:'archivo-1',
 mode:'bn',gateway:reliable.gateway,subtle:webcrypto.subtle,onProgress:p=>progress.push(p)});
assert.equal(receipt.status,'verified');
assert.equal(receipt.pages,3);
assert.equal(receipt.bytes,file.size);
assert.equal(reliable.stats().storedParts,3);
assert.equal(reliable.stats().partsAttempted,3); // no reenvía el fragmento que sí llegó
assert.equal(progress.at(-1).finishedBytes,file.size);

const interrupted=server({failedPart:1});
await assert.rejects(()=>uploadPdfResumable({file,orderId:'WEB-123457',fileId:'archivo-1',
 mode:'color',gateway:interrupted.gateway,subtle:webcrypto.subtle,wait:async()=>{}}),
 /No se pudo confirmar el fragmento 2/);
assert.equal(interrupted.stats().storedParts,1);
// Rehacer la prueba de reanudación con servidor común y una caída temporal.
const restartServer=server();
const originalPart=restartServer.gateway.part;
let failOnce=true;
restartServer.gateway.part=async data=>{
 if(data.index===1&&failOnce){failOnce=false;throw Error('Corte temporal');}
 return originalPart(data);
};
const resumeReceipt=await uploadPdfResumable({file,orderId:'WEB-123458',fileId:'archivo-1',
 mode:'bn',gateway:restartServer.gateway,subtle:webcrypto.subtle,wait:async()=>{}});
assert.equal(resumeReceipt.status,'verified');
assert.equal(restartServer.stats().storedParts,3);

const notVerified=server({finishOverride:{verified:false,sha256:'no',bytes:file.size,pdfPages:3}});
await assert.rejects(()=>uploadPdfResumable({file,orderId:'WEB-123459',fileId:'archivo-1',
 mode:'bn',gateway:notVerified.gateway,subtle:webcrypto.subtle}),
 /no verificó el PDF completo/);
const bad=new File(['soy un documento word'],'informe.pdf',{type:'application/pdf'});
await assert.rejects(()=>uploadPdfResumable({file:bad,orderId:'WEB-123460',fileId:'archivo-1',
 mode:'bn',gateway:server().gateway,subtle:webcrypto.subtle}),/encabezado PDF válido/);
await assert.rejects(()=>uploadPdfResumable({file,orderId:'WEB-123461',fileId:'archivo-1',
 mode:'mixto',gateway:server().gateway,subtle:webcrypto.subtle}),/Modalidad de impresión/);
console.log('OK: fragmentos íntegros, respuesta perdida, reintentos, bloqueo sin verificación y archivos inválidos.');
