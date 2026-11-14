# Protección del código y eventual comercialización

**Auditoría inicial:** 14/11/2026, exclusivamente inventario del repositorio y revisión de código/documentación seleccionados. **No es una auditoría exhaustiva de secretos, historial Git, seguridad de aplicaciones ni propiedad intelectual.** No contiene valores de credenciales ni hallazgos explotables.

## 1. Hechos verificados

| Pregunta | Resultado |
| --- | --- |
| ¿El repositorio `hernanchan/COTIZADOR` es público? | **Sí.** Metadata GitHub `private=false`, `visibility=public`. |
| ¿Tiene licencia declarada? | **No.** Metadata `license=null`; sin fichero LICENSE/LICENCE/COPYING en los árboles de `main` e integración examinados. |
| ¿Está habilitado GitHub Pages? | **Sí**, el repositorio indica `has_pages=true`; falta determinar la dependencia exacta de cada dominio comercial. |
| ¿Qué está expuesto técnicamente? | En la rama de integración, el árbol inspeccionado tiene **1.142 archivos** (incluye código de Worker, tests, workflows, documentos y módulos de pedidos/pagos). `main` tenía **46 archivos** en el inventario. No todos son código ejecutable. |
| ¿Qué se encontró en nombres de archivo? | No apareció fichero `.env`, `.pem`, `.p12` ni `.key` en el árbol revisado. **Esto no acredita ausencia de credenciales embebidas en el contenido o historial.** |
| ¿Se revisaron alertas de Security/secret scanning e historial completo? | **No verificado**. No afirmar “seguro” hasta completar. |
| ¿Se inspeccionaron derechos de terceros y licencias de dependencias? | **Pendiente**. |
| ¿Se modificó visibilidad, Pages, producción o secretos? | **No**, esta etapa solo documenta y propone un procedimiento. |

**Conclusión:** código fuente en repositorio público ≠ licencia gratuita de explotación comercial. Sin licencia, los derechos de autor ordinarios continúan aplicándose al código propio; GitHub permite visualizar/forkear conforme a sus condiciones. No se puede asegurar control exclusivo del desarrollo completo sin comprobar autorías, contribuciones y derechos de dependencias.

Referencias oficiales:
- [GitHub — Licencias de repositorio](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [GitHub — Cambio de visibilidad](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [GitHub — Seguridad de secretos](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)

## 2. Decisión de protección recomendada

**No privatizar de golpe `hernanchan/COTIZADOR`.** GitHub advierte que cambiar un repositorio a privado puede despublicar GitHub Pages en determinados planes, y que los forks o copias existentes no desaparecen. Antes de hacerlo, verificar la cadena exacta de publicación y DNS.

**Arquitectura objetivo a evaluar:**
1. Repositorio **privado** principal del producto (motor, servidor, integraciones, automatización y documentación interna).
2. Publicación de páginas estáticas, imágenes y artefactos de frontend necesarios desde un origen compatible con el hosting comercial.
3. Cloudflare ejecuta código backend fuera del alcance de los navegadores; el código JS entregado al navegador **siempre es inspeccionable**, incluso con repositorio privado.
4. Despliegues con credenciales de mínimo privilegio y validación de integridad, manteniendo registro de versiones y posibilidad de rollback.
5. Una configuración por comercio, datos y cobros segregados, si en el futuro se comercializa.

**Nota:** abrir un nuevo repositorio privado no retira de Internet el código ya publicado. Es una medida para futuras versiones, no una reversión retroactiva de exposición.

## 3. Plan de trabajo, por prioridad

### P0 — Sin interrupción comercial

- [x] Confirmar visibilidad del repo y ausencia de licencia declarada.
- [x] Separar documentalmente `main`, integración y la versión realmente desplegada.
- [x] Crear el manual maestro sin claves ni datos de clientes.
- [ ] Verificar dependencia real entre GitHub Pages, Cloudflare y dominios públicos antes de cualquier cambio de visibilidad.
- [ ] Identificar propietario, política de acceso y responsables de cada servicio (sin guardar credenciales aquí).

### P1 — Auditoría de seguridad y respaldo

- [ ] Revisar GitHub **Security → Secret scanning**, incluidos incidentes ya cerrados y alertas vigentes.
- [ ] Analizar archivos versionados, historial Git, Actions logs y artefactos buscando credenciales; registrar hallazgos de forma privada, **nunca en un issue público**.
- [ ] Si se descubre una clave real expuesta: evaluar impacto, **rotarla/revocarla**, sustituirla en servicios y comprobar funcionamiento; borrar texto del repositorio no revoca una clave.
- [ ] Obtener una copia integral recuperable y separada del repositorio, incluyendo ramas y etiquetas relevantes.
- [ ] Ensayar copia/restauración de D1 y configuración de Cloudflare/Supabase, evitando exportar datos reales de clientes a repositorios.
- [ ] Inventariar dependencias `npm`, bibliotecas JS y recursos de terceros y sus licencias.

### P2 — Separación de propiedad tecnológica

- [ ] Crear repositorio privado de desarrollo central con permisos controlados.
- [ ] Migrar código fuente interno y CI de despliegue con precaución, sin tocar en el primer paso `main` ni la web productiva.
- [ ] Verificar que cada release en Cloudflare pueda obtenerse desde repositorio privado.
- [ ] Sustituir las partes públicas por frontend/artefactos de publicación indispensables.
- [ ] Probar acceso público, precio, cotización, pago, archivos, Central, seguimiento y rollback.
- [ ] Recién entonces decidir si `COTIZADOR` continúa público, queda como portal histórico o se cambia de visibilidad.

### P3 — Preparar comercialización hipotética

- [ ] Determinar la **titularidad y derechos** del código, recursos gráficos, fuentes, licencias de terceros y posibles aportes externos.
- [ ] Elegir entre software instalado con licencia o plataforma SaaS operada por el proveedor.
- [ ] Extraer la configuración por negocio: marca, datos fiscales, precios, productos, plazos, medios de pago, horarios y textos.
- [ ] Aislar por comercio pedidos, archivos, bases, accesos, webhooks y medios de pago.
- [ ] Crear procedimiento verificable de alta, soporte, actualización, exportación y baja de un comercio.
- [ ] Preparar términos de servicio, privacidad, protección de datos y contrato comercial con asesoramiento jurídico.
- [ ] **No añadir automáticamente una licencia MIT/Apache/GPL**: una licencia permisiva podría conceder derechos de redistribución no deseados.

## 4. Qué se puede comercializar y qué no se puede prometer

Posibles líneas: licencia de instalación y soporte; servicio mensual hospedado; módulo de presupuestación personalizado. No presentar hoy el sistema como “multitenant listo para vender”: carece de un aislamiento por clientes final verificado. No incluir pedidos reales de Saber como datos de demostración.

La propiedad de una marca, el control de cuentas y los derechos sobre bibliotecas o código de terceros requieren revisión independiente. Que un componente funcione en producción no prueba su aptitud jurídica o comercial para revenderse.

## 5. Reglas permanentes

- No colocar contraseñas, API keys, tokens de Mercado Pago, valores HMAC, datos de clientes ni capturas privadas en Markdown, commits o logs públicos.
- No intentar ocultar código servido al navegador con minificación: es una optimización, **no protección intelectual ni de seguridad**.
- No hacer cambios de visibilidad, nombre de repositorio, ramas de despliegue o DNS sin mapa de dependencias y plan de recuperación.
- Registrar los nuevos hallazgos sensibles fuera del repositorio público y compartir solo resúmenes saneados.
- Distinguir siempre **comprobado**, **pendiente**, **hipótesis** e **implementado**.
