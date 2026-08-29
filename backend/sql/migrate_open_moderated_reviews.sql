-- Open moderated reviews.
-- Allows registered users and guests to submit pending product feedback.
-- Verified Purchase remains reserved for reviews tied to delivered eligible orders.

ALTER TABLE reviews MODIFY user_id BIGINT UNSIGNED NULL;
ALTER TABLE reviews MODIFY order_id BIGINT UNSIGNED NULL;

ALTER TABLE reviews ADD COLUMN reviewer_type ENUM('USER','GUEST') NOT NULL DEFAULT 'USER' AFTER is_verified_purchase;
ALTER TABLE reviews ADD COLUMN guest_name VARCHAR(120) NULL AFTER reviewer_type;
ALTER TABLE reviews ADD COLUMN guest_email VARCHAR(190) NULL AFTER guest_name;

CREATE INDEX idx_reviews_guest_product_email ON reviews (product_id, guest_email, status, created_at);
