# Etapa 1 — Impresiones, ploteos y anillados

Estado: **en desarrollo y sin autorización de publicación**, 27-10-2026.

## Versión de referencia

- Rama de trabajo: `fase1/impresiones-ploteos-20261027`, creada desde `fix/pdf-extension-private-20261027`.
- Conservar `cotizador-web-v2.html` como cotizador comercial de referencia; **no editar main ni libreriasaber.com.ar**.
- Worker de ensayos: `saber-documentos-pruebas`; no activar pagos ni recepción comercial.
- Polaroids Express queda conservado, fuera del alcance de esta etapa.

## Hallazgos del código

1. `carga-unica-cliente.mjs` cotiza ploteos, pero bloquea explícitamente el envío de trabajos cuyo destino no es `documentos` y el anillado distinto de `ninguno`. **No están integrados a la recepción privada**.
2. El ensayo inteligente está embebido como iframe en `pantalla-cotizador-v2-prueba-privada.mjs`. Además hay un segundo iframe con el cotizador original de comparación. Esta presentación **no es todavía la UX comercial única**.
3. La corrección de la validación de extensión PDF está en el origen, con pruebas de sintaxis y de traspaso al carrito. GitHub Actions `40571610682` concluyó en éxito; **no prueba Drive/D1 en vivo**.
4. `worker-fase4-cotizador-unificado.mjs` contiene rutas privadas para recepción, vinculación, manifiestos, Central y composición, pero su presencia no confirma el circuito real de extremo a extremo. Varias operaciones dependen de interruptores `PRIVATE_TEST_ONLY`.

## Condiciones de salida, en orden obligatorio

- [ ] **Pantalla única:** carga múltiple y arrastre, progreso, precio visible, errores recuperables, sin repetir selección o volver a subir el PDF.
- [ ] **Cotización A4/A3:** B/N, color, simple/doble faz, 2/4/9 páginas por cara, escalas por cantidad y selección de páginas.
- [ ] **Ploteos:** CAD/Póster por página, tamaño y orientación, elección automática de rollo, papel obra/recubierto según clasificación, prueba de archivos mixtos y regla de duda → CAD.
- [ ] **Anillados:** archivos juntos, separados y mixtos; precio y composición del trabajo vinculados al pedido.
- [ ] **Recepción protegida:** PDF real de prueba sin datos de clientes → Google Drive; comparar nombre, bytes, páginas y SHA-256.
- [ ] **Central D1:** mismo ID de pedido, registros persistentes y recuperación administrativa efectiva.
- [ ] **PDF compuesto:** generación y descarga privada, concordancia de páginas, orden y opciones del pedido.
- [ ] **Aceptación móvil y PC:** completar pedido sin intervención técnica y sin errores JavaScript/Turnstile críticos.
- [ ] **Seguridad:** cobros desactivados y ningún cambio en web comercial hasta autorización explícita.

## Metodología de pruebas

- Distinguir: test unitario, integración con dobles, compilación, navegación autenticada y ejecución real Drive/D1.
- No promocionar una versión sólo porque Actions aparece en verde.
- No modificar código minificado desde Cloudflare; corregir fuentes, compilar y promover artefacto identificable con SHA.
- No desplegar a clientes sin las nueve condiciones verificadas con evidencia y autorización.

## Auditoría de contrato de recepción (27-10-2026)

Se confirmó una **incompatibilidad entre cotización y recepción**, no una falta del motor de cálculo:

| Capa | Capacidad observada | Brecha real |
|---|---|---|
| `cotizar-carga-unica.mjs` | cotiza documentos, ploteos y anillados | su resultado es preliminar |
| `carga-unica-cliente.mjs` | genera evento de cola `SABER_SMART_DOCUMENTS_TO_PRIVATE` | rechaza destino distinto de `documentos` y anillado |
| `pantalla-cotizador-v2-prueba-privada.mjs` | recibe PDF y opciones; verifica cabecera y SHA antes de encolar | contrato de opciones limitado a A4/A3, sin clasificación CAD/Póster ni grupos de anillado |
| `fase4-ficha-central-lote-privada.mjs` | consulta recibos privados de Google y revalida archivos | prepara `conectarRecepcionConCentral` con opciones documentales |
| `preparar-manifiesto-v2-documental.mjs` | genera manifiesto sólo con recibos confirmados | formatos `a4/a3`, anillado `ninguno/juntos`; no representa rollo ni clasificación por página |
| `cotizar-nup-recibo-verificado.mjs` | recalcula N-up desde un PDF verificado | N-up sólo en documentos, anillado ninguno |
| `worker-fase4-cotizador-unificado.mjs` | rutas de recepción, verificación y composición | las rutas y compuertas no prueban que un ploteo sea producible |

### Orden técnico de cierre (sin módulos ni pantallas nuevos)

1. **Definir y probar el contrato de trabajo por archivo** con servicio, páginas seleccionadas, destino por página (CAD/Póster), rollo automático y papel Póster cuando corresponda. Los valores del navegador no autorizan precio.
2. **Extender el receptor y la revalidación del servidor** para recomputar tamaño, clasificación, rollo, papel y precio de cada página desde los bytes almacenados.
3. **Integrar anillado** por grupo de archivos en el pedido, validando que el grupo sea consistente; el PDF compuesto deberá conservar el orden e indicar los grupos.
4. **Extender manifiesto y Central** de manera transaccional sin perder el formato documental ya existente; guardar opciones verificadas de producción y total calculado en servidor.
5. **Conectar el único botón de envío** al contrato validado, seguido de pruebas reales Drive/D1/PDF compuesto. Mantener los rechazos actuales hasta que exista soporte verificable.

**Criterio de bloqueo:** no quitar restricciones de UI para ploteos/anillados antes de que el backend pueda aceptar, revalidar y registrar esos casos. Nunca usar el precio del navegador como importe confirmado.

## Avance de enlace de clasificación — commit 3ecbfaeb

- El cliente inteligente transmite un mensaje mismo-origen `SABER_FASE1_PLOTEO_PRELIMINAR` con las dimensiones, CAD/Póster, copias y papel por archivo.
- El portal privado recibe las instrucciones, las valida estructuralmente y muestra cantidad de páginas CAD/Póster.
- **Este mensaje no recibe ni almacena el PDF, no agrega trabajo a la cola y no registra D1.** La transferencia sigue cerrada hasta ampliar el contrato del receptor.
- GitHub Actions `40582571318`: pruebas de frontera, puente preliminar, contrato servidor y regresiones del backend exitosas.
- Próxima tarea no satisfecha: integrar esa información en la recepción comprobada de cada PDF, su recotización oficial, manifiesto y Central D1. Ninguna autorización de publicación implícita.

## Integración privada de ploteos — 27-10-2026

- El cotizador transfiere objetos `File` originales de ploteos junto con su clasificación por página y subtotales numéricos de cada trabajo. Las impresiones enviadas simultáneamente mantienen su subtotal independiente.
- El portal agrega los PDF de ploteos a la cola local (no a la web comercial), calcula su huella SHA-256, y los envía por la recepción protegida existente al pulsar «Enviar todos los PDF del pedido».
- Tras la verificación del recibo de Google, solicita `POST /api/ensayo-cotizar-ploteo-verificado`, que exige autorización privada y verifica origen, sesión, recibo, bytes/huella y dimensiones reales del PDF; el servidor utiliza la clasificación visual del navegador como instrucción y recalcula rollo, papel y tarifa.
- Las cotizaciones verificadas se muestran en el resumen, pero **el registro en D1 y los pagos permanecen bloqueados para ploteos**. No se guarda el archivo original en localStorage ni sessionStorage.
- GitHub Actions `40585879038`: pruebas de regresión, compilación unificada del Worker y sintaxis completadas con éxito.
- Pendiente imprescindible: desplegar únicamente la versión de ensayo privado mediante proceso controlado, comprobar recepción real y reintentos en navegador/Drive, extender el manifiesto/registro D1 a ploteos y anillados, y ensayar el pedido completo antes de cualquier publicación comercial.

## Manifiesto mixto para Central — 27-10-2026

- `prepararManifiestoDocumentalV2` admite ahora un renglón `ploteoVerificado` (cotización privada del servidor) además de los renglones documentales existentes. Verifica identificadores, SHA-256, recibos, páginas, opciones por página, copia y papel, y mantiene el estado sin autorización de pago.
- `pantalla-cotizador-v2-prueba-privada.mjs` puede preparar un pedido mixto con sesiones confirmadas de documentos y ploteos para `/api/ensayo-preparar-documentos-v2-lote`. Un ploteo sin presupuestar o sin verificar mantiene bloqueada la operación.
- `registrar-manifiesto-v2-central.mjs` exige correspondencia de cada renglón de ploteos con la ficha **calculada a partir del PDF verificado en el servidor**, incluidos página, rollo, papel y copias, antes de permitir la operación HMAC de stage.
- Prueba `fase1-ploteo-central-manifiesto.test.mjs`: genera un PDF A0, simula recibo privado firmado/Drive, vuelve a leer los bytes del PDF, calcula CAD, crea la ficha, prepara el manifiesto y lo concilia sin escribir en D1.
- GitHub Actions `40586733737`: batería nueva, compilación del Worker y regresiones anteriores completas **en verde**.
- **No hay prueba real con acceso a Google Drive ni D1, ni despliegue de Cloudflare**: falta verificar la persistencia en el Worker de pruebas antes de publicar. No declarar cerrada la primera etapa con CI solamente.

## Ensayo integrado de tres PDF reales en CI

- Se añadieron pruebas que generan y leen **dos PDF A4 diferentes y un PDF A0 CAD** desde sus bytes, simulan las respuestas autenticadas de Drive y comprueban: SHA-256, páginas, dimensiones, clasificación, precios oficiales, ficha única de tres trabajos y conciliación de manifiesto para la Central.
- Una modificación de los bytes del tercer PDF cancela el pedido entero.
- GitHub Actions `40587938357` **aprobada**; incluye compilación del Worker y regresiones.
- Este ensayo NO equivale a un upload real hacia Google ni una escritura real D1. La prueba real privada sigue siendo requisito obligatorio antes de presentar la etapa.
- Se inspeccionó `.github/workflows/saber-documentos-v2-stage-private.yml`: su versión actual carga un artefacto de Cloudflare sin desplegarlo y apunta a la rama histórica de Polaroids; no promoverlo automáticamente hasta asegurar el flujo de pruebas sin modificar la web vigente.

## Versión Cloudflare preparada — 27-10-2026

- Workflow `.github/workflows/fase1-version-privada.yml` compiló el bundle y volvió a ejecutar las pruebas de PDF antes de cualquier transferencia.
- GitHub Actions: `40590247833`; operación `POST /versions?bindings_inherit=strict` exitosa sobre Worker de ensayo `saber-documentos-pruebas`.
- Cloudflare confirmó versión no desplegada: `18779e7c-05f9-4f33-9fa0-dd2955942492` del commit `2c09e2324c45f481a9b14aae8b7a6f10dff684f3`.
- **No se ejecutó `deployments`, ni modificación de rutas, dominio, Worker activo o pagos**.
- El ensayo real Drive/D1 todavía necesita que esa versión se promueva de manera controlada sólo en el entorno de pruebas, previa comprobación del despliegue activo y estrategia de reversión. Se debe verificar PDF real 2×A4 + 1×A0 sin datos de clientes y borrar registros de ensayo cuando se complete.

## Activación controlada y comprobación de acceso — 27-10-2026

