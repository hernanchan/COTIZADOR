-- Base D1 aislada para PRUEBAS: no aplicar en producción.
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 description TEXT NOT NULL,
 amount_ars INTEGER NOT NULL CHECK(amount_ars>0),
 deposit_ars INTEGER NOT NULL CHECK(deposit_ars>0 AND deposit_ars<=amount_ars),
 currency TEXT NOT NULL DEFAULT 'ARS' CHECK(currency='ARS'),
 status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','paid')),
 preference_id TEXT UNIQUE,
 payment_id TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Líneas de pedido: detalle únicamente accesible desde el Centro de Pedidos privado.
-- Los importes deben proceder de un presupuesto validado en el backend.
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 line_number INTEGER NOT NULL CHECK(line_number>=1 AND line_number<=100),
 item_type TEXT NOT NULL CHECK(item_type IN ('product','print')),
 sku TEXT,
 title TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0),
 unit_price_ars INTEGER NOT NULL CHECK(unit_price_ars>0),
 line_total_ars INTEGER NOT NULL CHECK(line_total_ars>0),
 detail_json TEXT NOT NULL DEFAULT '{}',
 file_references_json TEXT NOT NULL DEFAULT '[]',
 PRIMARY KEY(order_id,line_number)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Idempotencia: repetir el envío de un mismo carrito no debe crear otra orden.
CREATE TABLE IF NOT EXISTS cart_requests (
 client_order_id TEXT PRIMARY KEY,
 request_hash TEXT NOT NULL,
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE
);

-- Constancias emitidas tras verificar Google Drive mediante uploadKey (no se guarda la clave).
-- Solo pruebas y sin almacenamiento de fotografías en esta base.
CREATE TABLE IF NOT EXISTS polaroid_proofs (
 proof_token TEXT PRIMARY KEY,
 reference TEXT NOT NULL UNIQUE,
 client_order_id TEXT NOT NULL,
 photos INTEGER NOT NULL CHECK(photos BETWEEN 1 AND 60),
 sheets INTEGER NOT NULL CHECK(sheets BETWEEN 1 AND 10),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS polaroid_redemptions (
 proof_token TEXT PRIMARY KEY REFERENCES polaroid_proofs(proof_token),
 order_id TEXT NOT NULL REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_polaroid_proofs_client ON polaroid_proofs(client_order_id);

CREATE TABLE IF NOT EXISTS payment_reviews (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 state TEXT NOT NULL CHECK(state IN ('verified','revoked')),
 checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checkout_sessions (
 token_hash TEXT PRIMARY KEY,
 client_order_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS checkout_locks (
 order_id TEXT PRIMARY KEY,
 expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reconciliation_checks (
 order_id TEXT PRIMARY KEY,
 checked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS checkout_attempts (
 order_id TEXT PRIMARY KEY,
 started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Estado del último disparo AUTOMÁTICO. No cuenta sincronizaciones manuales.
-- Una sola fila, sin guardar tokens ni datos personales.
CREATE TABLE IF NOT EXISTS cron_health (
 id INTEGER PRIMARY KEY CHECK(id=1),
 started_at TEXT,
 finished_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('running','ok','errors','failed')),
 checked INTEGER NOT NULL DEFAULT 0,
 registered INTEGER NOT NULL DEFAULT 0,
 errors INTEGER NOT NULL DEFAULT 0
);

-- Central de Pedidos: manifiestos de PDFs verificados por el backend privado.
-- Se conserva aparte del pago hasta que un pedido comercial coincidente
-- pueda vincularse sin ambigüedad. Nada de blobs, enlaces públicos o claves.
CREATE TABLE IF NOT EXISTS central_document_manifests (
 web_order_id TEXT PRIMARY KEY,
 commercial_order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
 amount_ars INTEGER NOT NULL CHECK(amount_ars>0 AND amount_ars<=50000000),
 file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 30),
 manifest_hash TEXT NOT NULL,
 manifest_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'verified_waiting_order'
  CHECK(status IN ('verified_waiting_order','linked_waiting_payment','linked_paid_pending_preparation')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 linked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_central_manifests_commercial_order
 ON central_document_manifests(commercial_order_id);
CREATE TABLE IF NOT EXISTS central_bridge_requests (
 request_id TEXT PRIMARY KEY,
 request_hash TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('stage','link')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
