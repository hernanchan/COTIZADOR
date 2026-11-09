import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../vidriera/index.html',import.meta.url),'utf8');
const count=x=>html.split(x).length-1;

test('Saber Directo tiene identidad, estructura responsive y sin imagen decorativa de stock',()=>{
  assert.match(html,/SABER DIRECTO V1/);
  assert.match(html,/#0a3158/i);
  assert.match(html,/#f7931e/i);
  assert.match(html,/DM Sans/);
  assert.match(html,/Manrope/);
  assert.match(html,/class="hero hero-direct"/);
  assert.match(html,/class="hero-services v3-service-strip"/);
  assert.match(html,/@media\(max-width:650px\)/);
  assert.doesNotMatch(html,/images\.unsplash\.com\/photo-1455390582262/);
});

test('Promoción dinámica única visible en la portada y enlaces internos válidos',()=>{
  for(const id of ['promoDay','promoTitle','promoText','beneficio','contacto','categorias','cartBadge'])
    assert.equal(count('id="'+id+'"'),1,'ID único: '+id);
  assert.match(html,/id="beneficio"[\s\S]*?<h2 id="promoTitle"/);
  assert.match(html,/Cotizá antes de encargar/);
  assert.match(html,/Los precios y descuentos, si corresponden, se indican en el presupuesto/);
  assert.doesNotMatch(html,/Lunes de planos|10% en ploteos CAD|10% en impresiones|Anillado sin cargo|20% online/);
  assert.doesNotMatch(html,/promos=\\{/);
  assert.match(html,/href="#beneficio"/);
  assert.match(html,/href="#contacto"/);
});

test('Conserva catálogo, carrito, consulta WhatsApp y puertas comerciales existentes',()=>{
  for(const token of [
    'productsCsvUrl','data-panel="escolar"','data-panel="oficina"',
    'data-panel="novedades"','data-panel="impresion"','id="gridEscolar"',
    'id="gridOficina"','id="cartBody"','id="grandTotal"',
    'window.openCart=function()','window.sendWhatsApp=async function()',
    "fetch('polaroids/recepcion-config.json'"
  ]) assert.ok(html.includes(token),'Falta contrato histórico: '+token);
  assert.match(html,/href="cotizar\.html"/);
  assert.match(html,/class="mobilebar"/);
});

test('V3 hero tiene fotografía comercial y los dos caminos de compra',()=>{
 assert.match(html,/SABER RETAIL V3/);
 assert.match(html,/src="https:\/\/images\.unsplash\.com\/photo-/);
 assert.match(html,/v3-tile-products/);
 assert.match(html,/v3-tile-print/);
 assert.match(html,/Descubrir productos/);
 assert.match(html,/Cotizar impresiones/);
 assert.match(html,/class="v3-category-photo"/);
 assert.equal((html.match(/id="promoTitle"/g)||[]).length,1);
});