- Se confirmó por API la versión anterior `29d8ee1f-111d-4b3f-bec6-f7ae3a53c1b2` y la versión de pruebas `18779e7c-05f9-4f33-9fa0-dd2955942492`.
- Dos verificaciones iniciales del despliegue fallaron por una expresión de control, activando reversión automática; una inspección independiente confirmó la recuperación de la versión anterior.
- Tras ajustar la validación, GitHub Actions `40590896800` desplegó la versión de etapa 1 **únicamente** en `saber-documentos-pruebas`, comprobando mediante GET que recibe el 100% del tráfico de ese Worker.
- Prueba independiente de acceso `40590988167`: desplegado correcto y `GET /prueba-v2/` sin credenciales devuelve **HTTP 401**, sin exponer pantalla privada.
- No se ejecutaron envíos PDF ni escrituras en Drive/D1 durante esa comprobación. El siguiente criterio de aceptación sigue siendo probar realmente PDF de trabajo con Drive y pedido registrado en D1, con pagos bloqueados.


## ESTADO VIGENTE PARA RETOMAR EN OTRO CHAT — 28-10-2026 (LEER PRIMERO)

**Estado real: BLOQUEADO EN RECEPTOR APPS SCRIPT DE DOCUMENTOS. NO ES ETAPA CERRADA.** Este apartado prevalece sobre los párrafos históricos anteriores que decían que faltaba desplegar el Worker: el Worker privado sí se desplegó después. No repetir investigaciones resueltas.

### Prueba real efectuada y fallo reproducido
- En `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/`, el usuario cargó 3 PDF sintéticos: `ENSAYO_SABER_A4_1.pdf`, `ENSAYO_SABER_A4_2.pdf` y `ENSAYO_SABER_PLANO_A0_CAD.pdf`.
- El cotizador mostró **A0 CAD $7.200 + dos A4 B/N $200 = $7.400**; esto verifica sólo el cálculo preliminar, no entrega.
- En el paso «Enviar todos los PDF», el receptor GAS rechazó **`multiStart` del A0**, por lo que quedaron **0/3 PDF verificados**, precio confirmado por servidor $0 y registro D1 PENDIENTE. No repetir la carga hasta corregir el GAS.
- El Worker originalmente respondía «Google no pudo recibir el PDF o se agotó el cupo» indiscriminadamente. Se cambió la respuesta para exponer etapa/categoría acotada; el reintento mostró `start (código CUPO)`. **Esa categoría procedía de comparar texto de un error genérico GAS; NO significa que el cupo estuviera agotado.**
- Cloudflare recibió corrección de mensajes en versión privada `217912ca-0610-4047-95d8-3e3b0be1d599` con GitHub Actions `40591911250` (éxito). No desplegar Worker nuevamente para solucionar la incompatibilidad GAS.

### Diagnóstico de cupo y CAUSA DEMOSTRADA
- En Apps Script «SABER — RECEPCIÓN DOCUMENTOS» se creó archivo independiente `DiagnosticoCupo.gs` y se ejecutó `diagnosticarCupoDocumentosSaber`. Resultado: **entradas=0, vigentes=0, vencidas=0, sinEstado=0, estadoInvalido=0, indiceLegible=true, posibleCausa=CUPO_DISPONIBLE_BUSCAR_OTRA_CAUSA** para el índice `DOCS_MULTI_INDEX_LOTE_20261024`. No atribuir el problema a 120 sesiones ocupadas.
- Atención: ese diagnóstico consulta el **índice nuevo** `DOCS_MULTI_INDEX_LOTE_20261024`; el código viejo usa `DOCS_MULTI_INDEX_FASE4` y límite 5. Por tanto el 0/120 no confirma el estado del índice antiguo. Lo concluyente es el contrato del receptor antiguo.
- En la captura del **Código.gs real** del Apps Script: `var DOCS_MULTI_CAP=5, DOCS_MULTI_INDEX='DOCS_MULTI_INDEX_FASE4';`; `function docsMultiStart(p)` exige `WEB-ENSAYO-[A-F0-9]{16}`, `fileId === 'documento'`, máximo **1 MiB**, modo B/N o color, sólo 5 archivos. El Worker nuevo envía `WEB-...`, `fileId='pdf-'+sha`, permite hasta 20 MiB/30 PDF y modo de ploteos. **Esta incompatibilidad de contrato causa el rechazo de la operación start**. No son errores de CAD/Póster ni el usuario.
- Se identificó el Apps Script correcto: el Worker `saber-documentos-pruebas`, variable `DOCS_SCRIPT_URL`, apunta a la implementación **«FASE 4 – Carga y presupuesto PDF»**, versión **5 del 21-10-2026**, URL que comienza `https://script.google.com/macros/s/AKfycbwQUipB5Gafy7OwQSK8nfsrl2lvGAqg64n8F3StIiwbfQzELA_puIiCPUFBg11cUjRb5A/exec`.
- **NO modificar** la otra implementación activa «RECEPCION DOCUMENTOS – PRUEBA 1», versión 1 del 19-10-2026, URL que comienza `AKfycbw6jdCy8C_5CyZHHFjL7S2pY0XsSqi-D-XqlFuT82wa0Rr4nsgZ04--Bxbogfji1a5q0A`.
- La carpeta privada de Drive observada como «Librería Saber - Documentos WEB - PRUEBAS» no demuestra que el PDF A0 se haya almacenado. No hay aún entrega real ni pedido D1.

### Corrección preparada pero NO instalada
- En la rama `fase1/impresiones-ploteos-20261027` existe el archivo **`integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`**: receptor separado ampliado, `DOCS_MULTI_CAP=30`, `DOCS_MULTI_GLOBAL_CAP=120`, `DOCS_MAX=20*1024*1024`, 60 MiB/pedido, índice `DOCS_MULTI_INDEX_LOTE_20261024`, HMAC y operaciones multi*.
- Se añadieron diagnóstico acotado `docsReceptionReasonCode`, función `docsMultiCapacityDiagnostico`, test `tests/fase1-gas-cupo-diagnostico.test.mjs` y verificación CI exitosa `40594057398`. **Los cambios del archivo .gs están sólo en GitHub**, NO en el Apps Script publicado; ejecutar tests de GitHub no corrige el receptor activo.
- El archivo auxiliar `DIAGNOSTICO_CUPO_SIN_BORRAR.gs` sólo lee el índice nuevo y fue pegado manualmente en Apps Script como `DiagnosticoCupo.gs` sin implementar; no es la reparación.

### Paso exacto siguiente (no pedir volver a medir cuotas ni buscar las dos URLs)
1. **Preservar copia de seguridad del contenido actual de Código.gs y los IDs de implementación**. Revisar que el archivo ampliado sea compatible con el proyecto GAS real (firmas, funciones, propiedades existentes, Drive, `appsscript.json`); no reemplazar por accidente el proyecto Polaroids ni otro receptor.
2. Instalar el **receptor ampliado**, no únicamente el diagnóstico, en el proyecto «SABER — RECEPCIÓN DOCUMENTOS». **Actualizar SOLAMENTE la implementación existente «FASE 4 – Carga y presupuesto PDF»**, manteniendo su URL/ID (crear nueva versión dentro de esa implementación), sin crear otra URL por error. No publicar nada en `libreriasaber.com.ar`. Tomar precauciones de versión y reversión.
3. Verificar que `DOCS_SCRIPT_URL` del Worker sigue apuntando a esa implementación; probar `multiStart` con los PDF ficticios reales y luego `multiPart`, `multiFinish`, verificación de bytes/páginas y relación de recibos. Consultar estado antes de reintentar si hubo timeout.
4. Comprobar **3/3 PDF verificados**, precios revalidados del servidor y registro **único** de pedido en Central D1 con pagos y producción desactivados. Sin esas pruebas **NO declarar resuelto**. Limpiar sólo los registros de prueba identificados, no todo Drive.
5. Si no se dispone de herramienta conectada que pueda editar/desplegar Apps Script, proporcionar al usuario pasos concretos y **un solo pedido de intervención por vez**. Nunca afirmar que un cambio guardado en GitHub ya está en Apps Script.

### Restricciones estables
- Repositorio `hernanchan/COTIZADOR`, rama de ensayos `fase1/impresiones-ploteos-20261027`; NO tocar `main`, `libreriasaber.com.ar` ni Polaroids, ni activar pagos ni realizar gastos.
- No introducir otro rediseño de interfaz ni volver a empezar; cerrar recepción/cotización/central de documentos A4/A3 + CAD/Póster.
- Usuario ha invertido muchas pruebas; evitar micro-pasos redundantes, falsas confirmaciones, vueltas a diagnósticos descartados y promesas de avance sin despliegue real.
- Este archivo es el **registro persistente primario** para próximos chats; leer esta sección y el último commit antes de actuar. La memoria automática o un prompt resumido NO bastan para recuperar todo.


## Actualización de continuidad — 28-10-2026, ensayo receptor ampliado

- Se preparó una prueba nueva `tests/fase1-receptor-gas-integracion.test.mjs` que **ejecuta las funciones reales del archivo GAS ampliado** dentro de un entorno simulado sin escribir en Drive. Casos: 3 PDF del mismo pedido, dos páginas A4 y plano A0 como trabajos individuales, reintentos idempotentes, conflictos de mismo fileId con distinto SHA, bloqueo de metadatos mal formados, tope 30 archivos por pedido, tope global 120, prohibición de marcar páginas verificadas antes de verificar.
- Workflow GitHub Actions `40673933315` **SUCCESS**: tests GAS, resto de pruebas de recepción y ficha, build completo del Worker y regresiones.
- **No se actualizó el Apps Script real**: sigue siendo la versión 5 de «FASE 4 – Carga y presupuesto PDF», contrato antiguo (5 PDF de 1 MB/identificador `documento`). La corrección ampliada está en `integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`.
- El siguiente paso es **preservar copia de `Código.gs` y reemplazar su contenido únicamente en el proyecto receptor de documentos**, guardar y luego actualizar la implementación existente «FASE 4 – Carga y presupuesto PDF» creando una versión nueva dentro de ella (sin cambiar la URL que utiliza Worker). No modificar ninguna implementación de Polaroids o la web pública. La intervención en Apps Script debe hacerse con cuenta del propietario; no hay un conector disponible para efectuarla directamente.
- Solo después del despliegue, la prueba real de 3 archivos / recepción Drive / D1 autoriza declarar arreglada esta falla. No confundir CI con despliegue ni prueba real.


## HITO CONFIRMADO — 28-10-2026: Apps Script receptor ampliado actualizado a versión 6

- El usuario reemplazó el contenido de `Código.gs` en el proyecto «SABER — RECEPCIÓN DOCUMENTOS» con el receptor ampliado preparado en GitHub y actualizó **la implementación existente** «FASE 4 – Carga y presupuesto PDF», sin crear otra implementación.
- La captura del administrador de implementaciones muestra literalmente **«La implementación se ha actualizado correctamente»**, **«Versión 6 del 28 oct 2026, 7:48»** y el mismo ID de implementación que antes comienza con `AKfycbwQUipB5Gafy7OwQSK8nfsrl2lvGAqg64n8F3StIiwbfQzELA_puIiCPUFBg11cUjRb5A`. Eso confirma despliegue del proyecto GAS, pero **no demuestra todavía recepción PDF funcional**.
- **Siguiente paso inmediato:** probar carga real desde pantalla privada del Worker `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/`, inicialmente con un PDF sintético pequeño y luego lote A4/A4/A0; observar respuesta del GAS y confirmar recibo/páginas/Drive antes de intentar registrar D1.
- Si el usuario conservó la pestaña antigua con los archivos cargados, puede necesitar volver a iniciar el ensayo porque sesión/Turnstile expiran. Evitar afirmar que los 3 PDF ya están en Drive o en Central.
- No tocar `main`, producción pública, pagos ni Polaroids. Mantener los reportes diferenciados: GAS desplegado / subida real no verificada / D1 no verificado.


