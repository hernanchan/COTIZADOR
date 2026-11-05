/**
 * Catálogo público de artículos: fuente única para la vista comercial V3 de ensayo.
 * SOLO Google Sheets PUBLICADO; nunca toca D1, pedidos, MP ni los archivos TUS.
 */
export const URL_CATALOGO_PUBLICADO='https://docs.google.com/spreadsheets/d/e/2PACX-1vQx2zW0YP23ZjZMvLwkX_mkbPQgVPL_aUUtcI_n1ApZ6P9F4fBuKFOl-jB4qFmxwoeYsszAZSKbaUVn/pub?gid=419356696&single=true&output=csv';

export function parsearCsvProductos(csv){
 if(typeof csv!=='string'||csv.length>450000)throw Error('Catálogo demasiado grande');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const ch=csv[i],next=csv[i+1];
  if(ch==='"'&&quoted&&next==='"'){cell+='"';i++}
  else if(ch==='"')quoted=!quoted;
  else if(ch===','&&!quoted){row.push(cell);cell=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){
   if(ch==='\r'&&next==='\n')i++;
   row.push(cell);
   if(row.some(c=>String(c).trim()))rows.push(row);
   row=[];cell='';
  }else cell+=ch;
 }
 if(quoted)throw Error('CSV mal formado');
 row.push(cell);if(row.some(c=>String(c).trim()))rows.push(row);
 if(rows.length>2501)throw Error('Exceso de filas');
 return rows;
}
const normal=v=>String(v||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function leerPrecioArticulo(v){
 const input=String(v??'').trim().replace(/\$/g,'').replace(/\s/g,'');
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(input))return 0;
 const n=Number(input.replace(/\./g,'').replace(',','.'));
 return Number.isSafeInteger(n)&&n>0&&n<1000000000?n:0;
}
function imagenArticulo(src){
 const raw=String(src||'').trim();
 const id=raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{15,})/)?.[1]||
  raw.match(/[?&]id=([a-zA-Z0-9_-]{15,})/)?.[1];
 return id?'https://drive.google.com/thumbnail?id='+id+'&sz=w1200':null;
}
export function productosDesdeCsv(csv){
 const rows=parsearCsvProductos(csv);
 if(rows.length<1)throw Error('Catálogo sin cabeceras');
 const fields=rows[0].map(normal),col=name=>fields.indexOf(normal(name));
 const ix={active:col('Activo'),cat:col('Categoría'),name:col('Producto'),desc:col('Descripción'),
  price:col('Precio'),offer:col('Oferta'),image:col('Foto'),link:col('Enlace foto (pegá aquí)'),code:col('Código')};
 if([ix.active,ix.cat,ix.name,ix.price,ix.offer,ix.image,ix.code].some(v=>v<0))throw Error('Columnas incompletas');
 const products=[],used=new Set();
 for(const row of rows.slice(1)){
  if(!['SI','TRUE','1','X'].includes(normal(row[ix.active])))continue;
  const code=String(row[ix.code]||'').trim();
  const name=String(row[ix.name]||'').trim();
  const cat=String(row[ix.cat]||'').trim();
  const price=leerPrecioArticulo(row[ix.price]);
  if(!/^[a-zA-Z0-9_-]{1,48}$/.test(code)||!name||name.length>140||
      !cat||cat.length>65||!price||used.has(code.toUpperCase()))continue;
  used.add(code.toUpperCase());
  const candidate=leerPrecioArticulo(row[ix.offer]);
  const offer=candidate>0&&candidate<price?candidate:null;
  const photo=imagenArticulo(ix.link>=0?row[ix.link]:row[ix.image])||
   imagenArticulo(row[ix.image]);
  const desc=String((ix.desc>=0?row[ix.desc]:'')||'').trim().slice(0,240);
  products.push({code,name,cat,desc,price,offer,finalPrice:offer??price,photo});
  if(products.length>=500)break;
 }
 return products;
}
export async function consultarCatalogoPublicado(fetcher=fetch){
 const response=await fetcher(URL_CATALOGO_PUBLICADO,{
  method:'GET',redirect:'follow',
  headers:{Accept:'text/csv','Cache-Control':'no-cache'},signal:AbortSignal.timeout(11000)
 });
 if(!response.ok)throw Error('CSV HTTP '+response.status);
 const len=Number(response.headers.get('content-length')||0);
 if(len>450000)throw Error('CSV excede límite');
 const content=await response.text();
 const products=productosDesdeCsv(content);
 if(!products.length)throw Error('No hay artículos activos válidos');
 return {ok:true,products,checkedAt:new Date().toISOString(),source:'Google Sheets publicado',
  ordersEnabled:false,paymentsEnabled:false};
}
