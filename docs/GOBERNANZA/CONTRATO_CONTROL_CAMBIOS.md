# Contrato de control de cambios — Librería Saber

**Versión:** 1.0 · **Fecha:** 14/11/2026 · **Estado:** norma de trabajo para la beta.  
**Autoridad de negocio:** titular de Librería Saber.  
**Propósito:** impedir que se cambien criterios aprobados como efecto secundario de otras tareas y garantizar continuidad entre chats, desarrolladores y despliegues.

> Una indicación en un chat no es una barrera técnica. Este contrato se aplica a las modificaciones del código; la verificación automática requiere además una regla de protección de GitHub activa. El propietario puede cambiar las reglas **explícitamente**, nunca por interpretación tácita del asistente.

## Reglas protegidas

- **SBR-001 — Alcance mínimo:** arreglar un problema no habilita reescribir módulos no relacionados ni revertir funcionalidades aprobadas.
- **SBR-002 — Código como fuente:** cada cambio parte del código y de las decisiones vigentes, no solo de la memoria de un chat. Si el manual contradice al sistema desplegado, se verifica y se registra la discrepancia.
- **SBR-003 — Un motor comercial:** móvil y PC comparten cotización, tarifas y promoción; no crear un segundo cálculo paralelo ni modificar precios como consecuencia de un cambio estético.
- **SBR-004 — Experiencia móvil aprobada:** asistente por seis pasos, controles por etapa, navegación Atrás/Siguiente al **pie**; PC conserva su interfaz. Cambios sustanciales requieren autorización del titular.
- **SBR-005 — Archivos y medidas:** detectar por contenido y medidas, no decidir papel o material por el nombre del archivo. Conservar las reglas comerciales aprobadas de formatos y cotización; los límites de transporte deben provenir del sistema verificado.
- **SBR-006 — Integridad de cobros:** ningún pedido puede pasar a la cola firme de producción por una mera afirmación de pago. Verificar Mercado Pago o transferencia conforme al circuito establecido.
- **SBR-007 — Custodia:** proteger los documentos; mantener la política aprobada de eliminación de originales al marcar Entregado, con verificación de cobertura real en los transportes existentes.
- **SBR-008 — Infraestructura:** no alterar secret keys, dominios, Workers, D1, R2, Supabase, permisos, rutas de pago ni visibilidad pública/privada sin autorización y plan de regreso.
- **SBR-009 — Evidencia:** distinguir solicitado, codificado, probado, desplegado y validado con operación real. No anunciar “publicado” con solo editar GitHub.
- **SBR-010 — Datos y propiedad:** no introducir en repositorios públicos credenciales, documentación sensible, información de clientes ni llaves; no usar datos reales para ensayos.
- **SBR-011 — Continuidad:** cada decisión significativa y cada modificación deben quedar documentadas con commit, estado, evidencia, alcance, pendientes y próximo paso. Los chats son la discusión, no el registro definitivo.
- **SBR-012 — Sin cambios de criterio implícitos:** las excepciones deben tener un motivo explícito, impacto, alternativas, pruebas y autorización del propietario para el commit concreto.

Estas reglas **no confirman** por sí solas que cada comportamiento ya esté plenamente implementado en todos los módulos. Los tests de funcionamiento son una responsabilidad adicional.

## Regla para autorizar un cambio de código

Un cambio que afecte `integraciones/`, `vidriera/`, `functions/`, `tests/`, `tools/`, workflows, tarifas, configuración, web, `AGENTS.md` o este contrato:

1. Se presenta mediante **pull request (PR)** contra la rama que corresponda, nunca como reemplazo silencioso en producción.
2. El PR describe las cuatro cuestiones en formato `Motivo:`, `Alcance:`, `Pruebas:`, `Retroceso:`, cada una con una explicación real.
3. El titular revisa **el commit final** y deja personalmente en la conversación del PR (en GitHub, no en el chat con IA) un comentario de una sola línea con el formato:

```text
AUTORIZO CAMBIO SABER PR #NUMERO SHA SHA_COMPLETO_DE_40_CARACTERES
```