## HITO — 28-10-2026: primera recepción real verificada + observación UX

- El usuario proporcionó dos capturas del ensayo privado tras activar GAS versión 6. Se ve un único PDF sintético **`ENSAYO_SABER_A4_2.pdf`**, cotización preliminar **$100** y estado **«PDF recibido y verificado · 1 páginas · recibo DOC-... Presupuesto del servidor: $100»**.
- El resumen muestra **«1 de 1 PDF verificados»**, `Cotización del servidor: $100`, botón `Registrar pedido de prueba en la Central` habilitado, **«Registro en Central D1: PENDIENTE»** y pagos/producción desactivados. **Esto confirma la primera carga y recibo real en el flujo de ensayo**; no confundirlo con registro D1, que todavía no fue ejecutado ni confirmado.
- Usuario reportó problema UX: **interfaz larguísima aun con un solo PDF**, grave para cargas múltiples. Se debe dar prioridad a una sola pantalla compacta con documentos en filas, opciones colapsadas, resumen y CTA visibles; sin doble scroll, reiteración de textos ni pérdida de funcionalidad.
- Se implementó en GitHub **cambio incremental de compactación** en `pantalla-cotizador-v2-prueba-privada.mjs` (commit `b7337e7341e6a48451f9402bc5c2d324e7d12649`): espacios menores, mensajes y resumen más breves; no se cambió recepción ni lógica D1. GitHub Actions `40675933183` **SUCCESS**. **Aún NO desplegado**: el usuario seguirá viendo la versión larga hasta su instalación. La compactación integral del iframe/carga para 30 PDF sigue pendiente.
- **SIGUIENTE PASO OPERATIVO PRIORITARIO:** sin recargar la página que muestra 1/1 PDF verificados, presionar `Registrar pedido de prueba en la Central` y verificar resultado exacto D1 (sin cobro). Si falla, diagnosticar según el texto de error en esa misma página. Después ensayar 3 PDF A4+A4+A0 y registrar como un solo pedido. No desplegar cambios de interfaz antes de concluir esta prueba en curso, para no perder el File/sesión/Turnstile en memoria.


## HITO — 28-10-2026: 1 PDF validado, registro D1 rechazó autorización; corrección publicada en Worker privado

- Captura de ensayo: `ENSAYO_SABER_A4_2.pdf` sigue **1/1 recibido y verificado**, cotización preliminar servidor $100, botón para registrar habilitado. Tras pulsar registrar, texto **«Pedido NO confirmado: Autorización requerida. No se autorizó ningún cobro.»**. **No afirmar que ya se registró D1**.
- Causa identificada en `worker-fase4-cotizador-unificado.mjs`: `apiPrepararDocumentosV2Lote` aceptaba `Authorization: Bearer <admin>` o `Basic` pero el `fetch` del navegador en la misma página podía omitir la cabecera Basic pese a haber iniciado sesión para GET, provocando HTTP 401 antes del registro. No es un error de recepción Drive ni prueba de problema D1.
- Solución implementada: una cookie de sesión temporal **HMAC-SHA256** creada sólo al acceder a `GET /prueba-v2/` con credenciales Basic válidas, marcada `Secure; HttpOnly; SameSite=Strict`, con `Path=/api/ensayo-preparar-documentos-v2-lote` y caducidad de 30 minutos. En POST se conserva Bearer/Basic o se verifica la cookie; sin poner claves en JavaScript, sin permitir cookies falsas/caducadas y sin desactivar controles de pago.
- Tests añadidos `tests/fase1-auth-sesion-privada.test.mjs`: cookie válida, falsificada, vencida, distinta clave, flag apagado y validación del punto de entrada. Workflow `40677878637` **SUCCESS**, más compilación/regresiones.
- Cloudflare: versión `9597827e-bc43-4a13-a5c6-e34cabf9f9ec` preparada y activada **únicamente en `saber-documentos-pruebas`**, workflow `40678012860` **SUCCESS**; versión anterior de reversión `217912ca-0610-4047-95d8-3e3b0be1d599`. También incluye primera compactación de la interfaz, en esta nueva versión.
- **Siguiente acción sin perder 1/1 PDF verificados**: dejar ABIERTA la pestaña original donde figura el PDF verificado; abrir `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/` **en una pestaña NUEVA** (Basic login en una navegación GET hace que el navegador reciba cookie segura). Volver a pestaña ORIGINAL **sin recargarla** y pulsar `Registrar pedido de prueba en la Central` nuevamente. La cookie será enviada por el navegador al POST de la pestaña original. Leer mensaje exacto: sólo si se confirma D1, registrar éxito. Si falla con error distinto, investigar siguiente guardia y no repetir la recepción del PDF.
- Aún no se ha ejecutado prueba 3 PDF juntos + D1. Mantener pagos, web comercial, Polaroids sin cambios.


## HITO — 28-10-2026: primer pedido REAL registrado en D1 y botón único

- Captura del usuario del portal privado: **«Pedido de ensayo registrado y comprobado»**, ID D1/comercial `7c7f83a3-df83-42b4-8359-29c09045807d`, 1 PDF, total verificado servidor **$100**, pagos/producción desactivados. El PDF era `ENSAYO_SABER_A4_2.pdf`. **Primer recorrido real PDF → GAS/Drive → verificación/cotización servidor → Central D1 CONFIRMADO**; no se afirmó cobro.
- El usuario exigió UX de **un botón**: antes debía pulsar «Agregar PDF al envío privado», luego «Enviar todos los PDF» y por último «Registrar ... en la Central». Inaceptable para clientes, especialmente con muchos PDF.
- Se implementó flujo de **una sola acción «Enviar mi pedido»** en la rama, sin cambiar backend de verificación: el portal solicita por canal postMessage mismo-origen al iframe inteligente preparar los PDF (ya no se muestra el botón «Agregar PDF...»), espera recibir archivos y su SHA, transfiere cada PDF con Turnstile y reintentos idempotentes, y cuando todos están verificados llama automáticamente al registro D1. No registra si falta un archivo, falla verificación o faltan opciones. Si falla el registro, permite reintento sin reenviar PDF verificados. Mantiene oculto el botón interno de D1, que ya no es acción del cliente.
- Cambios principales: `carga-unica-cliente.mjs` (puente `SABER_SMART_PREPARAR_ENVIO` → `SABER_SMART_HANDOFF_READY/ERROR`); `pantalla-cotizador-v2-prueba-privada.mjs` (orquestación de envío y D1). Pruebas: `tests/fase1-envio-unico-interfaz.test.mjs`, regresión `carga-unica-pdf-regresion.test.mjs` adaptada para el nuevo protocolo de confirmación y errores.
- CI integral **`40679438702` SUCCESS**; staging Cloudflare privado **`40679494835` SUCCESS**; nueva versión privada `47db765e-3895-43b5-a97f-0aef3179e064` **activada** por workflow `40679624567` **SUCCESS**; reversión `daf02e20-82e5-4c69-857e-7d44f1004319`. No se tocó `libreriasaber.com.ar`, `main` ni cobros.
- **Pendiente de aceptación funcional de la UX nueva:** el usuario debe abrir una pestaña nueva del mismo ensayo privado, cargar inicialmente 1 PDF (luego lote de A4+A4+A0), comprobar que SOLO «Enviar mi pedido» complete de principio a fin sin otro botón y que D1 dé confirmación final. La prueba automatizada NO reemplaza el recorrido de navegador real. El flujo anterior de 3 botones ya fue reemplazado sólo en el Worker privado.
- **Mejora adicional de UX registrada:** pantalla continúa verticalmente larga, aun con CSS compacto; queda pendiente rediseño de resumen y filas compactas sin scroll doble, preservando un único botón y transparencia sobre precio verificado.


## HITO — 28-10-2026: pruebas de 12 páginas, formato y anillado

- Captura del usuario con PDF `poliza_1145046.pdf` de **12 páginas**, dimensiones originales **21,75 × 30,43 cm**, opciones A4, B/N, doble faz y **anillado individual**; cotización preliminar **$3.290**.
- Se identificaron tres fricciones reportadas: (1) anillado cotizado pero **no aceptado** por recepción/registro privado, (2) percepción de varios pasos pese al botón único (ajuste de opciones y CTA), (3) tamaño distinto de A4 difícil de detectar, requería abrir «Editar» para seleccionar A4.
- **Mejora implementada y activada en Worker de pruebas**: `carga-unica-cliente.mjs` admite sugerencia automática A4 para documentos próximos al tamaño A4 (tolerancia de 1 cm por dimensión, p.ej. 21,75 × 30,43); muestra botones visibles `A4 / A3 / Tamaño original` por fila sin abrir editor. La salida a A4 continúa ajustando proporcionalmente sin recortar; no reinterpretar esta tolerancia como habilitación de A3 ni de ploteos. `worker-fase4-cotizador-unificado.mjs` añade estilo de botones.
- **Anillado:** se corrigió el engaño UX: `SABER_SMART_PRICE_STATE` envía `sendable:false` y mensaje explícito cuando haya cualquier `anillado !== 'ninguno'`. El botón de envío queda deshabilitado en vez de iniciar un recorrido que terminará en error. **NO está resuelta la integración funcional de anillado en Drive/D1**, por lo que la cotización de $3.290 NO significa pedido aceptado. No eliminar el anillado elegido ni registrarlo silenciosamente como «sin anillado». **Pendiente prioritario**: implementar servidor de anillado por archivo y grupos con precio por hojas y manifest/central preservando la elección del cliente.
- El botón unificado `Enviar mi pedido` sigue siendo una sola acción después de revisar opciones, recibe/verifica/registro D1 en secuencia. Sigue pendiente el ensayo real con PDF **sin anillado** para confirmar el flujo de un botón y el caso completo A4+A4+A0. No declarar que es una venta real.
- CI `40684506022` **SUCCESS**, staging `40684571784` **SUCCESS**, versión `10b2a632-82c7-4845-a2aa-c8a966a22825` desplegada sólo en `saber-documentos-pruebas` (workflow `40684674009` **SUCCESS**), rollback `47db765e-3895-43b5-a97f-0aef3179e064`. No tocar producción pública, cobros o Polaroids.
- **Siguiente paso**: probar en nueva pestaña con el mismo PDF `poliza_1145046.pdf`: comprobar A4 preseleccionado, botones A4/A3/original visibles y aviso de anillado; continuar integración REAL de anillados sin introducir etapa de envío separada. Para validar recorrido de un botón mientras tanto, sólo PDF sin anillado.


## HITO — 28-10-2026: anillado individual integrado en Worker privado, grupos pendientes

