/**
 * Validación autoritativa de páginas sobre bytes privados DESCARGADOS de Drive.
 * Requiere bundling en Cloudflare Workers de la dependencia npm pdf-lib.
 * Código en rama de pruebas: NO desplegado, NO habilita pagos.
 */
import { PDFDocument } from 'pdf-lib';
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
/**
 * `reciboServidor` procede exclusivamente de Apps Script / Google Drive,
 * jamás del contenido que envió el navegador.
 */
export async function verificarPdfAlmacenado({
 driveBytes,reciboServidor,parser=PDFDocument.load,subtle=crypto.subtle
}){
 const r=reciboServidor;
 if(!r||r.receiptState!=='bytes_checked'||!/^DOC-[a-f0-9-]{36}$/i.test(r.receiptId||'')||
    typeof r.orderId!=='string'||typeof r.fileId!=='string'||
    !/\.pdf$/i.test(r.name||'')||!['bn','color'].includes(r.mode)||
    !Number.isSafeInteger(r.bytes)||r.bytes<5||r.bytes>20*1024*1024||
    !/^[a-f0-9]{64}$/.test(r.sha256||''))
    throw Error('El PDF no tiene comprobante íntegro de Drive.');
 if(!(driveBytes instanceof Uint8Array)||driveBytes.byteLength!==r.bytes)
    throw Error('Tamaño diferente del comprobante de Drive.');
 if(String.fromCharCode(...driveBytes.subarray(0,5))!=='%PDF-')
    throw Error('El archivo almacenado no tiene cabecera PDF.');
 const actual=hex(new Uint8Array(await subtle.digest('SHA-256',driveBytes)));
 if(actual!==r.sha256)throw Error('El PDF guardado difiere del original.');
 let pages;
 try{
  const pdf=await parser(driveBytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  pages=pdf?.getPageCount?.();
 }catch(_){throw Error('No se pudo verificar la estructura de páginas en el servidor.');}
 if(!Number.isSafeInteger(pages)||pages<1||pages>20000)
   throw Error('El número de páginas no es verificable.');
 return Object.freeze({orderId:r.orderId,fileId:r.fileId,name:r.name,mode:r.mode,
  receiptId:r.receiptId,bytes:r.bytes,sha256:actual,pages,
  status:'verified',pageVerification:'server',storageVerified:true});
}
