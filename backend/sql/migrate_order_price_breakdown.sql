-- Preserve the exact checkout price breakdown on every new order.
ALTER TABLE orders
  ADD COLUMN items_subtotal DECIMAL(10,2) NULL AFTER items,
  ADD COLUMN packaging_amount DECIMAL(10,2) NULL AFTER items_subtotal,
  ADD COLUMN packaging_rate DECIMAL(5,2) NULL AFTER packaging_amount,
  ADD COLUMN shipping_amount DECIMAL(10,2) NULL AFTER packaging_rate;

-- Keep tax_rate temporarily for compatibility with an older deployed backend.
ALTER TABLE settings ADD COLUMN packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER tax_rate;
UPDATE settings SET packaging_rate = tax_rate;

-- Product subtotal can be recovered reliably for legacy orders. Packaging and shipping
-- remain NULL because they cannot be separated safely from the historical total.
