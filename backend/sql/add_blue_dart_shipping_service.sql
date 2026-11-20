-- Append Blue Dart so existing courier ENUM indexes stay intact.
ALTER TABLE orders
  MODIFY COLUMN shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart','Shadowfax','Amazon Shipping','Blue Dart') NULL DEFAULT NULL,
  ALGORITHM=INPLACE,
  LOCK=NONE;
