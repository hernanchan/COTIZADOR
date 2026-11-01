# Activación automatizada y aislada — Librería Saber
# Exclusivamente Worker saber-documentos-pruebas.
# Pruebas TUS y compilación obligatorias, secrets existentes heredados, 100% del tráfico SOLO al Worker de pruebas.
# Portal privado protegido con HTTP Basic, revertir automáticamente si falla la comprobación HTTP 401.
# Sin cambios a main, web comercial o cobros. Autorización: instrucciones reiteradas del propietario de activar ensayo TUS.
trigger=2026-11-01-tus-private-only

2026-11-01 - Revalidar despliegue exclusivamente privado con preflight SIN SUBIR archivos y codigos de etapa antes de recibir pedidos. Ultimos commits b8d67e71 6f13ef9c 749aa845 04a45a1a c134a908 bf04446e 2b53da19. Ejecucion obligatoria: pruebas integracion, compilacion y rollback si la proteccion privada falla. Sin pagos ni web comercial.

2026-11-01: corregir alcance Basic para llamadas TUS en /prueba-v2/api/ con cookie HttpOnly dedicada al nuevo prefijo; distinguir SESION_PRIVADA vs ORIGEN_SOLICITUD. Ejecución privada, rollback y CI obligatorios. Commits 8106e38b, 22479550, 4d7bf9b4, 9c205071, 80023ef6. No realizar cambios en web pública ni activar cobros.

2026-11-01 — Reintento CI tras identificar en logs run 41314740662 el único fallo: test esperaba AUTORIZACION_PORTAL pero la respuesta correcta ya es SESION_PRIVADA. Prueba ajustada commit d362dfdc. Activación solamente Worker privado con rollback y sitio comercial intacto.

2026-11-01 12:22 ART — Diagnóstico exacto de STORAGE_FIRMA_ERROR para Worker privado: comprobar firma Supabase sin subir PDF, clasificar FETCH_FAILURE / HTTP_NNN / RESPONSE_JSON / TOKEN_MISSING. Nunca registrar tokens ni valores secretos. Código ddd5f523 test 221cd7c0. Compilar, probar y activar solo Worker pruebas con rollback y 401 anónimo.

2026-11-01 12:26 ART — pruebas y activación de firma privada con host directo https://<project>.storage.supabase.co para endpoints de firma y lectura, sin pasar por redireccionamientos del host API. Commits d66122a4 y 6bf2e97d; no se transfieren PDF, pagos ni sitio comercial. Revertir ante prueba HTTP 401 fallida.

2026-11-01 — CAUSA IDENTIFICADA en documentación oficial Cloudflare Workers Request API: redirect:'error' NO es soportado y lanza TypeError ANTES de fetch HTTP, provocando STORAGE_FETCH_FAILURE. Corregidas firma y lectura privada a redirect:'manual', rechazo explícito de 3xx. Código 29339936, tests 49a304a3. Activar SOLO Worker de pruebas, con CI y comprobación HTTP401 anónimo; sin pagos ni sitio público.

01-11-2026, prueba de descarga SOLO PERSONAL: añadir /prueba-v2/personal-descargar con Basic y POST /prueba-v2/api/ensayo-tus-descargar-personal con validación D1 pertenencia y SHA. Central pendiente separada. Ejecutar test central-bridge-d1 y regresión, publicar únicamente Worker documental privado con control HTTP401 y rollback. Commits ee64fca7 9603b392 c3b25caf 81d307e8 03929099 f5a10490.

01-11-2026: activar descarga solo staff con pruebas focalizadas Central en tests/tus-central-staff-download.test.mjs, no cambiar anillados. La suite central-bridge-d1 antigua tiene fixture de anillado que falla previo a esta integración y se auditará aparte; no degradar seguridad. Release Worker DOCUMENTOS privado exclusivamente, con rollback HTTP 401. Commit 5a131500.

2026-11-01 ~13:39 ART — ZIP privado numerado con instrucciones TXT+HTML, PDF originales en orden de ficha, CRC32 ZIP32 y límites de sesión. Worker documental: /prueba-v2/orden-paquete (Basic), POST /prueba-v2/api/ensayo-tus-paquete-manifiesto (Basic, HMAC D1), cada PDF sigue por descarga original D1+SHA. Central ya CI verde 41327349314, número D1 y reporte firmados. CI documental exige tests/tus-zip-orden-privada.test.mjs + tests/tus-paquete-manifiesto.test.mjs. Desplegar SOLO saber-documentos-pruebas con rollback HTTP401. No cobros, no web pública.

Activar Worker documental para exigir numeroOrden D1 al completar pedido TUS y mostrar N.º 001 en confirmación del cliente. PDF/ZIP existentes sin cambios. CI completo con rollback.

2026-11-01 — desplegar en worker DOCUMENTAL privado la validación completa de especificaciones B/N, color, gramaje/papel y grupo de anillado, evitando NO CONSTA cuando cliente eligió opciones. ZIP TXT/HTML muestra selección real; ensayos automatizados con 2 PDFs A4/A3 y A4 color N-up, y legado sin campos. Ejecutar pruebas y rollback sin tocar web pública ni habilitar pagos. Central ya 14/14 OK.

01-11-2026 confirmación de cliente visible: éxito únicamente con registro D1 confirmado y número corto, aviso grande y visible en el portal, scroll a confirmación y número de orden persistente en barra superior. Test VM confirma ausencia de éxito prematuro, número 007. Desplegar únicamente saber-documentos-pruebas, sin pagos ni web pública, con rollback de seguridad.

Reintento corrección visual orden cliente: la suite detectó regex en plantilla HTML que debía escaparse dos veces y expresion de captura en test. Corregidos en commits 0f48843e y c8d7419b. Ejecutar validación CI y SOLO desplegar si pruebas pasan. Web comercial intacta.

Revalidar mensaje definitivo número corto: test heredado esperaba «Orden de trabajo N.º» anterior, ahora el banner dice «Orden N.º», test corregido commit 7474b05b. Mantener despliegue privado y seguridad sin cambios.

2026-11-01 — Reponer pregunta de TAMAÑO REAL cuando PDF no es A4: escaneo 21,75×30,43, A3, A5, A0 y PDF mixtos necesitan elegir explícitamente ajustar A4, A3 o original; 20x20 cm se mantiene en A4. Mantener clasificación CAD/Póster, cotizador y TUS completos sin tocar cobros ni página comercial. Test obligatorio decision-tamano-impresion.test.mjs incorporado a npm run build:unificado. Desplegar solamente Worker documental privado y verificar rollback HTTP401. Commits 06467426 904e5071 5ddfbd29 13d9085b 9da7b087 8d75b67b.