- Se avanzó con el **anillado individual** sin reutilizar un importe enviado por el navegador. Las tarifas de `precios-web.json` del repositorio tienen actualmente A4 `≤100 hojas $2330`, `≤200 $2580`, `≤350 $3800`; tomar este catálogo del backend como autoridad para el ensayo, no los importes históricos de otros cotizadores. Se confirmó mediante pruebas que 12 páginas doble faz son 6 hojas físicas y que un grupo de PDF de 12+8 páginas doble faz requiere un armado de 10 hojas. **Estas cifras son del catálogo versionado de pruebas, no una cotización comercial confirmada**.
- El motor `cotizar-documentos-individuales.mjs` ya cotizaba por PDF y por grupo. Se añadieron pruebas `tests/fase1-anillado-precios-servidor.test.mjs` contra catálogo real: hojas físicas, tarifa, grupos válidos, exceso de 350 hojas e incompatibilidades.
- Se añadió conciliación obligatoria del **anillado elegido vs. la ficha recomputada por servidor** en `registrar-manifiesto-v2-central.mjs`: formato, caras, copias, modalidad `ninguno/individual/grupo`, membresía de grupo y rechazo de grupos de un solo archivo o con archivos ausentes. Pruebas `tests/fase1-anillado-conciliacion.test.mjs`.
- `preparar-manifiesto-v2-documental.mjs` transporta explícitamente modalidad y grupo cuando corresponde; el navegador no controla el importe final ni elimina la opción en silencio.
- **Camino individual** conectado en `carga-unica-cliente.mjs` (handoff incluye `anillado`, permite `individual`, bloquea `grupo`), `pantalla-cotizador-v2-prueba-privada.mjs` (no fuerza `ninguno`, presenta individual, admite anillado en registro y pasa modalidad al backend), `subir-vincular-pdf-v2-privado.mjs` (valida la modalidad), `worker-fase4-cotizador-unificado.mjs` (precio documental individual por recibo verificado; mantiene equivalencia `individual` a modo de anillado del cotizador de un solo PDF), `cotizar-nup-recibo-verificado.mjs` (individual más composición 2/4/9-up).
- **Validación automática integral APROBADA:** GitHub Actions `40687113762`; stage Cloudflare `40687202719` versión `32b71329-7495-4849-aa0f-56c61c112def`; activación Worker **sólo privado** `40687299422` **SUCCESS**, rollback `10b2a632-82c7-4845-a2aa-c8a966a22825`. No se cambió `main`, web comercial, cobros o Polaroids.
- **ESTADO ACTUAL:** código para anillado individual desplegado en **ensayo privado**; **todavía NO probado con una recepción real de PDF anillado y registro D1**. NO declarar cerrado hasta obtener confirmación de `1/1 PDF` y pedido D1 con el importe y la operación de anillado. En particular, probar el PDF `poliza_1145046.pdf` de 12 páginas, A4, B/N, doble faz, anillado individual, y asegurar que respeta el importe del servidor.
- **Anillado conjunto de varios PDF:** sigue bloqueado en el botón único. No habilitar hasta verificar cálculo de grupo completo, transporte de cada sesión y validación de membresía, descuento/grupo y ficha técnica de armado. El test automatizado valida contrato y precio del grupo, pero **la interfaz/recepción todavía NO lo registra**.
- **Siguiente paso inmediato:** test real del anillado individual con un PDF desde una pestaña nueva del Worker privado y botón único `Enviar mi pedido`. Si todo funciona, implementar el transporte del grupo completo de varios PDF con una sola operación y sin duplicaciones. Seguir trabajando sobre la interfaz compacta sin perder el registro ni los precios.


## Continuidad — 28-10-2026: mejora de botón único pendiente de ACTIVACIÓN

- Después del ensayo real de `poliza_1145046.pdf` (12 páginas), el usuario reiteró que seguía encontrando varias acciones/etapas antes de completar el pedido; la captura mostró **1/1 PDF verificado**, presupuesto servidor **$1008**, estado «Registrando pedido…». La captura NO confirma que el anillado estuviera seleccionado ni que se registrara D1 al final de ese ensayo.
- Se corrigió un aviso erróneo: `carga-unica-cliente.mjs` ya **no presenta el bloqueo de anillado conjunto cuando sólo se eligió anillado individual**; cambio `0f7c679e`.
- Se reubicó el **único botón `Enviar mi pedido` junto al precio**, en una barra superior sticky; se eliminó el botón del panel inferior y se renombró la sección técnica como «Detalles de la recepción y verificación»; cambio `1a82725b`.
- GitHub Actions **`40688885256` SUCCESS**, compila y pasa regresiones. **ESTO SIGUE SOLO EN LA RAMA GITHUB**. No hay ejecución posterior de staging ni activación de Cloudflare: el último intento de staging quedó bloqueado por los controles de la herramienta. La última versión privada activada verificable permanece **`32b71329-7495-4849-aa0f-56c61c112def`**, workflow **`40687299422`**. No afirmar que la barra sticky ya esté visible en el Worker.
- **Siguiente paso al retomar:** efectuar actualización autorizada del Worker privado `saber-documentos-pruebas` con la versión probada, SIN tocar `libreriasaber.com.ar`, pagos, `main` ni Polaroids. Si la herramienta de activación vuelve a bloquearse, no evadir su control; solicitar un canal autorizado/acción manual concreta. Luego probar en una pestaña nueva el botón único visible + presupuesto con anillado individual explícitamente seleccionado, y confirmar D1 final.
- Pendientes previos: anillado conjunto de varios PDF, experiencia compacta sin doble scroll, prueba A4+A4+A0. Mantener decisiones y resultados ya documentados, sin reiniciar diagnósticos.


## Bloqueo de automatización y salida segura — 28-10-2026

- Se confirmó que `.github/workflows/fase1-version-privada.yml` **existe en la rama de pruebas** `fase1/impresiones-ploteos-20261027`, con disparadores `push` limitado a cambios en el propio YAML y `workflow_dispatch`. **No existe en `main`**, por lo que GitHub no muestra necesariamente «Run workflow» en su página estándar; la captura del usuario confirma ausencia de ese control.
- Las herramientas de GitHub conectadas aquí pueden consultar archivos/runs y editar código, pero **no exponen `workflow_dispatch`**. Un intento anterior de modificar el workflow para disparar una nueva preparación fue bloqueado por controles de seguridad: **no reemplazarlo por mecanismos para eludir ese bloqueo**.
- **No activar `main` como alternativa**. No hacer `pull request` que incluya el código integral para conseguir un botón, ni instalar una automatización que despliegue el Worker privado en cada push sin una revisión explícita.
- **Entregable disponible:** último código de interfaz `1a82725b`, con botón único junto a precio y sección inferior técnica, **CI `40688885256` SUCCESS**; **no existe todavía versión staged/activada para esta corrección**. Último Worker de pruebas confirmado: `32b71329-7495-4849-aa0f-56c61c112def`.
- **Para activar cuando haya un canal autorizado:** primero preparar una nueva versión del Worker con `fase1-version-privada.yml` (staging sin publicar), recoger su ID de versión de su log; luego activar exclusivamente esa versión en `saber-documentos-pruebas`, confirmando versión previa y resguardando rollback; verificar que la URL privada muestra exactamente **un botón `Enviar mi pedido` en el encabezado de precio**. Sin cambios en producción, pagos o Polaroids.
- Si el usuario dispone de GitHub CLI ya autenticado en Windows, una operación manual explícita de despacho (no realizada por el asistente) sería `gh workflow run fase1-version-privada.yml --ref fase1/impresiones-ploteos-20261027 -R hernanchan/COTIZADOR`. Solo usarla si el workflow es despachable mediante la API para esa configuración, y sin afirmar éxito hasta ver la ejecución. Alternativamente, habilitar un flujo de revisión/presentación de workflows en `main` **únicamente después de autorización expresa**.
- **Pendiente inmediato:** no pedir más ensayos de usuario hasta que la interfaz unificada esté realmente activa. Conserva las diferencias entre código probado, versión cargada y despliegue confirmado.


## Actualización 28-10-2026: automatización manual disponible desde main

- Con **autorización explícita del usuario**, se creó **solamente** `.github/workflows/saber-preparar-version-privada.yml` en `main`, commit `9a18d1ccd8c2b70c184d772c8bcafabdf7e2c15f`, sin fusionar código del cotizador ni modificar el sitio comercial. Confirmado mediante lectura del archivo en `main`.
- El nuevo workflow usa **`workflow_dispatch` manual únicamente**, con ejecución restringida a `refs/heads/main`. Hace checkout **explícito** de `fase1/impresiones-ploteos-20261027`, corre pruebas y compilación, y prepara una versión **SIN activar** en `saber-documentos-pruebas` con herencia estricta de bindings. No hay actualización de rutas, dominio comercial o pagos.
- URL directa: `https://github.com/hernanchan/COTIZADOR/actions/workflows/saber-preparar-version-privada.yml`. Al pulsar **Run workflow**, seleccionar rama **main** (porque el workflow vive allí; el código que toma es el de la rama de pruebas). No confundir este selector con la rama del código: esta última está fijada en el checkout.
- **PENDIENTE**: ejecutar la automatización, confirmar ejecución verde y recoger `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR` en su log; después activar **sólo** esa versión privada con verificación de versión previa/rollback, operación independiente que aún no está realizada. No declarar publicada la barra sticky con `Enviar mi pedido` hasta verificarlo en navegador.


## 28-10-2026: nueva preparación privada CONFIRMADA — NO activada

- El usuario lanzó el workflow manual instalado en `main`: run `40702668153` («Saber - preparar versión privada desde rama de pruebas»).
- Consultado el job `122866369983`: **SUCCESS**, incluido checkout de la rama `fase1/impresiones-ploteos-20261027`, validación, build y upload de versión sin activar.
- Log de GitHub confirma **`VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR=070ba91d-4468-4953-a9d3-45d2659b6d0c`** y `SIN_DESPLIEGUE_SIN_PAGOS_SIN_CAMBIOS_EN_WEB_COMERCIAL`.
- **Estado real:** código con un único botón sticky junto al total, más aclaración de anillado individual, está en una versión staged de Cloudflare. El Worker privado activo sigue en la versión previa hasta una **activación independiente y verificada**. No pedir cargar archivos nuevos antes de activarla.
- **Siguiente paso:** desde un canal autorizado, activar exclusivamente `070ba91d-4468-4953-a9d3-45d2659b6d0c` en `saber-documentos-pruebas`, con rollback a `32b71329-7495-4849-aa0f-56c61c112def`. Verificar deployment en Cloudflare y luego una nueva navegación privada que muestre `Enviar mi pedido` junto al total; comprobar el pedido real y que anillado individual no se elimine.


## 28-10-2026: versión privada unificada ACTIVADA — falta ensayo visual y funcional

- El usuario confirmó mediante **captura del panel Cloudflare → Workers & Pages → saber-documentos-pruebas → Implementaciones** que la implementación activa cambió a **`070ba91d`** (ID completo `070ba91d-4468-4953-a9d3-45d2659b6d0c`), desplegada recientemente. En el historial `070ba91d` aparece como implementación vigente; versión anterior `32b71329` permanece disponible para reversión.
- Esta versión fue preparada por workflow manual `40702668153` (**SUCCESS**), que compiló desde `fase1/impresiones-ploteos-20261027`; incluye el **botón único «Enviar mi pedido» junto al precio** y texto corregido de anillado individual.
- **Diferenciar despliegue y aceptación**: el despliegue privado está confirmado por la captura, pero NO hay todavía prueba visual en navegador de la nueva barra sticky ni prueba real de envío anillado individual con registro final D1. No afirmar esas pruebas como realizadas.
- **Próximo paso exacto:** abrir `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/` en nueva pestaña, confirmar visualmente «Enviar mi pedido» junto al total. Después probar 1 PDF A4 (12 páginas) con opción de anillado individual explícitamente marcada, cotejar precio preliminar vs. precio servidor, verificar recepción original y registro D1 final; finalmente ensayo conjunto A4 + A4 + A0. No tocar `main`, producción comercial, cobros ni Polaroids.


## 28-10-2026 — Diseño integral de experiencia de cliente definido, SIN cambio de producto

