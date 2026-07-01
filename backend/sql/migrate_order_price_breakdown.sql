-- Preserve the exact checkout price breakdown on every new order.
ALTER TABLE orders
  ADD COLUMN items_subtotal DECIMAL(10,2) NULL AFTER items,
  ADD COLUMN packaging_amount DECIMAL(10,2) NULL AFTER items_subtotal,
  ADD COLUMN packaging_rate DECIMAL(5,2) NULL AFTER packaging_amount,
  ADD COLUMN shipping_amount DECIMAL(10,2) NULL AFTER packaging_rate;

-- The old Tax Rate admin field becomes the Packaging Cost percentage. Preserve
-- its current numeric value so an existing value of 5 becomes 5% packaging.
ALTER TABLE settings CHANGE COLUMN tax_rate packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Product subtotal can be recovered reliably for legacy orders. Packaging and shipping
-- remain NULL because they cannot be separated safely from the historical total.
