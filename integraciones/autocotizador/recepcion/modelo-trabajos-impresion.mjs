/**
 * Modelo de interfaz para pedidos compuestos por trabajos de impresión.
 * Mantiene la identidad del trabajo fuera de las líneas estrictas que recibe
 * el motor comercial. No calcula precios ni cambia reglas de compatibilidad.
 */
const SERVICES=new Set(['auto','stickers','fotos','corte','grafica']);
const CONFIG_KEYS=new Set([
 'seleccion','modo','caras','papelPoster','copias','anillado','grupoAnillado',
 'paginasPorHoja','materialColor','paginasSeleccionadas','productoFoto',
 'productoGrafica','corteVariante','corteMetros'
]);
const VALID_ID=/^[A-Za-z0-9_-]{1,80}$/;
const DEFAULTS=Object.freeze({
 seleccion:'sin-confirmar',modo:'bn',caras:'simple',papelPoster:'obra80',
 copias:1,anillado:'ninguno',grupoAnillado:'',paginasPorHoja:1,
 materialColor:'',paginasSeleccionadas:'',productoFoto:'',productoGrafica:'',
 corteVariante:'gt3',corteMetros:1
});

function assertId(id,label){
 if(typeof id!=='string'||!VALID_ID.test(id))throw Error(label+' inválido.');
}
function sanitizeOverrides(config={}){
 if(!config||typeof config!=='object'||Array.isArray(config))
  throw Error('Configuración de trabajo inválida.');
 for(const key of Object.keys(config))if(!CONFIG_KEYS.has(key))
  throw Error('Opción de trabajo desconocida: '+key);
 return {...config};
}
function sanitizeConfig(config={}){
 return {...DEFAULTS,...sanitizeOverrides(config)};
}
function copyWork(work){
 return {...work,configuracion:{...work.configuracion},archivos:work.archivos.map(f=>({
  ...f, paginas:Array.isArray(f.paginas)?f.paginas.map(p=>({...p})):f.paginas,
  excepciones:{...f.excepciones}
 }))};
}
function replaceWork(works,id,fn){
 if(!Array.isArray(works))throw Error('Pedido inválido.');
 let found=false;
 const next=works.map(w=>{
  if(w.id!==id)return w;
  found=true;return fn(copyWork(w));
 });
 if(!found)throw Error('No se encontró el trabajo.');
 return next;
}

export function crearTrabajo({id,nombre='Trabajo nuevo',servicio='auto',configuracion={}}={}){
 assertId(id,'ID de trabajo');
 if(!SERVICES.has(servicio))throw Error('Servicio no habilitado.');
 if(typeof nombre!=='string'||nombre.trim().length<1||nombre.trim().length>80)
  throw Error('Nombre de trabajo inválido.');
 return {id,nombre:nombre.trim(),servicio,configuracion:sanitizeConfig(configuracion),archivos:[]};
}

export function agregarTrabajo(works,work){
 if(!Array.isArray(works)||!work||!VALID_ID.test(work.id||'')||
    works.some(w=>w.id===work.id))throw Error('Trabajo duplicado o inválido.');
 return [...works,copyWork(work)];
}

export function editarConfiguracionTrabajo(works,id,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Cambio inválido.');
 return replaceWork(works,id,w=>{
  if(Object.hasOwn(patch,'servicio')){
   if(!SERVICES.has(patch.servicio))throw Error('Servicio no habilitado.');
   w.servicio=patch.servicio;
  }
  if(Object.hasOwn(patch,'nombre')){
   if(typeof patch.nombre!=='string'||!patch.nombre.trim()||patch.nombre.trim().length>80)
    throw Error('Nombre de trabajo inválido.');
   w.nombre=patch.nombre.trim();
  }
  if(Object.hasOwn(patch,'configuracion'))
   w.configuracion=sanitizeConfig({...w.configuracion,...patch.configuracion});
  return w;
 });
}

