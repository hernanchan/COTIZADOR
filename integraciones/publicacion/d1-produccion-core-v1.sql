-- Librería Saber: D1 núcleo de pedidos PRODUCCIÓN, primera migración.
-- APLICAR SOLO a base saber-pagos-produccion (nunca sandbox).
-- DDL idempotente. NO incluye precios, pedidos, MP, sesiones ni secretos.
-- Mantener compatibilidad exacta con las tablas usadas por Central LIVE.
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
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 line_number INTEGER NOT NULL CHECK(line_number BETWEEN 1 AND 100),
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
CREATE TABLE IF NOT EXISTS payment_reviews (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 state TEXT NOT NULL CHECK(state IN ('verified','revoked')),
 checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS central_work_order_numbers (
 number INTEGER PRIMARY KEY AUTOINCREMENT,
 commercial_order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
 assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS central_order_contacts (
 order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
 phone TEXT NOT NULL CHECK(length(phone) BETWEEN 10 AND 26),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS central_r2_universal_drafts (
 web_order_id TEXT PRIMARY KEY,
 draft_id TEXT NOT NULL UNIQUE,
 quote_hash TEXT NOT NULL,
 price_revision TEXT NOT NULL,
 total_ars INTEGER NOT NULL CHECK(total_ars>0),
 file_count INTEGER NOT NULL CHECK(file_count BETWEEN 1 AND 10),
 armados_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'draft_not_payable' CHECK(state='draft_not_payable'),
 created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS central_r2_universal_files (
 web_order_id TEXT NOT NULL REFERENCES central_r2_universal_drafts(web_order_id),
 file_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL,
 name TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 transport TEXT NOT NULL CHECK(transport IN ('tus','r2')),
 service TEXT NOT NULL,
 work_json TEXT NOT NULL,
 received INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(web_order_id,file_id),
 UNIQUE(web_order_id,ordinal)
);
CREATE TABLE IF NOT EXISTS central_r2_universal_order_links (
 web_order_id TEXT PRIMARY KEY REFERENCES central_r2_universal_drafts(web_order_id) ON DELETE RESTRICT,
 commercial_order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
 quote_hash TEXT NOT NULL,
 amount_ars INTEGER NOT NULL CHECK(amount_ars>0),
 created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
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
CREATE TABLE IF NOT EXISTS live_checkout_locks (
 order_id TEXT PRIMARY KEY,
 expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS live_checkout_attempts (
 order_id TEXT PRIMARY KEY,
 started_at TEXT NOT NULL DEFAULT(datetime('now'))
);
