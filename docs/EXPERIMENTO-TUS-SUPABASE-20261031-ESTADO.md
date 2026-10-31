# Experimento Supabase Free / Uppy TUS — estado 31-10-2026

## Autorización y límites

El usuario autorizó utilizar Supabase Free **exclusivamente en una prueba independiente**. Permanecen congelados el cotizador comercial, Worker privado de Documentos, GAS v10, D1, cobros y Polaroids. No enviar PDF reales de clientes.

Se descubrió la conexión Supabase disponible en ChatGPT y se sugirió su instalación/conexión. **No se ha confirmado la conexión ni creado un proyecto Supabase**. La sugerencia no equivale a tener acceso al servicio.

## Código creado y comprobado

- Rama NUEVA: `experimento/uppy-tus-supabase-20261031`, derivada de `fase1/impresiones-ploteos-20261027`, nunca de `main` comercial.
- Carpeta independiente: `experimentos/recepcion-tus/`, 13 archivos comprobados en GitHub. Incluye HTML y cliente Uppy/TUS, config local excluida de Git, SQL de bucket privado, función Edge de verificación y 2 suites de tests.
- Cliente: 2 PDF en paralelo con Uppy y TUS, fragmentos 6 MiB, endpoint firmado /upload/resumable/sign, ruta aleatoria uid/uuid.pdf, Auth anónima Supabase para laboratorio local, token por archivo vía createSignedUploadUrl.
- Almacenamiento: bucket NO público `saber-tus-lab`, RLS INSERT restringida a carpeta propia de auth.uid(), límite 20 MiB por archivo. No hay política SELECT pública ni getPublicUrl.
- Verificación: función Edge recibe JWT, lo comprueba con auth.getUser, usa service_role SOLO servidor para descargar el objeto exacto de su propietario; comprueba SHA-256, cabecera PDF y páginas reales con pdf-lib. No crea pedidos D1 ni permite pagos.
- Pruebas LOCALES Node: **11 aprobadas, cero fallas**, incluyendo rutas ajenas, hash falso, tamaño/cabecera inválida, páginas inválidas y contrato TUS/privacidad. `node --check client.js` correcto.
- **Importante:** sin internet a npm ni Supabase conectado en runtime, NO se ejecutó Uppy en navegador ni se subió objeto a Storage. Las pruebas son de lógica con Blob simulado, NO equivalen a un E2E. Función Edge TypeScript aún no probada en Supabase real.

## Próxima acción segura

1. Usuario conecta Supabase en ChatGPT desde la sugerencia. No pedir contraseñas, tokens ni service_role por chat.
2. Una vez conexión CONFIRMADA, listar proyectos existentes y crear proyecto NUEVO en plan Free, sin gastos, sin tocar proyectos existentes.
3. Crear bucket privado, Auth Anonymous Sign-ins y RLS solo en laboratorio. Desplegar función verify-upload, configurar CORS local, probar acceso y políticas.
4. Medir una sola subida real de dos PDF SINTÉTICOS, SHA y páginas independientes, reanudación, tiempos y acceso privado. Comparar con 93,5/97,7s del sistema anterior bajo condiciones equivalentes.
5. No exponer públicamente el laboratorio hasta controles de cuotas, antiabuso, retención y revisión de seguridad. Si 2/2 falla, no migrar.

Referencias: `docs/AUDITORIA-BASES-OPEN-SOURCE-20261031.md`, `docs/DIAGNOSTICO-502-LOTE-20261028.md` y rama experimental.