export function duplicarConfiguracionTrabajo(works,id,newId,nombre){
 assertId(newId,'ID de trabajo');
 if(!Array.isArray(works)||works.some(w=>w.id===newId))throw Error('ID de trabajo duplicado.');
 const original=works.find(w=>w.id===id);
 if(!original)throw Error('No se encontró el trabajo.');
 return agregarTrabajo(works,crearTrabajo({id:newId,
  nombre:nombre||original.nombre+' (copia)',servicio:original.servicio,
  configuracion:original.configuracion}));
}

export function agregarArchivosTrabajo(works,id,files){
 if(!Array.isArray(files)||!files.length)throw Error('No se seleccionaron archivos.');
 return replaceWork(works,id,w=>{
  const ids=new Set(w.archivos.map(f=>f.id));
  for(const f of files){
   if(!f||!VALID_ID.test(f.id||'')||ids.has(f.id)||typeof f.nombre!=='string'||
      !f.nombre||!Array.isArray(f.paginas)||!f.paginas.length)
    throw Error('Archivo de trabajo inválido o repetido.');
   ids.add(f.id);
  }
  w.archivos.push(...files.map(f=>({id:f.id,nombre:f.nombre,paginas:f.paginas.map(p=>({...p})),
   archivoOriginal:f.archivoOriginal||null,excepciones:sanitizeOverrides(f.excepciones||{})})));
  return w;
 });
}

export function quitarArchivoTrabajo(works,id,fileId){
 return replaceWork(works,id,w=>{
  const before=w.archivos.length;w.archivos=w.archivos.filter(f=>f.id!==fileId);
  if(w.archivos.length===before)throw Error('No se encontró el archivo.');
  return w;
 });
}

export function eliminarTrabajo(works,id){
 if(!Array.isArray(works)||!works.some(w=>w.id===id))throw Error('No se encontró el trabajo.');
 return works.filter(w=>w.id!==id);
}

/**
 * Construye el formato por archivo que ya consume prepararLoteParcial() y el
 * motor actual. El mapa sidecar enlaza cada línea cotizable con su trabajo,
 * sin contaminar la entrada del motor con propiedades nuevas.
 */
export function aplanarTrabajosParaCotizar(works){
 if(!Array.isArray(works)||!works.length)throw Error('El pedido no tiene trabajos.');
 const archivos=[],vinculos=[],trabajosPedido=[];
 for(const work of works){
  assertId(work?.id,'ID de trabajo');
  if(!SERVICES.has(work.servicio)||!Array.isArray(work.archivos))
   throw Error('Trabajo no cotizable.');
  if(work.archivos.length===0)throw Error('Hay un trabajo sin archivos.');
  const defaults=sanitizeConfig(work.configuracion);
  const grupo={id:work.id,nombre:work.nombre,indices:[]};
  for(const file of work.archivos){
   if(!file||!VALID_ID.test(file.id||'')||!Array.isArray(file.paginas)||!file.paginas.length)
    throw Error('Hay un archivo sin análisis completo.');
   const config={...defaults,...sanitizeOverrides(file.excepciones||{})};
   const indice=archivos.length;
   archivos.push({
    nombre:file.nombre,paginas:file.paginas.map(p=>({...p})),
    paginasSeleccionadas:config.paginasSeleccionadas,
    seleccion:config.seleccion,servicio:work.servicio,
    productoFoto:config.productoFoto,productoGrafica:config.productoGrafica,
    corteVariante:config.corteVariante,corteMetros:config.corteMetros,
    copias:config.copias,modo:config.modo,caras:config.caras,
    paginasPorHoja:config.paginasPorHoja,papelPoster:config.papelPoster,
    anillado:config.anillado,grupoAnillado:config.grupoAnillado,
    materialColor:config.materialColor
   });
   vinculos.push(Object.freeze({indice,trabajoId:work.id,archivoId:file.id}));
   grupo.indices.push(indice);
  }
  trabajosPedido.push(Object.freeze(grupo));
 }
 if(!archivos.length)throw Error('El pedido no tiene archivos.');
 return Object.freeze({archivos:Object.freeze(archivos),vinculos:Object.freeze(vinculos),
  trabajosPedido:Object.freeze(trabajosPedido)});
}