- Después de la prueba real de `poliza_1145046.pdf` (A4 12 páginas B/N doble faz, anillado individual, $3.290 preliminar, «Pedido registrado» en pantalla), el usuario registró problemas de **demora percibida**, **secciones minimizadas que se despliegan al enviar** y riesgo de añadir una pantalla de pagos a una UX extensa. No hay aún métricas desglosadas por etapa.
- Se acordó una dirección de producto: **no preguntar primero al cliente si sus PDF son A4, A3 o planos**, porque la detección automática ya existe. Permitir arrastrar todos los PDF mezclados, agrupación automática, opciones comunes por grupo y excepciones por archivo. Única acción principal, progreso en zona fija, sin paneles técnicos que se abran al enviar. Checkout total futuro debe incorporarse sin sumar pantallas caóticas.
- Se creó contrato UX de referencia **`docs/UX-CIRCUITO-UNICO-CLIENTE-V1.md`** (commit `01d914b1da89f8e5333139c2302b4d77a70937fa`): reglas, estados, anillados, rendimientos a instrumentar, aceptación para A4/A3/CAD/Póster, experiencia móvil, reintentos y futura integración segura de Mercado Pago.
- **Esto es diseño/documentación, NO una nueva versión instalada ni funcionalidad implementada.** La rama privada conserva versión Cloudflare `070ba91d-4468-4953-a9d3-45d2659b6d0c`; no tocar producción pública ni habilitar cobros.
- **Siguiente paso concreto:** tomar métricas de latencia del circuito actual (lectura local, análisis, envío, verificación Drive, validación servidor, D1) en 1 PDF y 3 PDF; realizar implementación de UI compacta en rama privada reutilizando lo que funciona; probar antes de activar. No reiniciar pruebas antiguas resueltas ni introducir otro flujo de tres botones.


## 28-10-2026: instrumentación segura + freno a expansión de paneles, VALIDADA en CI, NO desplegada

- Decisión anterior registrada en `docs/UX-CIRCUITO-UNICO-CLIENTE-V1.md`: mejorar UX sin romper motor ni pagos. Tras autorización «BUENO», se intervino solo el archivo privado `integraciones/autocotizador/recepcion/pantalla-cotizador-v2-prueba-privada.mjs` (commit `a8a694917ed290ba88fd78511a71888e5227861b`).
- **Causa concreta del despliegue inesperado:** dos manejadores de `SABER_FASE1_PLOTEO_PRELIMINAR` y `SABER_SMART_DOCUMENTS_TO_PRIVATE` contenían `document.getElementById('recepcion-avanzada').open=true;`. Se retiraron. El panel queda cerrado por defecto; no se abre al preparar el envío.
- El widget Cloudflare Turnstile salió del acordeón oculto y ahora ocupa una zona fija y visible bajo el encabezado para evitar esperas no explicadas por una comprobación inaccesible. Un solo widget, un único CTA real.
- Se corrigieron textos obsoletos que decían «Enviar todos los PDF» y afirmaban falsamente que D1 seguía bloqueada en ploteos; se indica «Enviar mi pedido».
- **Medición de rendimiento local sin exponer datos privados:** `performance.now()` mide tiempo entre clic y resultado; preparación desde iframe; fases de cada PDF emitidas por recepción (inicio, reanudación, estado, transferencia, verificación y confirmación); tramo de registro D1; duración aproximada del estado `calculando`→`listo`. Resultado `window.__saberRendimientoPrivado` únicamente en la pestaña, y `console.table` solo con query `?diagnostico=1`. NO registra nombres, hashes, tokens, sesiones ni importes; no transmite logs ni cambia servidor.
- Test actualizado `tests/fase1-envio-unico-interfaz.test.mjs` (commit `5c8fcce4400c1b4a696339707cec5fe1f8111e7f`) comprueba un widget visible, ausencia de apertura automática, mediciones en memoria, D1 y envío único.
- **Evidencia GitHub Actions**: ejecución `40712336636`, workflow «Fase 1 - validar contrato servidor sin desplegar», **SUCCESS**; job `122900639162`; **48 tests passed / 0 failed**, nuevo test «los detalles técnicos quedan cerrados…» `ok 26`, «los tiempos quedan solo en memoria local…» `ok 27`; compilación Worker exitosa.
- **ESTADO REAL**: correcciones en Github únicamente, **NO desplegadas**. El Worker de pruebas activo permanece `070ba91d-4468-4953-a9d3-45d2659b6d0c`. No tocar `main` ni sitio comercial, cobros o Polaroids.
- **SIGUIENTE PASO**: preparar una nueva versión SIN activar con workflow manual `.github/workflows/saber-preparar-version-privada.yml` en `main` (se compila automáticamente desde rama privada), obtener UUID de versión, activarla **únicamente en `saber-documentos-pruebas`**, confirmar ausencia de expansión de paneles con un PDF A4 y obtener fases mediante `?diagnostico=1` / `window.__saberRendimientoPrivado`. No afirmar reducción de latencia sin ensayo cronómetro. Después optimizar el cuello de botella real y pasar a compactar agrupación A4/A3/CAD/Póster, sin reescribir cotizador probado.


## 28-10-2026: versión instrumentada preparada y aún NO activada

- El usuario lanzó manualmente desde `main` el workflow `.github/workflows/saber-preparar-version-privada.yml`, GitHub run **`40713306146`**.
- Verificado desde GitHub: job `122904122017` **completed/success**, incluidos tests, compilación y preparación aislada en Cloudflare.
- Log exacto: `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR=2c1db455-4ac5-4f02-9ebd-c4e581f7283d`; confirma `SIN_DESPLIEGUE_SIN_PAGOS_SIN_CAMBIOS_EN_WEB_COMERCIAL`.
- Incluye los cambios GitHub previos de diagnóstico de tiempos y evitar apertura automática de panel técnico, con regresión CI exitosa (run `40712336636`, 48/48).
- **Estado:** staged `2c1db455` NO desplegada. Activa anterior `070ba91d-4468-4953-a9d3-45d2659b6d0c`; conservar para posible reversión. Sin pagos, sin cambios en sitio público, sin modificar `main`.
- **Siguiente paso exacto:** en Cloudflare → Worker `saber-documentos-pruebas` → Implementaciones, promocionar la fila `2c1db455` al 100% **únicamente en Worker de pruebas** y verificar pantalla de confirmación/versión activa. Luego prueba de `poliza_1145046.pdf` sin expandir detalles técnicos y medición local `?diagnostico=1` con fases desde `window.__saberRendimientoPrivado`; registrar tiempos observados sin especular mejoras.


## 28-10-2026: medición REAL en navegador, PDF de 12 páginas — cuello de botella CONFIRMADO

**Evidencia:** captura del usuario de DevTools Console en `https://saber-documentos-pruebas.libreriasaber.workers.dev/prueba-v2/?diagnostico=1`. Pantalla «Pedido registrado», 1 PDF `poliza_1145046.pdf`, 12 páginas, A4, B/N, doble faz, anillado individual, total preliminar $3.290, pago desactivado; widget Turnstile `¡Operación exitosa!`. Se observa panel de recepción privado sin desplegar. Version privada `2c1db455-4ac5-4f02-9ebd-c4e581f7283d` preparada previamente y promovida por usuario para esa prueba; la captura no muestra directamente el ID de versión activo de Cloudflare y no es prueba D1 directa, solo estado de la UI.

**Marcas temporales del objeto local `window.__saberRendimientoPrivado.eventos` (ms desde click):**
- `clic_enviar` 0;
- `preparacion_inicio` 0;
- `preparacion_terminada` 104;
- `pdf_inicio` 104;
- `pdf_inicio` (fase upload) 109;
- `pdf_estado` 6354 (start + consulta de estado GAS);
- `pdf_transferencia` 10517 (3 bloques totales; callback visible al último bloque);
- `pdf_verificacion` 22229 (recibo `finish` de GAS completo);
- `pdf_confirmado` 42605 (consulta/verificación-vinculación adicional del Worker/Google);
- `central_inicio` 42607;
- `central_fin` 62081;
- `fin` `pedido_registrado` 62081.

**Totales y subtramos (aproximados):** preparación 0,104 s, upload+verificación+cotización del PDF ~42,5 s, registro/revalidación en Central ~19,47 s, total **62,081 s**. La validación posterior a `finish` entre 22,229 y 42,605 tarda ~20,376 s. El `finish` tras último callback de transferencia, entre 10,517 y 22,229, tarda ~11,712 s. Primera consulta `start`+`status` 6,245 s. **El análisis inicial en el navegador NO es el principal cuello de botella en esta prueba.** Falta medir tiempos backend internos para atribuir qué servicio consume cada tramo.

**Inspección de código que explica las fases, sin inferir mediciones no disponibles:**
- `subir-vincular-pdf-v2-privado.mjs`: 3 bloques de 512 KiB enviados a `/api/ensayo-pdf-ampliado` de manera secuencial; `start`, `status`, tres `part`, `finish`, seguido de `/api/ensayo-vincular-pdf-v2`. Cada RPC a GAS es POST HMAC firmado vía Worker.
- `worker-fase4-cotizador-unificado.mjs` (`v2VincularPdf`): `fase4PrivateVerified` consulta `multiVerifiedStatus`, `multiInfo`, lee desde Drive por `multiReadPart` si es necesario, analiza PDF con pdf-lib y persiste `multiCommitPages` en GAS. Esto puede explicar el tramo post-`finish`, pero no se desglosó el tiempo real de cada suboperación.
- `apiPrepararDocumentosV2Lote`: ejecuta `fase4FichaCentralLotePrivada`, `registrarManifiestoV2EnCentral`, `prepararDocumentosCentralFirmado`. En `fase4FichaCentralLotePrivada` se vuelve a leer metadata y estado desde GAS y se vuelven a reconstruir bytes en `conectarRecepcionConCentral`, además de registrar/crear orden en D1. Puede explicar el tramo `central_inicio→central_fin`, pero no hay aún métricas internas.
- `DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`: recepción resumable Drive y comprobación `docsFinish` descargando PDF completo, luego `docsMultiReadPart` por rango y `docsMultiCommitPages` vuelve a cargar/verificar blob del PDF. Toda reducción de relecturas debe conservar SHA-256, páginas verificadas, recibo, precios servidor e idempotencia.

**Decisión de priorización:** no optimizar parser del navegador ni agregar pantallas/pagos antes de mejorar primero los tramos ~20 s de `vincular` y ~19,5 s de Central y validar el ~11,7 s de `finish`; una sola prueba no es suficiente para estimar p95 ni latencia de múltiples PDFs. Añadir métricas seguras internas / tests para descomponer las suboperaciones, especialmente tiempo de red GAS y Drive, sin revelar datos privados ni omitir comprobaciones. Luego evaluar batching, lecturas duplicadas y operaciones secuenciales, manteniendo prohibición de cobro. **No considerar esto una optimización ya implementada**.


## 28-10-2026: optimización de lecturas GAS/Drive en paralelo acotado — **CÓDIGO Y CI APROBADOS, NO DESPLEGADOS**

**Motivo y línea base comprobada:** un solo PDF A4 de 12 páginas, blanco y negro doble faz con anillado individual, $3.290 preliminar, tardó **62.081 ms** (captura consola del usuario). El cuello identificado está en `finish` (~11,7s), `vincular` (~20,4s) y `central` (~19,5s). No atribuir todavía latencia exclusivamente a plan gratuito, Apps Script, Drive o Workers.

