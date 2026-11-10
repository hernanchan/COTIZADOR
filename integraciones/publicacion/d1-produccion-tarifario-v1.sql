-- Librería Saber: estructura del tarifario de PRODUCCIÓN, SIN sembrar precios de ensayo.
-- Aplicar únicamente a saber-pagos-produccion, tras verificar base/UUID.
-- Sin approval inicial: cualquier lectura LIVE debe fallar cerrada (409).
CREATE TABLE IF NOT EXISTS central_pricing_admin_head (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL DEFAULT 0,
 approved_revision INTEGER NOT NULL DEFAULT 0,
 draft_json TEXT,
 approved_json TEXT,
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS central_pricing_admin_history (
 revision INTEGER PRIMARY KEY,
 action TEXT NOT NULL CHECK(action IN ('draft','approve','restore')),
 operator TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 changed_count INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
-- NO INSERT INTO ... valores o precios: requiere validación y aprobación comercial.
