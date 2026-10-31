// Experimento independiente: no importa módulos del cotizador comercial.
import { Uppy, Dashboard, Tus } from 'https://releases.transloadit.com/uppy/v3.6.1/uppy.min.mjs';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { LAB_CONFIG as cfg } from './config.local.js';

const $ = id => document.getElementById(id);
const timers = {startedAt: null, uploadStart: null, uploadEnd: null, verifiedAt: null};
const entries = new Map();
let supabase, identity, uppy, busy = false;

const status = message => { $('state').textContent = message; };
const resultLine = message => {
  const p = document.createElement('p');
  p.textContent = message;
  $('results').append(p);
};
const hex = bytes => [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
const sha256 = async file => hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
const validConfig = () => cfg.projectUrl === 'https://'+cfg.projectId+'.supabase.co' &&
  /^[a-z0-9]{10,50}$/.test(cfg.projectId) &&
  typeof cfg.publishableKey === 'string' && cfg.publishableKey.length > 30 &&
  cfg.bucket === 'saber-tus-lab' && cfg.maxBytes === 20 * 1024 * 1024;

async function signFile(file) {
  const objectName = identity.id+'/'+crypto.randomUUID()+'.pdf';
  // RLS de Supabase permite autorización solamente para carpeta del usuario.
  const {data, error} = await supabase.storage.from(cfg.bucket).createSignedUploadUrl(objectName);
  if (error || !data?.token) throw Error('No se pudo autorizar el archivo en el bucket privado.');
  const expectedSha256 = await sha256(file.data);
  uppy.setFileMeta(file.id, {
    bucketName: cfg.bucket, objectName,
    contentType: 'application/pdf', cacheControl: '0',
  });
  uppy.setFileState(file.id, {tus: {headers: {'x-signature': data.token}}});
  const info = {objectName, expectedSha256, bytes: file.size};
  entries.set(file.id, {...entries.get(file.id), info});
  return info;
}

async function connect() {
  if (busy || uppy) return;
  busy = true; $('connect').disabled = true;
  try {
    if (!validConfig()) throw Error('Falta configurar Supabase Free en config.local.js.');
    supabase = createClient(cfg.projectUrl, cfg.publishableKey, {
      auth: {persistSession: true, autoRefreshToken: true},
    });
    const {data: {user: existingUser}, error: userError} = await supabase.auth.getUser();
    if (!userError && existingUser) identity = existingUser;
    else {
      const {data, error} = await supabase.auth.signInAnonymously();
      if (error || !data.user) throw Error('No se pudo abrir la sesión anónima de laboratorio.');
      identity = data.user;
    }
    uppy = new Uppy({autoProceed: false, restrictions: {
      maxNumberOfFiles: 2, minNumberOfFiles: 2,
      allowedFileTypes: ['.pdf', 'application/pdf'],
      maxFileSize: cfg.maxBytes,
    }})
      .use(Dashboard, {inline: true, target: '#uploader', height: 330,
        showProgressDetails: true, hideUploadButton: true, proudlyDisplayPoweredByUppy: false})
      .use(Tus, {
        // Host directo y ruta /sign para tokens firmados (documentación oficial).
        endpoint: 'https://'+cfg.projectId+'.storage.supabase.co/storage/v1/upload/resumable/sign',
        headers: {apikey: cfg.publishableKey},
        retryDelays: [0, 1000, 3000, 5000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        limit: 2,
        allowedMetaFields: ['bucketName', 'objectName', 'contentType', 'cacheControl'],
      });
    uppy.on('file-added', file => {
      const pending = signFile(file);
      entries.set(file.id, {pending});
      pending.catch(() => {}); // Se informa el error al pulsar Enviar.
      $('send').disabled = false;
    });
    uppy.on('file-removed', file => entries.delete(file.id));
    uppy.on('upload-error', () => status('Falló una transferencia TUS. No se registra ningún pedido.'));
    status('Sesión de laboratorio activa. Elegí exactamente dos PDF de prueba.');
  } catch (error) {
    status(error.message || 'Error de configuración del laboratorio.');
    $('connect').disabled = false;
  } finally {busy = false;}
}

async function verifyObject(object) {
  const {data: {session}, error} = await supabase.auth.getSession();
  if (error || !session?.access_token) throw Error('No hay sesión válida para comprobar la recepción.');
  const response = await fetch(cfg.projectUrl+'/functions/v1/verify-upload', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer '+session.access_token,
      apikey: cfg.publishableKey,
    },
    body: JSON.stringify({objectName: object.objectName, expectedSha256: object.expectedSha256}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.verified !== true || body.sha256 !== object.expectedSha256 ||
      !Number.isInteger(body.pages) || body.pages < 1 || body.bytes !== object.bytes)
    throw Error('El servidor no confirmó la integridad o las páginas (HTTP '+response.status+').');
  return body;
}

async function send() {
  if (busy || !uppy) return;
  const selected = uppy.getFiles();
  if (selected.length !== 2) { status('Seleccioná exactamente dos PDF para medir una tanda.'); return; }
  busy = true; $('send').disabled = true; $('results').replaceChildren();
  timers.startedAt = performance.now();
  try {
    // Barrera: ambos tokens firmados y SHA listos ANTES de iniciar Uppy.
    const meta = await Promise.all(selected.map(f => entries.get(f.id)?.pending));
    if (meta.some(m => !m?.objectName)) throw Error('Hay un archivo sin autorización privada.');
    timers.uploadStart = performance.now();
    status('Subiendo directamente a Supabase Storage (2 PDF)…');
    const outcome = await uppy.upload();
    timers.uploadEnd = performance.now();
    if (outcome?.failed?.length || outcome?.successful?.length !== 2)
      throw Error('La transferencia no terminó para ambos PDF. No se registró nada.');
    status('Transferencia completa. Verificando SHA y páginas en el servidor…');
    const confirmations = [];
    for (const file of selected) {
      const receipt = await verifyObject(entries.get(file.id).info);
      confirmations.push(receipt);
      resultLine(file.name+': '+receipt.pages+' páginas; '+receipt.bytes+' bytes; SHA-256 verificado.');
    }
    timers.verifiedAt = performance.now();
    const m = {
      archivosVerificados: confirmations.length,
      tiempoDesdeEnviarMs: Math.round(timers.verifiedAt - timers.startedAt),
      subidaMs: Math.round(timers.uploadEnd - timers.uploadStart),
      verificacionMs: Math.round(timers.verifiedAt - timers.uploadEnd),
      servicio: 'Supabase Free LAB',
      pedidoRegistradoD1: false,
      cobros: false,
    };
    $('measurements').textContent = JSON.stringify(m, null, 2);
    $('measurements').hidden = false;
    status('2 de 2 PDF recibidos y verificados en el LABORATORIO. Sin pedido ni cobro.');
  } catch (error) {
    status('Ensayo incompleto: '+(error.message || 'Error no identificado')+'. NO reintentes automáticamente.');
    resultLine('Sin registro D1 y sin pago; inspeccionar antes de otro ensayo.');
  } finally {busy = false; $('send').disabled = false;}
}

$('connect').addEventListener('click', connect);
$('send').addEventListener('click', send);