**Cambios únicamente en rama privada `fase1/impresiones-ploteos-20261027`:**
- `integraciones/autocotizador/recepcion/leer-pdf-fase4-privado.mjs` (`2174ee66`): lecturas autenticadas HMAC `multiReadPart` de 256 KiB hasta **3 en paralelo**, según offsets predeterminados, sin alterar bytes, reensamblado por offset y SHA-256 por bloque + documento completo.
- `integraciones/autocotizador/recepcion/worker-fase4-cotizador-unificado.mjs` (`74d126f5`): mismo límite de **3 lecturas de sólo lectura en paralelo** en `fase4PrivateVerified`, con validación intacta de recibo, offset, tamaño, firma y SHA-256. El conteo de páginas y su persistencia en GAS no cambian.
- `integraciones/autocotizador/recepcion/fase4-ficha-central-lote-privada.mjs` (`ce949efb`): las consultas de solo lectura `multiInfo` y `multiVerifiedStatus` del mismo PDF se solapan con `Promise.all`. Se mantienen las comprobaciones de consistencia estricta entre ambos recibos y la reconstrucción independiente que recalcula precio en servidor antes de D1.
- Las **subidas `multiPart`**, escrituras, verificación de páginas, precios y registro D1 siguen **secuenciales**; no se cambian permisos, cuotas ni seguridad. La optimización evita esperas seriales en lecturas independientes, no elimina comprobaciones.
- `tests/fase1-lectura-privada-concurrente.test.mjs` (`3639e04d`): pruebas reales de 6 fragmentos con respuestas desordenadas, concurrencia máxima 3, SHA de fragmento falso, recibo/offset falsos, SHA final inconsistente, patrón de Worker y verificación de dos estados.
- `integraciones/autocotizador/recepcion/package.json` (`e602de11`): incorpora suite de pruebas de rendimiento/seguridad en `test:handoff`, ejecutada antes de compilar el Worker.
- `tests/fase1-envio-unico-interfaz.test.mjs` (`4ecdd93f`): regresión de seguridad y paralelismo, activando workflow de validación.

**Pruebas verificadas GitHub Actions:** run `40721208008`, job `122932283823`, **SUCCESS**; 49 pruebas del contrato sin fallos y nuevas pruebas de lectura concurrente `ok`, compilación y verificación del Worker correctas. **No** se ejecutó carga real contra Google para medir ahorro.

**Estado confirmado al cerrar:** código seguro y pruebas aprobados en GitHub, **sin nueva versión Cloudflare cargada ni desplegada**. La última versión privada conocida en servicio es `2c1db455-4ac5-4f02-9ebd-c4e581f7283d`, que produjo el ensayo de 62.081 ms. `main` comercial, `libreriasaber.com.ar`, cobros y Polaroids intactos.

**Próximo paso operativo:** desde el workflow manual de GitHub existente en `main` `.github/workflows/saber-preparar-version-privada.yml` (build FROM rama privada), ejecutar **Run workflow** y recuperar `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR`. Luego promocionar **solo** en Cloudflare `saber-documentos-pruebas`, guardando `2c1db455` como rollback. Repetir exactamente PDF de 12 páginas con `?diagnostico=1` (y un lote mixto después), comparar tiempos por fase contra 62.081 ms. Si hay errores de concurrencia/cuotas o empeora la latencia, revertir al despliegue anterior; no atribuir mejoría antes de medir. Si el cuello `finish` persiste, instrumentar GAS para separar Drive SHA, relecturas y llamadas Worker, sin omitir seguridad.


## 28-10-2026: optimización de lectura concurrente preparada como versión privada, SIN activarla

- El usuario ejecutó manualmente la tercera preparación en `main`, workflow `saber-preparar-version-privada.yml`, run GitHub **`40721612657`**.
- Consultados job `122933746335` y logs: **completed/success** en todos sus pasos, con `PRUEBAS_PRIVADAS_OK` y `SIN_DESPLIEGUE_SIN_PAGOS_SIN_CAMBIOS_EN_WEB_COMERCIAL`.
- Nueva versión cargada en Cloudflare pero **NO desplegada**: `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR=8ea21564-0d95-44ab-a344-0100f108ef30`.
- Incluye lectura de 256KiB con concurrencia acotada a 3, SHA-256 íntegro y consulta de metadata+estado firmados solapadas; las pruebas del contrato y tests de seguridad/concurrencia pasaron previamente en run `40721208008`.
- **Última versión de pruebas activa conocida:** `2c1db455-4ac5-4f02-9ebd-c4e581f7283d` (línea base de 62.081ms para 1 PDF A4 de 12 páginas). Mantenerla como rollback si se activa la optimizada.
- **Próximo paso:** Cloudflare → Worker `saber-documentos-pruebas` → Implementaciones → menú de versión `8ea21564` → Promocionar al 100%, comprobar que la versión anterior indicada sea `2c1db455` y el destino sea exclusivamente Worker privado. Verificar con captura versión activa. Después una sola prueba del mismo PDF con `?diagnostico=1`, comparar total y fases contra 62.081ms; cualquier diferencia debe atribuirse con cautela a una muestra y no a planes de servicios. NO modificar `main` público, pagos ni Polaroids.


## 28-10-2026: optimización concurrente ACTIVADA en Cloudflare; falta comparar rendimiento REAL

- Captura aportada por el usuario: panel Cloudflare de **Workers & Pages → saber-documentos-pruebas → Implementaciones**, con versión activa **`8ea21564`**; aviso visual **«Versión promocionada al 100%»**, y `8ea21564` marcada como implementación vigente. Versión previa **`2c1db455`** conservada en historial, disponible para rollback.
- ID completo de la versión optimizada según log previo: `8ea21564-0d95-44ab-a344-0100f108ef30` (GitHub run de preparación `40721612657` SUCCESS).
- Versión incorpora lectura HMAC Google Drive de fragmentos 256KiB con concurrencia máxima 3 y comprobación SHA; en Central las dos consultas de estado/metadata se solapan. No elimina verificación de integridad/páginas/cotización de servidor ni activa cobros.
- **Estado real:** promoción de Worker privado comprobada en screenshot. **Todavía NO se ha medido ni demostrado reducción de latencia** con prueba de PDF. Sitio público y cobros sin cambios.
- **Siguiente paso:** el mismo PDF `poliza_1145046.pdf` (12 páginas, A4, B/N, doble faz, una copia, anillado individual, total preliminar $3.290), desde pestaña nueva `/prueba-v2/?diagnostico=1` y un solo clic de envío; luego capturar `Array(...)` de consola abierto con etapa `fin`. Contrastar con 62.081ms anteriores, recepción hasta 42.605ms y Central desde 42.607 hasta 62.081. Si cuota/red/revalidación falla, volver al Worker `2c1db455`; no concluir que mejoras o fallos son por planes gratis con una sola muestra.


## 28-10-2026: primera prueba real tras optimización 8ea21564 — usuario informa demora excesiva

- Captura proporcionada por usuario de `/prueba-v2/?diagnostico=1`: 1 PDF `poliza_1145046.pdf`, A4, 12 páginas, B/N, doble faz, anillado individual, total preliminar $3.290, interfaz muestra `Pedido registrado` y `Pedido enviado y registrado correctamente. Sin cobros`.
- El usuario informa explícitamente **«demoró un montón»** después de implementar lecturas concurrentes con máximo 3 en versión privada `8ea21564`.
- La consola muestra `[Librería Saber] Mediciones locales del ensayo` y `Array(13)`, **CONTRAÍDO**. Por tanto NO es posible leer de esa captura el tiempo total ni fases y NO se puede afirmar una mejora o regresión cuantificada. Se le indicó desplegar `Array(13)` con un clic y enviar captura.
- **Hallazgo práctico:** la optimización de fragmentos por sí sola no ha resuelto la percepción de lentitud del cliente. Evitar reiterar pruebas sin obtener primero duración real y luego atacar la arquitectura del intercambio GAS/Drive/Worker (múltiples POST firmados y relecturas) con salvaguardas de integridad, cotización de servidor, registro D1 y reintentos.
- No tocar producción, pagos, Polaroids ni desplegar otra versión basada únicamente en la percepción sin medir tramos. Versión previa conocida para rollback `2c1db455`.


## 28-10-2026: resultado real de la primera comparación tras optimizar lecturas — **44.877 ms**

- Usuario proporcionó captura visible del navegador y consola expandida de `/prueba-v2/?diagnostico=1`. Mismo archivo `poliza_1145046.pdf`, 12 páginas, A4, B/N, doble faz, 1 copia, anillado individual; precio preliminar $3.290. La pantalla dice **«Pedido registrado»** y «Pedido enviado y registrado correctamente. Sin cobros.» Tras promover Worker privado **`8ea21564`** (versión anterior de referencia `2c1db455`). No se hizo revisión independiente de D1 en este turno.
- **Tiempos exactos de `window.__saberRendimientoPrivado.eventos` (milisegundos acumulados desde el clic):** `clic_enviar` 0; `preparacion_inicio` 0; `preparacion_terminada` **103**; `pdf_inicio` 103 y 108; `pdf_estado` **7134**; `pdf_transferencia` **10889**; `pdf_verificacion` **24778**; `pdf_confirmado` **36769**; `central_inicio` **36770**; `central_fin` **44877**; `fin` **44877**, estado `pedido_registrado`.
- **Línea base anterior exacta:** total **62081ms**; `preparacion_terminada` 104; `pdf_estado` 6354; `pdf_transferencia` 10517; `pdf_verificacion` 22229; `pdf_confirmado` 42605; `central_inicio` 42607; `central_fin` 62081.
- **Comparativa:** total mejoró `62081-44877=17204ms` (**27,71%**); tramo hasta `pdf_verificacion` EMPEORÓ **22229→24778** (+2549 ms); tramo `pdf_verificacion→pdf_confirmado` mejoró **20376→11991 ms** (−8385 ms); tramo `central_inicio→central_fin` mejoró **19474→8107 ms** (−11367 ms). Las diferencias internas son intervalos de red + procesamiento, no timings individuales de GAS/Drive. El cambio en Central podría incluir variación de servicios o carga; **una muestra por versión no demuestra causalidad ni p95**.
- **Diagnóstico:** la lectura concurrente con máximo 3 tiene efecto compatible con la mejora observada en vinculación y Central, pero la etapa de recepción/hasta `finish` es ahora la mayor parte (24,8 s); no hacer nuevos parches de interfaz ni contratar plan pago basándose en una sola medición. Conservar SHA por bloque + completo, conteo páginas, precios servidor e idempotencia.
- **Estado:** optimización ejecutada en Worker privado, recepción y D1 declaradas completadas por interfaz; pública `libreriasaber.com.ar` intacta, cobros apagados. **Próximo trabajo:** instrumentar y revisar por dentro `start/status/part/finish` de GAS/Drive, operaciones de lock/probe/descarga, y posibles llamadas duplicadas; priorizar la etapa 24,8 s y el efecto de lotes. Evitar volver a pedir a usuario pruebas que no cambien diagnóstico. Mantener como referencia `44.877ms` y rollback `2c1db455`.


## 28-10-2026: simplificación real del circuito — **una validación completa y un comprobante HMAC reutilizable (aún NO desplegado)**

**Motivo comercial:** el usuario señaló que no tiene sentido descargar, releer y recalcular varias veces un PDF simple para impresión. Línea base vigente 44.877 ms (antes 62.081 ms). En el sistema anterior, el Worker verifica completamente el PDF tras `finish` y, al registrar la compra, la Central vuelve a descargar el mismo original desde Google, comprobar SHA y páginas, recálcular precio. La segunda descarga no es necesaria si hay un comprobante CRIPTOGRÁFICO vigente emitido por el propio servidor tras la primera verificación real.

