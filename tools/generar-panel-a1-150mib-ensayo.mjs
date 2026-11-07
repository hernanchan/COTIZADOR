#!/usr/bin/env node
/**
 * SOLO ENSAYO de preprensa: PDF A1 vectorial, UNA pagina, 150 MiB exactos.
 * 150 MiB consisten casi todos en espacio PDF valido dentro del stream.
 * No representa un caso real de millones de vectores ni una imagen compleja.
 * Genera datos sinteticos y no lee archivos de clientes.
 */
import {open,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=process.argv[2];
if(process.argv.length!==3||!/\.pdf$/i.test(output||''))
 throw Error('Uso: node tools/generar-panel-a1-150mib-ensayo.mjs /tmp/panel-a1.pdf');
const path=resolve(output),MiB=1024*1024,target=150*MiB;
const command='q\n0.85 0.10 0.10 RG 3 w 100 100 m 1550 2280 l S\nQ\n';
function build(streamLength){
 const chunks=[];let offset=0,positions={};
 const put=s=>{const b=Buffer.from(s,'ascii');chunks.push(b);offset+=b.length};
 function obj(n,body){positions[n]=offset;put(n+' 0 obj\n'+body+'\nendobj\n')}
 put('%PDF-1.4\n');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
 obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1683.78 2383.94] /Resources << >> /Contents 4 0 R >>');
 positions[4]=offset;
 put('4 0 obj\n<< /Length '+streamLength+' >>\nstream\n');
 const before=Buffer.concat(chunks);
 const afterStream='\nendstream\nendobj\n';
 const xrefStart=before.length+streamLength+Buffer.byteLength(afterStream);
 const row=n=>String(positions[n]).padStart(10,'0')+' 00000 n \n';
 const after=Buffer.from(afterStream+
   'xref\n0 5\n0000000000 65535 f \n'+row(1)+row(2)+row(3)+row(4)+
   'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xrefStart+'\n%%EOF\n','ascii');
 return {before,after};
}
let streamLength=target-600,built;
for(let i=0;i<25;i++){
 const p=build(streamLength);
 const updated=target-p.before.length-p.after.length;
 if(updated===streamLength){built=p;break}
 streamLength=updated;
}
if(!built||streamLength<command.length)throw Error('ENSAYO_PDF_TAMANO_NO_CONVERGIO');
const fd=await open(path,'wx',0o600);
try{
 await fd.write(built.before);
 await fd.write(Buffer.from(command,'ascii'));
 let remain=streamLength-Buffer.byteLength(command);
 const spaces=Buffer.alloc(MiB,0x20);
 while(remain>0){const n=Math.min(remain,spaces.length);await fd.write(spaces,0,n);remain-=n}
 await fd.write(built.after);
}finally{await fd.close()}
if((await stat(path)).size!==target)throw Error('ENSAYO_PDF_BYTES_NO_COINCIDEN');
console.log('PDF_SINTETICO_A1_150_MIB_GENERADO bytes='+target+' pages=1 original_data=false');
