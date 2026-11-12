/** Copia fotos de productos YA publicados en Google Sheets a la vidriera estática.
 * No toca precios, pedidos, R2, datos privados ni Google Drive.
 * Los cambios quedan sólo en la rama de integración hasta aprobación de main.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('vidriera');
const html=await readFile(join(root,'index.html'),'utf8');
const csvUrl=(html.match(/const productsCsvUrl='([^']+)'/)||[])[1];
assert.match(csvUrl||'',/^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\//);
const csvResponse=await fetch(csvUrl,{redirect:'follow',signal:AbortSignal.timeout(22000)});
assert.equal(csvResponse.status,200);
const csv=await csvResponse.text();
assert.ok(csv.length<1000000);
function parseCsv(s){
 const rows=[];let row=[],f='',q=false;
 for(let i=0;i<s.length;i++){
  const c=s[i],n=s[i+1];
  if(c==='"'&&q&&n==='"'){f+='"';i++}
  else if(c==='"')q=!q;
  else if(c===','&&!q){row.push(f);f=''}
  else if((c==='\n'||c==='\r')&&!q){
   if(c==='\r'&&n==='\n')i++;
   row.push(f);if(row.some(x=>x.trim()))rows.push(row);row=[];f='';
  }else f+=c;
 }
 row.push(f);if(row.some(x=>x.trim()))rows.push(row);
 assert.equal(q,false,'CSV_INCOMPLETO');return rows;
}
const rows=parseCsv(csv),headers=rows.shift();
const norm=x=>String(x||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const col=k=>headers.findIndex(x=>norm(x)===norm(k));
for(const key of ['Activo','Código','Foto'])assert.ok(col(key)>=0,'SHEETS_COLUMN_'+key);
const out=join(root,'assets','productos');
await mkdir(out,{recursive:true});
const photos={},exts={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
let total=0;
for(const row of rows){
 if(!['SI','TRUE','1','X'].includes(norm(row[col('Activo')])))continue;
 const code=String(row[col('Código')]||'').trim();
 const photo=String((col('Enlace foto (pegá aquí)')>=0?row[col('Enlace foto (pegá aquí)')]:'')||row[col('Foto')]||'').trim();
 if(!code||!photo)continue;
 assert.ok(code.length<=90,'CODIGO_INVALIDO');
 let match=photo.match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,160})(?:[/?#]|$)/);
 if(!match)match=photo.match(/^https:\/\/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]{10,160})(?:[&#]|$)/);
 if(!match)throw Error('FOTO_FUERA_DE_GOOGLE_DRIVE_'+norm(code).slice(0,14));
 const fileId=match[1],thumbnail='https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w1200';
 const response=await fetch(thumbnail,{redirect:'follow',signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,'GOOGLE_IMAGE_HTTP_'+response.status);
 const host=new URL(response.url).hostname;
 assert.ok(host==='drive.google.com'||host==='lh3.googleusercontent.com'||host.endsWith('.googleusercontent.com'),'FOTO_REDIRECCION_NO_CONFIABLE');
 const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 const ext=exts[mime];assert.ok(ext,'FOTO_MIME_INCORRECTO');
 const len=Number(response.headers.get('content-length'));
 if(Number.isFinite(len)&&len>2_500_000)throw Error('FOTO_MUY_GRANDE');
 const chunks=[];let count=0;
 for await(const chunk of response.body){count+=chunk.byteLength;if(count>2_500_000)throw Error('FOTO_MUY_GRANDE');chunks.push(chunk)}
 const buffer=Buffer.concat(chunks,count);
 assert.ok(buffer.length>=128,'FOTO_VACIA');
 const jpg=ext==='jpg'&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
 const png=ext==='png'&&buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 const webp=ext==='webp'&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 assert.ok(jpg||png||webp,'FOTO_NO_ES_IMAGEN');
 const name=createHash('sha256').update(code).digest('hex').slice(0,16)+'.'+ext;
 await writeFile(join(out,name),buffer);
 photos[code]='assets/productos/'+name;
 total+=count;
 console.log('SABER_V3_PHOTO_LOCAL_OK '+JSON.stringify({size:buffer.length,mime,slot:Object.keys(photos).length}));
}
assert.ok(Object.keys(photos).length>=3&&Object.keys(photos).length<=40,'CATALOGO_FOTOS_INCOMPLETO');
const manifest={schema:'saber-fotos-productos-local-v1',images:Object.fromEntries(Object.entries(photos).sort(([a],[b])=>a.localeCompare(b)))};
await writeFile(join(root,'fotos-productos.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('SABER_V3_PHOTOS_LOCAL_SAVED='+Object.keys(photos).length);
console.log('SABER_V3_PHOTOS_TOTAL_BYTES='+total);
console.log('SABER_V3_PHOTOS_FROM_PUBLIC_CSV_NO_DRIVE_WRITE_NO_MAIN_NO_PAYMENT');