**Código implementado solo en rama `fase1/impresiones-ploteos-20261027`:**
- Nuevo `comprobante-pdf-servidor.mjs` (commit `7c171675`): sello HMAC-SHA256 con dominio separado usando secreto existente `DOCS_RELAY_KEY`; contiene recibo, ID de pedido/archivo, nombre, SHA, bytes, páginas, medidas por página y fecha. No expone claves, token GAS, PDF, URL Drive ni precio del cliente. Caduca a los 15 minutos y rechaza alteraciones.
- Nuevo `verificacion-central-comprobante.mjs` (`1d79e308`): valida firma, vigencia, número de PDF, IDs, SHA, páginas, modo y correspondencia con manifiesto/sesión. Con las medidas extraídas del PDF original y firmadas por servidor, **recalcula íntegramente los servicios, anillado, rollos y precios actuales DEL SERVIDOR** usando `consolidarPedidoVerificado` y `prepararFichaCentral`; alimenta contrato anterior `registrarManifiestoV2EnCentral` y D1 sin segunda descarga del archivo.
- Worker privado `worker-fase4-cotizador-unificado.mjs` (`0254f11d`, `2d98f988`, `7b3c8883`): durante `fase4PrivateVerified` conserva medidas confiables de los bytes *ya* leídos del Drive, sella prueba al vincular PDF y reutiliza prueba firmada en `apiPrepararDocumentosV2Lote` sólo cuando TODOS los archivos tienen comprobante. Los pedidos anteriores/mixtos sin prueba mantienen verificación completa; si prueba GENUINA caducó, se hace verificación completa de Drive sin requerir nueva subida. Firma falsa o discrepancia NO habilita fallback silencioso. Si el PDF no permite extraer medidas confiables, no se emite prueba y conserva ruta documental tradicional. N-up reutiliza medidas sin nueva lectura.
- Cliente `subir-vincular-pdf-v2-privado.mjs` (`224cfa89`) transporta el comprobante sin firmarlo ni persistirlo; `pantalla-cotizador-v2-prueba-privada.mjs` (`479e82c5`) lo incorpora al único POST de registro.
- **Seguridad que se mantiene:** bytes e integridad comprobados una vez contra Google Drive, SHA-256 por bloque y global, páginas/medidas del original calculadas en servidor, recálculo autoritativo de precio, cotejo completo de renglones/manifiesto/anillado, antifraude HMAC y caducidad, idempotencia y registro D1 server-to-server. Pagos y producción continúan deshabilitados; futura confirmación de Mercado Pago debe seguir verificándose por webhook firmado.
- **Pruebas:** `tests/fase1-comprobante-pdf-unico.test.mjs` (`2f0bb678`) cubre recibo completo 12p, precio exacto $3.290 con anillado individual, discrepancia de datos, páginas, tamaño, SHA, nombre, pedido/receptor cruzados, 15 min, firmas falsas, recibos no verificados y ausencia de autorización de cobros. Incluido en `test:handoff` por `package.json` (`9d4c6280`), y aserciones de UI/Worker (`f7203341`).
- **GitHub Actions** `40727481221`, job `122954536288`: **SUCCESS**, validación contrato **50/50**, pruebas nuevas de firma/reprecio aprobadas, construcción de Worker y regresiones previas aprobadas. El build de prueba no crea versiones Cloudflare ni modifica `main`.
- **ESTADO REAL:** código y pruebas automáticas aprobadas en GitHub, pero **ninguna nueva versión preparada en Cloudflare ni desplegada**. En pruebas sigue vigente `8ea21564-0d95-44ab-a344-0100f108ef30` (última captura), demora de referencia 44.877 ms. `main`, `libreriasaber.com.ar`, pagos y Polaroids intactos.
- **Próxima acción:** opcional test end-to-end de ruta Worker con servidor GAS simulado para observar que `apiPrepararDocumentosV2Lote` ya no llame de nuevo a `multiReadPart` bajo firma válida; luego preparar nueva versión privada mediante workflow manual `saber-preparar-version-privada.yml`, promover solo en `saber-documentos-pruebas` con rollback `8ea21564`, medir mismo PDF 12p frente a 44.877 ms. NO asumir mejora de rendimiento hasta repetir ensayo real. Después optimizar el tramo inicial `start/status/part/finish` (~24,8 s), no achicar controles útiles a costa de pérdida de archivos.


## 28-10-2026: IMPLEMENTACIÓN PARCIAL UX COMPATIBLE CON CARGA ÚNICA — CÓDIGO VALIDADO, NO DESPLEGADO

**Disparador:** tras observar un solo PDF excesivamente lento y una interfaz larga con secciones técnicas, el usuario aprobó la orientación de **una sola área para todos los PDF de cualquier tamaño, clasificación y agrupación automáticas, decisiones mínimas y un solo botón**, y pidió avanzar. Esta intervención ejecutó esa dirección sin rehacer las funciones de cálculo ni publicar el sitio.

**Cambios reales sólo en rama de pruebas `fase1/impresiones-ploteos-20261027`:**
- `carga-unica-cliente.mjs` commit `1eab4c9d`: `grupoVisible` presenta tarjetas agrupadas A4, A3, CAD, Póster, CAD+Póster, pendientes y servicios especiales; `controlesComunes` permite aplicar explícitamente a 2+ archivos del mismo grupo copias y opciones comunes de impresión y anillado individual. Se conserva `entries` y los índices de archivos para el payload de cotización, ZIP/Drive y D1. El cambio es de UI; se conserva clasificación y precios originales.
- `carga-unica-pagina.mjs` commit `02ce23ad`: CSS de agrupación compacta responsive.
- `worker-fase4-cotizador-unificado.mjs` commit `9ad4425a`: en el iframe exclusivo de la prueba integrada se oculta el presupuesto duplicado; el total visible queda en la barra del portal.
- `pantalla-cotizador-v2-prueba-privada.mjs` commit `795330ff`: diagnóstico de recepción y comparación comercial no se muestran al cliente normal (siguen consultables con `?diagnostico=1`); durante envío el editor se reemplaza en la misma área por mensaje de progreso, y al completarse por recibo compacto con total final verificado. En caso de falla el editor se restaura para reintentar con recepciones ya confirmadas, sin nuevos botones.
- `tests/fase1-envio-unico-interfaz.test.mjs` commits `c86478fb`, `7e32ad84`: regresiones de un clic y reintento, categorización y conservación de índices, visibilidad técnica limitada y pantalla compacta.
- CI: las ejecuciones `40727668518` y `40727846063` pasaron; el cambio en estado produjo fallo temporal `40727938532` por regex de test antiguo, y `40728061660` por nueva aserción de test con nombre interno incorrecto. Corregidas **sólo las aserciones desactualizadas**; workflow final **`40728153179` SUCCESS**, 0 fallos, tests y build privado correctos.
- Contrato funcional extendido en `docs/UX-CIRCUITO-UNICO-CLIENTE-V1.md`, commit `f04b8bc9`.

**ESTADO DE VERDAD Y PRÓXIMA ACCIÓN:** No se ha generado ni promovido una versión Cloudflare que contenga esos commits. La última versión activa registrada en panel de pruebas es **`8ea21564-0d95-44ab-a344-0100f108ef30`**, en la que se midió **44.877 ms** para un PDF A4 de 12 páginas, B/N, DF, anillado individual. El código UX puede compilar, pero **NO se ha probado en navegador ni se ha medido reducción de latencia por esta UI**. Para activar SOLO la prueba privada, ejecutar workflow manual existente en main `Saber - preparar version privada desde rama de pruebas` (que lee la rama de pruebas actual); obtener el nuevo UUID, promoverlo en **saber-documentos-pruebas** con rollback a `8ea21564`. Luego probar vista de grupos y un lote A4+A4+A0 con mismas reglas de precio, SHA, originales Drive y registro Central D1, y error/reintento. Si hay regresión, revertir el Worker, nunca main ni la web comercial. El usuario no debe tener que repetir configuraciones ya cerradas. Cobros, producción y Polaroids siguen desactivados/sin cambios.



## 28-10-2026 (continuación): ensayo integral REALISTA del nuevo circuito sin segunda lectura — **PASS, aún NO desplegado**

**Objetivo concreto:** comprobar en código compilado del Worker que un PDF real ya subido y verificado en GAS/Drive puede sellarse una única vez y preparar su pedido en la Central sin volver a descargar los mismos bytes; mantener precio de servidor, anillado, no pagos y protección contra falsificación.

**Nuevo test de integración** `integraciones/autocotizador/recepcion/fase4-comprobante-worker-e2e.test.mjs` (commit `c1060af1`):
- Crea **PDF real de 12 páginas A4** con pdf-lib, prepara SHA, ID de pedido y nombre.
- Usa `worker.fetch` sobre el **Worker compilado**, con mocks EN MEMORIA de Turnstile, POST HMAC hacia Apps Script, Drive y Service Binding HMAC de Central. No hay llamadas reales, archivos almacenados ni cargos.
- Ejecuta exactamente `/api/ensayo-pdf-ampliado` (start, part y finish) → `/api/ensayo-vincular-pdf-v2` (lee original desde Google, valida estructura y páginas, crea comprobante HMAC) → `/api/ensayo-preparar-documentos-v2-lote` (compara comprobante, recalcula precio, registra en Central simulada y prepara orden no pagada).
- Aserciones: **precio $3.290**, doble faz B/N, 12 páginas, anillado `individual`, `checkoutEnabled=false`, `paymentAuthorized=false`, `listoParaProducir=false`, y **0 llamadas adicionales a GAS/Drive** durante registro del pedido; el recibo HMAC con páginas alteradas recibe 422 y **no** llega a Central.
- `package.json` (commit `4e9808f3`) ahora ejecuta esta prueba **DESPUÉS de compilar** al hacer `npm run build:unificado`, de modo que staging no pueda construir versión defectuosa y que fallen los pipelines si el flujo se rompe. `tests/fase1-envio-unico-interfaz.test.mjs` (commit `35aa6a07`) comprueba que nadie suprima esta prueba sin fallar CI.
- **GitHub Actions** `40757665199`, job `123060826714`, **SUCCESS** con todos los pasos terminados correctamente. Logs confirman test `Worker enlaza 12p y registra en Central sin segunda lectura de Drive; sello inválido se rechaza` **ok 1**; 50 pruebas de contrato y 13 regresiones previas sin fallos; compilación Worker exitosa; `NO DEPLOY; NO PAYMENTS; NO COMMERCIAL WEBSITE`.
- **Estado real:** código + test exitoso SOLO en rama `fase1/impresiones-ploteos-20261027`. **No se ha cargado ni desplegado todavía** la versión nueva en Cloudflare; última activa verificada de pruebas `8ea21564-0d95-44ab-a344-0100f108ef30`, con línea base **44.877 ms** en archivo de 12 páginas. Nada de pagos ni público.
- **Siguiente paso operativo sin repetir ensayos**: ejecutar **UNA VEZ** el workflow manual existente `https://github.com/hernanchan/COTIZADOR/actions/workflows/saber-preparar-version-privada.yml` seleccionando `main` (checkout automático del código de rama privada). Obtener `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR`, luego promocionar exclusivamente ese UUID al 100% en Cloudflare `saber-documentos-pruebas`, conservando **`8ea21564`** como rollback. Repetir `poliza_1145046.pdf` con `?diagnostico=1`, 12 páginas A4 B/N doble faz anillado individual, comparar etapa Central (~8,1 s) y total (~44,9 s); no concluir ganancia antes de medir la ejecución real. La recepción inicial ~24,8 s queda para la siguiente optimización.


## 28-10-2026: versión simplificada de verificación ÚNICA, preparada en Cloudflare sin activar

