-- Migration Script: Add attributes + variant-based pricing to products table
-- Adds:
--   attributes JSON NULL
--   variant_pricing JSON NULL
--
-- Run on your MySQL database (adjust DB name as needed).

ALTER TABLE products
  ADD COLUMN attributes JSON NULL AFTER piece_pricing,
  ADD COLUMN variant_pricing JSON NULL AFTER attributes;