4. La comprobación automática del workflow **Control de cambios Saber**, con estado de commit **`saber/contrato`**, exige que el autor del comentario sea el usuario `hernanchan` y que número y SHA correspondan exactamente a ese PR. Si cambia el código, **se invalida la autorización previa**.
5. Tras comentar, volver a ejecutar el control en GitHub Actions (la publicación del comentario no lo vuelve a ejecutar por sí sola). Un PR sin archivos protegidos puede pasar sin este comentario.
6. Para cambios funcionales, deben ejecutarse **además** las pruebas del módulo. Pasar la aprobación del titular no sustituye pruebas de precio, pago, archivos, móvil, Central y seguimiento.

**La autorización se efectúa personalmente desde la interfaz de GitHub.** El asistente no debe redactar o publicar el comentario de aprobación mediante herramientas de la cuenta del titular: eso eliminaría la independencia de la decisión. El comentario prueba la identidad del usuario de GitHub, pero no por sí solo que se haya utilizado la interfaz manualmente.

## Activación indispensable en GitHub

El workflow `.github/workflows/saber-control-cambios.yml` puede **fallar** cuando falta autorización y publica un estado GitHub **`saber/contrato`** (`success` o `failure`) en el commit del PR. Al ejecutar sobre `pull_request_target` comprueba el código de verificación de la rama principal confiable `main`, sin ejecutar modificaciones propuestas. No impide merges o pushes por sí mismo; para bloquearlos hay que configurar una regla de rama en GitHub.

Configuración sugerida, una vez que el workflow haya corrido exitosamente en el repositorio:

1. Ir a `hernanchan/COTIZADOR → Settings → Rules → Rulesets → New branch ruleset`.
2. Nombre `Saber — cambios controlados`, enforcement **Active**.
3. Aplicar primero a la rama `integracion/tus-pedido-privado-20261101`. **No tocar todavía la rama `main` ni despliegues automáticos sin revisar dependencias.**
4. Activar `Require a pull request before merging`, `Require status checks to pass` y seleccionar como required status **`saber/contrato`**, emitido sobre el SHA del PR por el workflow confiable de la rama principal `main` (no usar el nombre del job como control obligatorio). Si están disponibles, activar protección contra force pushes y eliminaciones.
5. Revisar los **bypass**: no conceder excepciones amplias a automatizaciones; hacer una PR de ensayo bloqueada y otra aprobada por el titular.
6. El workflow de autorización debe estar en la rama predeterminada `main` para ejecutarse en PR contra la integración. La configuración de GitHub debe hacerla una cuenta con permiso de administración. Nuestra conexión de GitHub **no tiene acción de escritura de Rulesets**; hasta configurar esto, el control de CI es informativo, no una barrera ineludible.
7. Protección de la publicación: configurar aprobadores de `environment` y tokens de mínimo privilegio para los workflows que realmente despliegan. Los numerosos workflows antiguos pueden evitar este control si siguen pudiendo ejecutarse con permisos de despliegue; deben inventariarse antes de considerarlo universal.

**Limitación importante:** aun con rulesets, los administradores autorizados a cambiar la configuración de GitHub o Cloudflare pueden modificar la política o la infraestructura. El objetivo es prevenir errores y cambios involuntarios, no declarar un sistema técnicamente imposible de modificar.

## Prueba mínima del contrato

- El test `tests/control-cambios-saber.test.mjs` intenta un cambio crítico sin comentario → debe rechazarse.
- Con comentario de un usuario diferente → debe rechazarse.
- Con SHA anterior o número equivocado → debe rechazarse.
- Con aprobación del titular para el SHA exacto y la información completa → debe pasar.
- El contrato, su verificador y el workflow están **ellos mismos dentro de las rutas protegidas**.

## Estado de implementación

| Control | Estado al elaborar la versión 1 |
| --- | --- |
| Reglas documentadas | Implementado en código fuente del repositorio |
| Verificador Node y pruebas de regresión | Implementados; requieren ejecutar CI |
| Workflow de autorización | Implementado; solo verifica, sin permisos de despliegue |
| GitHub Ruleset requerido antes de merge | **Pendiente de activación por administrador** |
| Acceso de Cloudflare protegido por revisión humana | **Pendiente de verificar/configurar** |
| Aplicación uniforme a 290 workflows históricos | **No verificada**; requiere auditoría independiente |

Referencias: [reglas oficiales de GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository), [seguridad de pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