- Usuario confirmó «listo» tras ejecutar `.github/workflows/saber-preparar-version-privada.yml` desde `main` (lee código de rama `fase1/impresiones-ploteos-20261027`).
- GitHub Actions run **`40758022871`**, job **`123062076143`**, **completed/success** con todos los pasos exitosos, `PRUEBAS_PRIVADAS_OK` y test e2e compilado `Worker enlaza 12p y registra en Central sin segunda lectura de Drive; sello inválido se rechaza`: **ok 1**.
- Log: `VERSION_PRIVADA_PREPARADA_SIN_ACTIVAR=4218e07f-ce26-4c88-93c1-4d3ce6cc68de`, confirma `SIN_DESPLIEGUE_SIN_PAGOS_SIN_CAMBIOS_EN_WEB_COMERCIAL`.
- **Todavía NO activada.** Última conocida desplegada en Worker **`saber-documentos-pruebas`**: `8ea21564-0d95-44ab-a344-0100f108ef30`; usar como rollback. `libreriasaber.com.ar`, pagos y Polaroids intocados.
- Próximo paso: Cloudflare → Workers & Pages → `saber-documentos-pruebas` → Implementaciones → menú de `4218e07f` → Promocionar versión al **100%**, comprobando anterior `8ea21564`. Luego repetir una vez PDF `poliza_1145046.pdf`, 12 páginas A4, B/N, doble faz, 1 copia, anillado individual y `?diagnostico=1`, comparar contra **44.877 ms**. No afirmar mejora real antes de la prueba.


## 28-10-2026: primer ensayo REAL de simplificación HMAC, **32.296 ms, pedido confirmado por interfaz**

- Usuario envió captura de Chrome con portal `/prueba-v2/?diagnostico=1` luego de confirmar que promovió la versión `4218e07f-ce26-4c88-93c1-4d3ce6cc68de` al 100% en Worker **`saber-documentos-pruebas`**. En captura se ve «Pedido recibido correctamente», «Pedido registrado», **total verificado $3.290**, 1 PDF verificado, pagos desactivados y número de pedido comercial (no registrar UUID del cliente en documentación). **No se consultó D1 independientemente ni hubo inspección posterior de versión activa en Cloudflare**, pero el ensayo es compatible con la nueva versión.
- Consola JavaScript `Array(13)` visible y desplegada; **valores exactos en milisegundos acumulados desde el clic**: `clic_enviar` 0; `preparacion_inicio` 0; `preparacion_terminada` **112**; `pdf_inicio` 112 y 119; `pdf_estado` **4827**; `pdf_transferencia` **8800**; `pdf_verificacion` **19852**; `pdf_confirmado` **29554** y **29555**; `central_inicio` **29555**; `central_fin` **32296**; `fin` **32296**, `estado:'pedido_registrado'`.
- **Versión anterior `8ea21564`**: `fin` 44.877 ms, `pdf_verificacion` 24.778 ms, `pdf_confirmado` 36.769 ms, `central_inicio` 36.770 ms, `central_fin` 44.877 ms. **Inicial `2c1db455`**: `fin` 62.081 ms.
- **Comparación**: 44.877→**32.296 ms**: ahorro **12.581 ms (28,03%)**. Frente a inicial 62.081→32.296 ms: ahorro **29.785 ms (47,98%)**. Tramos de la prueba: hasta `pdf_verificacion` **19.852 ms** (antes 24.778: −4.926); `pdf_verificacion→pdf_confirmado` **9.702 ms** (antes 11.991: −2.289); `central_inicio→central_fin` **2.741 ms** (antes 8.107: −5.366). No inferir causalidad exacta entre una sola prueba por versión; resultados combinan latencia de red y servidores.
- **Resultado técnico importante**: el cambio de eliminar la segunda descarga completa de Drive al registrar pedido tiene prueba E2E aislada que demuestra cero llamadas adicionales GAS; ahora el resultado en navegador sugiere que acortó significativamente Central, con el precio y anillado intactos.
- **Resto del problema**: recepción inicial `clic→pdf_verificacion` **19,9 s** y vínculo/confirmación `pdf_verificacion→pdf_confirmado` **9,7 s**; Central solo 2,7s. El tramo `pdf_transferencia` es registro del avance del primer bloque, **no** indica que los tres bloques se hayan enviado a esa marca; evitar asignar arbitrariamente 11s a `finish`. Priorizar GAS `multiStart`, `multiStatus`, `multiPart`, `multiFinish` y `multiCommitPages` y llamadas redundantes, sin omitir integridad, ni eliminar archivos antes de asegurar respaldo.
- **No realizar más promociones ni pruebas repetitivas sin una mejora nueva concreta.** La siguiente investigación debe distinguir con medición servidor el coste de `multiFinish` (descarga completa/Drive SHA), creación/cierre de sesión, escritura de bloques y `multiCommitPages` (otra comprobación de bytes en Apps Script). Si se necesita modificación de GAS desplegado por usuario, evitar manipular la implementación real sin aprobación y preparar cambios aislados. Volver a optimizar únicamente la rama privada y medir cuando corresponda. Web pública, Mercado Pago y Polaroids sin cambios.


### Inspección de código de recepción GAS tras los 32.296 ms

Se inspeccionó en GitHub `integraciones/autocotizador/recepcion/DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`. Hay redundancias reales en el receptor actualmente publicado como Apps Script v6 (el archivo del repositorio representa la versión base; **verificar antes de modificar la implementación en Google**):

1. `docsMultiRun(action='part')` deriva a `docsPart`; `docsPart` línea ~479 invoca **`docsProbe(s)` antes de CADA bloque**, que hace una solicitud HTTP de sondeo de estado contra Drive incluso cuando el offset ya se guardó tras el bloque anterior. Esta llamada protege recuperación ante estados inconsistentes, así que cualquier optimización requiere pruebas de reintentos y suspensión de móvil.
2. `docsFinish` línea ~499-511, tras `docsProbe`, **descarga el PDF completo de Drive** y confirma SHA-256. Este control es útil en el cierre.
3. `docsMultiCommitPages` línea ~354-370 llama a `docsPilotBlob(s)` línea ~167, que **descarga de nuevo el PDF completo mediante DriveApp y confirma SHA-256**, después de que `docsFinish` ya lo comprobó y el Worker lo volvió a reensamblar/verificar para contar páginas. Esto es **una comprobación redundante identificable**, candidata a eliminación *únicamente si* se exige `s.receiptState==='bytes_checked'`, se verifica `sha256`/bytes/estado y las páginas se obtuvieron desde los bytes leídos realmente por Worker; no confiar en cliente ni perder idempotencia.
4. `docsMultiIds()` lee y valida el índice completo de hasta 120 sesiones al autenticar operaciones (lineas ~234-261). Puede explicar sobrecarga adicional de lectura de PropertiesService, aunque no hay timings de servidor para cuantificarla.

**Prioridad siguiente:** simplificar GAS `multiCommitPages` y sondas por bloque sin perder tolerancia a fallos, luego medir individualmente sus esperas y validar reintentos. Esto requiere desplegar una nueva versión de Google Apps Script de forma controlada; no tocar Apps Script de Polaroids ni la web pública. **No hay cambios de código GAS realizados en esta inspección**. El Worker privado actual ya tiene la nueva optimización de comprobante HMAC y redujo a 32.296 ms el total. No hacer pruebas adicionales al usuario hasta tener código nuevo significativo.


## 28-10-2026: optimización real de receptor GAS + primer estado de sesión — CI COMPLETA APROBADA, NO INSTALADA

**Línea base real anterior:** 32.296 ms para `poliza_1145046.pdf` 12 páginas A4, B/N doble faz, 1 copia, anillado individual, total verificado $3.290. Tramo clic→`pdf_verificacion` 19.852 ms; `pdf_verificacion→pdf_confirmado` 9.702 ms; Central 2.741 ms.

**Código implementado únicamente en rama `fase1/impresiones-ploteos-20261027`:**
- `DocumentosReceiver_LOTE_AMPLIADO_PRUEBAS_20261024.gs`, commits `dd7a4091`, `a5be7ef6`. `docsFinish` mantiene una descarga REAL completa desde Google Drive y SHA-256, y registra checkpoint privado `storageSha256Checked` + timestamp. `docsMultiCommitPages` comprueba recibo, SHA, tamaño, Drive ID, offset y estado de verificación de bytes; reutiliza checkpoint de SHA al guardar número de páginas, sin hacer otra descarga completa de Drive para recibos nuevos. Recibos viejos sin checkpoint hacen una última verificación real `docsPilotBlob` y guardan el checkpoint, idempotente.
- `docsPart` evita sondear Drive `docsProbe` antes de cada bloque consecutivo CUANDO offset y estado persistidos son los esperados; reanuda usando sondeo ante bloque repetido, desordenado o respuesta inesperada (incluido caso respuesta perdida tras escritura aceptada por Drive). Jamás elimina SHA por bloque ni el SHA global.
- `docsMultiStart` devuelve `newSession:true` sólo para una sesión realmente creada; `newSession:false` para la sesión existente que reutiliza recibo.
- `subir-vincular-pdf-v2-privado.mjs`, commit `59069103`: si el receptor HMAC devuelve `newSession:true`, omite únicamente la primera consulta `multiStatus`. Para `sesionPrevia`, un receptor viejo sin indicador, una sesión reutilizada o error de transferencia, SIGUE consultando `multiStatus`, recuperando fragmentos confirmados.
- Suite `receptor-gas-recuperacion.test.mjs`, commits `cb4647a9`, `651f6841`, `01c9ebee`: ejecuta las funciones reales de `.gs` en Node VM con PropertiesService/Drive API/DriveApp simulados, incluye 3 partes, cortes, reintentos, desorden, SHA adulterado y sesiones antiguas, marker nuevo/idempotente.
- Suite `subida-sesion-fresca.test.mjs` commit `4fc0af80`: ejecuta carga del navegador de verdad con RPC simulado: sesión recién creada sin status, compatibilidad viejo, recibo existente, sesión reanudada, ACK perdido. Añadido `test:handoff` en `package.json`, commits `551b3130`, `bca889ed`.
- `tests/fase1-envio-unico-interfaz.test.mjs` confirma guardas y suites; workflow de validación actualizado para detectar cambios de receptor/tests/package, commit `c27ff3e4`. Se corrigió una prueba **preexistente y probabilística** de manipulación de cookie (`755a12d5`, el reemplazo por «f» podía no alterar una firma terminada en «f»).
- **VALIDACIÓN FINAL:** GitHub Actions `40764055539`, job `123083328125`, **completed/success**. **54** pruebas de contrato y **31** tests de traspaso/recepción/verificación, todas sin fallos; E2E Worker compilado (12 páginas, SHA, precio $3.290, Central D1 simulada) y regresiones anteriores aprobadas. Log: `NO DEPLOY; NO PAYMENTS; NO COMMERCIAL WEBSITE`.
- Guía de actualización y rollback de GAS, `docs/ACTUALIZACION_RECEPTOR_GAS_PRIVADO_20261028.md`, commit `37668c7c`.

**ESTADO REAL:** hay código y pruebas aprobados, pero **no se ha modificado ni implementado el Google Apps Script real**. La versión Cloudflare activa más reciente en el ensayo es `4218e07f`; su código cliente no contiene todavía la omisión de `status` (solo la rama de desarrollo la tiene). `libreriasaber.com.ar`, main, cobros y Polaroids sin cambios.

**Próximo paso técnico seguro:** desplegar sólo en proyecto «SABER — RECEPCIÓN DOCUMENTOS» una nueva versión de su implementación existente, preservando la anterior y verificando que su fuente real no diverja del `.gs` de GitHub; no reemplazar el proyecto a ciegas. Orden: GAS nuevo primero (compatible con Worker actual), luego preparar/promocionar versión nueva **solo** de Worker `saber-documentos-pruebas` mediante workflow manual Github. Una medición final del PDF de 12 páginas contra **32.296 ms**, comprobación Drive/D1 y rollback si fallo. No prometer ahorro hasta medición.
