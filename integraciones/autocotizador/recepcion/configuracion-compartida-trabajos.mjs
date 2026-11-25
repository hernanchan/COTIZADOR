// Overrides locales para las opciones que se comparten en un trabajo.
// Los metadatos viven como propiedad no enumerable para no entrar en cotización,
// manifiesto ni handoff; el valor efectivo sí se refleja en los campos originales.
const FIELDS=new Set(['modo','caras','copias','paginasPorHoja','anillado','papelPoster']);
const KEY='__saberExcepcionesTrabajo';

function overrides(file){
 if(!file||typeof file!=='object')throw Error('Archivo inválido.');
 if(!Object.hasOwn(file,KEY))Object.defineProperty(file,KEY,{
  value:{},writable:true,configurable:true,enumerable:false
 });
 return file[KEY];
}
function parseBinding(value){
 if(typeof value!=='string')throw Error('Anillado inválido.');
 const group=/^grupo:([1-5])$/.exec(value);
 return group?{anillado:'grupo',grupoAnillado:group[1]}:
  {anillado:value,grupoAnillado:''};
}
function assign(file,field,value){
 if(field==='anillado'){
  Object.assign(file,parseBinding(value));
  return;
 }
 file[field]=value;
}
export function establecerExcepcionDeArchivo(file,field,value){
 if(!FIELDS.has(field))throw Error('Opción compartida desconocida.');
 overrides(file)[field]=value;
 assign(file,field,value);
 return file;
}
export function limpiarExcepcionDeArchivo(file,field){
 if(!FIELDS.has(field))throw Error('Opción compartida desconocida.');
 delete overrides(file)[field];
 return file;
}
export function excepcionesDeArchivo(file){
 return {...overrides(file)};
}
export function aplicarConfiguracionCompartida(file,config={}){
 const local=overrides(file);
 for(const [field,value] of Object.entries(config)){
  if(FIELDS.has(field)&&!Object.hasOwn(local,field))assign(file,field,value);
 }
 return file;
}
export function aplicarValorCompartido(file,field,value){
 if(!FIELDS.has(field))throw Error('Opción compartida desconocida.');
 delete overrides(file)[field];
 assign(file,field,value);
 return file;
}
