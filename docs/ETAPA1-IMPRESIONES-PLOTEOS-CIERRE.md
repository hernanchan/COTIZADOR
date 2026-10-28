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
