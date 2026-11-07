#!/usr/bin/env node
/**
 * Preprensa AISLADA / offline: genera copia candidata de PDF grande sin perdida
 * por compresion de streams y objetos. NO rasteriza, no cambia imagenes JPEG,
 * no imprime, no guarda objetos en la web y NO habilita orden de produccion.
 * Requiere qpdf, pdfinfo y pdftoppm en una maquina/runner separado del Worker.
 *
 * Uso: node tools/preprensa-plano-a1-qpdf.mjs original.pdf candidata.pdf
 * Resultado: copia nueva + manifiesto; el original NUNCA se modifica.
 */
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createReadStream,existsSync} from 'node:fs';
import {lstat,open,mkdir,mkdtemp,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';

const MIB=1024*1024,MAX_BYTES=256*MIB;
const [srcArg,outArg]=process.argv.slice(2);
if(process.argv.length!==4||!/\.pdf$/i.test(srcArg||'')||!/\.pdf$/i.test(outArg||''))
 throw Error('USO: node tools/preprensa-plano-a1-qpdf.mjs original.pdf candidata.pdf');
const source=resolve(srcArg),destination=resolve(outArg);
if(source===destination)throw Error('PREPRENSA_NUNCA_SOBRESCRIBIR_ORIGINAL');
const original=await lstat(source);
if(!original.isFile()||original.isSymbolicLink()||original.size<5||
 original.size>MAX_BYTES)throw Error('PREPRENSA_ORIGINAL_NO_ADMITIDO');
await mkdir(dirname(destination),{recursive:true});
if(existsSync(destination)||existsSync(destination+'.manifest.json'))
 throw Error('PREPRENSA_NO_SOBRESCRIBIR_SALIDA');
const outputDir=await mkdtemp(join(tmpdir(),'saber-preprensa-'));
const temporary=join(outputDir,'salida.pdf');
const OLD=join(outputDir,'original-muestra');
const NEW=join(outputDir,'copia-muestra');
async function run(executable,args,{timeoutSec=90}={}){
 let output='',error='';
 const p=spawn('timeout',['--kill-after=5s',timeoutSec+'s',executable,...args],{
  stdio:['ignore','pipe','pipe'],env:{...process.env,LC_ALL:'C'}
 });
 const completed=await new Promise((ok,fail)=>{
  p.on('error',fail);p.on('close',(code,signal)=>ok({code,signal}));
  p.stdout.on('data',chunk=>{output+=(output.length>32768?'':chunk.toString().slice(0,32768-output.length))});
  p.stderr.on('data',chunk=>{error+=(error.length>32768?'':chunk.toString().slice(0,32768-error.length))});
 });
 if(completed.code!==0)throw Error('PREPRENSA_EJECUCION_FALLIDA_'+executable+
  '_EXIT_'+completed.code+' '+error.replace(/\s+/g,' ').slice(0,220));
 return output;
}
const sha=async path=>{
 const h=createHash('sha256');
 for await(const part of createReadStream(path,{highWaterMark:1024*1024}))h.update(part);
 return h.digest('hex');
};
function interpretInfo(data){
 const p=/^Pages:\s*(\d+)$/m.exec(data);
 const size=/^Page size:\s*([\d.]+)\s*x\s*([\d.]+)\s*pts/m.exec(data);
 const rotation=/^Page rot:\s*(\d+)$/m.exec(data);
 const media=/^MediaBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/m.exec(data);
 const crop=/^CropBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/m.exec(data);
 if(!p||!size||!rotation||!media||!crop)throw Error('PREPRENSA_PDFINFO_INCOMPLETO');
 return {
  pages:Number(p[1]),
  widthPt:Number(size[1]),heightPt:Number(size[2]),rotation:Number(rotation[1]),
  media:media.slice(1).map(Number),crop:crop.slice(1).map(Number)
 };
}
const equal=(x,y,tol=0.25)=>Math.abs(x-y)<=tol;
const boxesMatch=(x,y)=>x.length===y.length&&x.every((a,i)=>equal(a,y[i]));
const say=info=>({
 pages:info.pages,widthCm:Math.round(info.widthPt*2.54/72*100)/100,
 heightCm:Math.round(info.heightPt*2.54/72*100)/100,rotation:info.rotation
});
const begin=performance.now();
try{
 const input=await open(source,'r');
 try{
  const magic=Buffer.alloc(5);
  const read=await input.read(magic,0,5,0);
  if(read.bytesRead!==5||magic.toString('ascii')!=='%PDF-')
   throw Error('PREPRENSA_ORIGINAL_SIN_CABECERA_PDF');
 }finally{await input.close()}
 const first=interpretInfo(await run('pdfinfo',['-box',source],{timeoutSec:35}));
 if(first.pages!==1)throw Error('PREPRENSA_UNA_PAGINA_POR_LOTE_REQUERIDA');
 if(first.widthPt<500||first.heightPt<500)
  throw Error('PREPRENSA_NO_ES_PLOTEO');
 await run('qpdf',['--check',source],{timeoutSec:70});
 // --optimize-images está deliberadamente EXCLUIDO: sería JPEG con pérdida.
 // --recompress-flate también se excluye: evita reabrir enormes imágenes ya
 // comprimidas. Esta operación NO garantiza optimizar todos los PDFs.
 await run('qpdf',[
  '--stream-data=compress','--object-streams=generate',
  '--compression-level=6',source,temporary
 ],{timeoutSec:120});
 await run('qpdf',['--check',temporary],{timeoutSec:60});
 const after=interpretInfo(await run('pdfinfo',['-box',temporary],{timeoutSec:35}));
 if(first.pages!==after.pages||first.rotation!==after.rotation||
  !equal(first.widthPt,after.widthPt)||!equal(first.heightPt,after.heightPt)||
  !boxesMatch(first.media,after.media)||!boxesMatch(first.crop,after.crop))
  throw Error('PREPRENSA_DIMENSIONES_CAMBIARON');
 // Comparacion de muestras renderizadas, acotadas a 720 px; NO sustituye
 // revisión profesional de lineas CAD finas y colores, ni autoriza impresión.
 await run('pdftoppm',['-f','1','-l','1','-singlefile','-scale-to','720',
  '-png',source,OLD],{timeoutSec:90});
 await run('pdftoppm',['-f','1','-l','1','-singlefile','-scale-to','720',
  '-png',temporary,NEW],{timeoutSec:90});
 const [beforePreview,afterPreview]=await Promise.all([sha(OLD+'.png'),sha(NEW+'.png')]);
 if(beforePreview!==afterPreview)throw Error('PREPRENSA_MUESTRA_VISUAL_CAMBIO');
 const size=(await stat(temporary)).size;
 const reduced=(original.size-size)/original.size;
 // Una reducción insignificante no soluciona el problema de pesadez:
 // no generar una "copia lista" que engañe al personal.
 const useful=size<original.size&&reduced>=0.05;
 const manifest={
  schema:'saber-preprensa-pdf-candidato-v1',
  status:useful?'CANDIDATO_REQUIERE_REVISION':'SIN_REDUCCION_SUFICIENTE_REQUIERE_OTRO_TRATAMIENTO',
  sourceSha256:await sha(source),
  sourceBytes:original.size,outputBytes:size,
  outputSha256:await sha(temporary),
  pageCount:after.pages,pageSize:say(after),
  previewComparison:'MUESTRA_720PX_IDENTICA',
  contentsLosslessCompressionOnly:true,imagesDownsampled:false,
  plotterPrintAuthorized:false,paymentAuthorized:false,
  requiresOperatorReview:true,
  visualValidationIsNotProofOfFineLinePrecision:true,
  durationMs:Math.round(performance.now()-begin)
 };
 if(useful){
  // El destino sólo se escribe después de validar y nunca reemplaza archivo.
  await rename(temporary,destination);
  await writeFile(destination+'.manifest.json',JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
 }
 console.log(JSON.stringify({status:manifest.status,
  originalMiB:Number((original.size/MIB).toFixed(2)),
  candidateMiB:Number((size/MIB).toFixed(2)),
  reductionPercent:Number((reduced*100).toFixed(2)),...say(after),
  originalPreserved:true,automaticPrinting:false,
  durationMs:manifest.durationMs}));
}finally{
 await rm(outputDir,{force:true,recursive:true});
}
