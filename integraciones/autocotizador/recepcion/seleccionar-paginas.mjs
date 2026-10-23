/** Selección comercial sin tocar el PDF original.
 * Sintaxis: "1-3,5,7". Se conserva el orden real y no se repiten páginas.
 */
export function seleccionarPaginas(paginas,especificacion){
 if(!Array.isArray(paginas)||!paginas.length||paginas.length>2000)throw Error('PDF sin páginas válidas');
 if(especificacion===''||especificacion==null)return paginas;
 if(typeof especificacion!=='string'||especificacion.length>500)throw Error('Selección de páginas demasiado extensa');
 if(!/^\s*\d+\s*(?:-\s*\d+\s*)?(?:,\s*\d+\s*(?:-\s*\d+\s*)?)*$/.test(especificacion))throw Error('Usá números o rangos, por ejemplo 1-3,5');
 const nums=new Set();
 for(const tramo of especificacion.split(',')){
  const partes=tramo.trim().split('-').map(x=>Number(x.trim()));
  const [inicio,fin=inicio]=partes;
  if(!Number.isSafeInteger(inicio)||!Number.isSafeInteger(fin)||inicio<1||fin>paginas.length||fin<inicio)
   throw Error('Hay páginas fuera del PDF o rangos invertidos');
  for(let n=inicio;n<=fin;n++)nums.add(n);
 }
 if(!nums.size)throw Error('Seleccioná al menos una página');
 return paginas.filter(p=>nums.has(p.numero));
}
