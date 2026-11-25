/** Validates the UI-only grouping sidecar before it reaches the quote envelope. */
const ID=/^[A-Za-z0-9_-]{1,80}$/;
export function validarTrabajosPedido(trabajosPedido,cantidadArchivos,{maxTrabajos=10}={}){
 if(!Array.isArray(trabajosPedido)||!Number.isSafeInteger(cantidadArchivos)||
    cantidadArchivos<1||cantidadArchivos>30||trabajosPedido.length<1||
    trabajosPedido.length>Math.min(maxTrabajos,cantidadArchivos))
  throw Error('TRABAJOS_PEDIDO_INVALIDOS');
 const ids=new Set(),indices=new Set();
 const normalized=trabajosPedido.map((work,pos)=>{
  if(!work||typeof work!=='object'||Array.isArray(work)||
     Object.keys(work).sort().join(',')!=='id,indices,nombre'||
     typeof work.id!=='string'||!ID.test(work.id)||ids.has(work.id)||
     typeof work.nombre!=='string'||work.nombre.trim().length<1||
     work.nombre.trim().length>80||/[<>]/.test(work.nombre)||
     !Array.isArray(work.indices)||work.indices.length<1)
   throw Error('TRABAJO_PEDIDO_INVALIDO_'+pos);
  ids.add(work.id);
  const local=new Set();
  for(const index of work.indices){
   if(!Number.isSafeInteger(index)||index<0||index>=cantidadArchivos||
      local.has(index)||indices.has(index))throw Error('TRABAJO_ARCHIVO_DUPLICADO_O_AJENO');
   local.add(index);indices.add(index);
  }
  return Object.freeze({id:work.id,nombre:work.nombre.trim(),
   indices:Object.freeze([...work.indices])});
 });
 if(indices.size!==cantidadArchivos)throw Error('TRABAJO_ARCHIVO_SIN_GRUPO');
 // A work-based UI flattens files in visible work order. Refuse reordered or
 // sparse mappings so order and production instructions remain deterministic.
 const flattened=normalized.flatMap(w=>w.indices);
 if(flattened.some((index,i)=>index!==i))throw Error('TRABAJOS_PEDIDO_ORDEN_INVALIDO');
 return Object.freeze(normalized);
}

/** Validates the server form: each UI work maps to exact file IDs, in order. */
export function validarGruposArchivosPedido(trabajosPedido,fileIds,{maxTrabajos=10}={}){
 if(!Array.isArray(fileIds)||fileIds.length<1||fileIds.length>30||
    !Array.isArray(trabajosPedido)||trabajosPedido.length<1||
    trabajosPedido.length>Math.min(maxTrabajos,fileIds.length)||
    fileIds.some(id=>typeof id!=='string'||!ID.test(id))||
    new Set(fileIds).size!==fileIds.length)throw Error('GRUPOS_ARCHIVOS_INVALIDOS');
 const used=new Set(),ids=new Set();
 const result=trabajosPedido.map((work,pos)=>{
  if(!work||typeof work!=='object'||Array.isArray(work)||
     Object.keys(work).sort().join(',')!=='fileIds,id,nombre'||
     typeof work.id!=='string'||!ID.test(work.id)||
     ids.has(work.id)||
     typeof work.nombre!=='string'||work.nombre.trim().length<1||
     work.nombre.trim().length>80||/[<>]/.test(work.nombre)||
     !Array.isArray(work.fileIds)||work.fileIds.length<1)
   throw Error('GRUPO_ARCHIVOS_INVALIDO_'+pos);
  ids.add(work.id);
  for(const id of work.fileIds){
   if(!fileIds.includes(id)||used.has(id))throw Error('GRUPO_ARCHIVO_AJENO_O_REPETIDO');
   used.add(id);
  }
  return Object.freeze({id:work.id,nombre:work.nombre.trim(),fileIds:Object.freeze([...work.fileIds])});
 });
 if(used.size!==fileIds.length||fileIds.some((id,index)=>
    result.flatMap(w=>w.fileIds).indexOf(id)!==index))
  throw Error('GRUPO_ARCHIVO_SIN_GRUPO_O_ORDEN_INVALIDO');
 return Object.freeze(result);
}
