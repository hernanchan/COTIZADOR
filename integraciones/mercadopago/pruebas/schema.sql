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
