Activar solamente la compuerta DOCS_SANDBOX_CHECKOUT_ENABLED=PRIVATE_TEST_ONLY en saber-pagos-pruebas, tras pruebas y comprobación de credenciales sandbox. No habilitar checkout comercial, no crear preferencias automáticamente. Exigir HTTP401 administrativo, health con pagos comerciales deshabilitados y rollback.

2026-11-02 — Reintento privado con espera de propagación Cloudflare y diagnóstico limitado a códigos HTTP; rollback y bloqueo comercial conservados.

2026-11-02 — Actualizar exclusivamente Worker privado saber-pagos-pruebas con corrección Checkout Pro init_point + vendedor test_user (commit 8c452bb, CI 41461600220 success). Conservar pagos comerciales cerrados, HMAC, estado D1, barrera seller test; verificación y rollback automático. No generar preferencias ni realizar pagos en despliegue.
