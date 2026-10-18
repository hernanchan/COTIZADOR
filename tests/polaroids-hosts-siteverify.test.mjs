// No hace llamadas externas ni publica. Test del control de hostname propuesto
// para el Apps Script de Polaroids. Uso: node tests/polaroids-hosts-siteverify.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const path=new URL('../integraciones/polaroids/apps-script/validacion-turnstile-dominios-piloto.gs',import.meta.url);
const ctx=vm.createContext({});
vm.runInContext(await readFile(path,'utf8'),ctx);
const validate=ctx.saberPolaroidsTurnstileAceptado_;
assert.equal(typeof validate,'function');
const base={success:true,action:'polaroids',hostname:'polaroids-integracion-sin-r2.libreriasaber.pages.dev'};
const table=[
 ['piloto',base,true],
 ['dominio publico',{...base,hostname:'libreriasaber.com.ar'},true],
 ['fallo de autenticacion',{...base,success:false},false],
 ['accion diferente',{...base,action:'checkout'},false],
 ['otra accion',{...base,action:null},false],
 ['subdominio falso',{...base,hostname:'evil.libreriasaber.com.ar'},false],
 ['sufijo falso',{...base,hostname:'libreriasaber.com.ar.evil.com'},false],
 ['dominio con puerto',{...base,hostname:'libreriasaber.com.ar:443'},false],
 ['dominio en mayusculas',{...base,hostname:'LIBRERIASABER.COM.AR'},false],
 ['sin hostname',{success:true,action:'polaroids'},false],
 ['null',null,false],
 ['texto','libreriasaber.com.ar',false]
];
for(const [name,payload,expected] of table)
 assert.equal(validate(payload),expected,'Control: '+name);
console.log('PASS: lista exacta de hostnames, acción polaroids y success validado ('+table.length+' casos).');
