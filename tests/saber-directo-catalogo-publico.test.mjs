import test from 'node:test';
import assert from 'node:assert/strict';
import {leerPrecioArticulo,parsearCsvProductos,productosDesdeCsv,consultarCatalogoPublicado,URL_CATALOGO_PUBLICADO} from '../integraciones/autocotizador/recepcion/catalogo-productos-publicos.mjs';
import {readFileSync} from 'node:fs';
const sample=[
 'Activo,Categoría,Producto,Descripción,Precio,Oferta,Foto,Código,Enlace foto (pegá aquí)',
 'SI,Escolar,Resaltador Filgo x 4 pastel,Resaltador cuerpo chato pastel,$5.400,$4.500,https://drive.google.com/thumbnail?id=1h1LuTjbxOHLBz5LjwRnedTDGu7xSt8Ew&sz=w1200,ESC001,https://drive.google.com/file/d/1h1LuTjbxOHLBz5LjwRnedTDGu7xSt8Ew/view',
 'SI,Escolar,Marcadores Jumbo Sabonis x 12,12 colores,$7.500,$6.500,https://drive.google.com/thumbnail?id=1NAzMD691MCl7EVd8ezeEMu0Higk1INn7&sz=w1200,ESC002,',
 'SI,Oficina,Resma A4 P AMPA 70 g,500 hojas,$8.000,$8.000,https://drive.google.com/thumbnail?id=1_j9dvL-8db2nJ01xKmjlZO3gbY1qrXOH&sz=w1200,OFI001,',
 'no,Novedades,Kit Sharpie Lettering,30 piezas,$32.000,$0,,OFI002,',
 'si,Escolar,Bolígrafo borrable,Personajes varios,4900,,,esc003,'
].join('\n');
test('Reconoce números argentinos y rechaza precios fraccionarios o inválidos',()=>{
 assert.equal(leerPrecioArticulo('$5.400'),5400);
 assert.equal(leerPrecioArticulo('4900'),4900);
 assert.equal(leerPrecioArticulo('8.000,00'),8000);
 assert.equal(leerPrecioArticulo('8.000,50'),0);
 assert.equal(leerPrecioArticulo(''),0);
 assert.equal(leerPrecioArticulo('-100'),0);
});
test('Lee CSV sin habilitar productos inactivos ni falsas promociones',()=>{
 const products=productosDesdeCsv(sample);
 assert.equal(products.length,4);
 assert.equal(products[0].finalPrice,4500);
 assert.equal(products[1].finalPrice,6500);
 assert.equal(products[2].finalPrice,8000);
 assert.equal(products[2].offer,null);
 assert.equal(products[0].photo,'https://drive.google.com/thumbnail?id=1h1LuTjbxOHLBz5LjwRnedTDGu7xSt8Ew&sz=w1200');
 assert.equal(products[3].finalPrice,4900);
 assert.ok(!products.some(x=>x.code==='OFI002'));
});
test('CSV escapa comillas, excluye código duplicado y protege longitudes',()=>{
 const csv='Activo,Categoría,Producto,Precio,Oferta,Foto,Código\nSI,Escolar,"Lápiz, A4",1200,900,,X001\nSI,Escolar,Doble,1300,1000,,x001';
 assert.equal(productosDesdeCsv(csv).length,1);
 assert.equal(productosDesdeCsv(csv)[0].name,'Lápiz, A4');
 assert.throws(()=>parsearCsvProductos('x,y\n"a,b'),/mal formado/);
});
test('La función pública solo accede al CSV fijo y nunca procesa una URL del cliente',async()=>{
 let called;
 const fake=async(url,options)=>{called={url,options};return{ok:true,headers:new Headers(),text:async()=>sample}};
 const r=await consultarCatalogoPublicado(fake);
 assert.equal(called.url,URL_CATALOGO_PUBLICADO);
 assert.equal(called.options.method,'GET');
 assert.equal(r.products.length,4);
 assert.equal(r.ordersEnabled,false);
 assert.equal(r.paymentsEnabled,false);
});
test('La URL publicada coincide con la de la tienda histórica sin cambios',()=>{
 const home=readFileSync(new URL('../vidriera/index.html',import.meta.url),'utf8');
 const offers=readFileSync(new URL('../vidriera/ofertas.html',import.meta.url),'utf8');
 assert.ok(home.includes(URL_CATALOGO_PUBLICADO));
 assert.ok(offers.includes(URL_CATALOGO_PUBLICADO));
});
