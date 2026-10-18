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
