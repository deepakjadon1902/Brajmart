-- Adds color_variants JSON column to products table (safe migration)
ALTER TABLE products
  ADD COLUMN color_variants JSON NULL AFTER variant_pricing;

