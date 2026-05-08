-- Migration Script: Add sizes + piece-based pricing to products table
-- Adds:
--   sizes JSON NULL
--   piece_pricing JSON NULL
--
-- Run on your MySQL database (adjust DB name as needed).

ALTER TABLE products
  ADD COLUMN sizes JSON NULL AFTER description,
  ADD COLUMN size_pricing JSON NULL AFTER sizes,
  ADD COLUMN piece_pricing JSON NULL AFTER size_pricing;
