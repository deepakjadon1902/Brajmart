import { PoolConnection } from 'mysql2/promise';

export const approvedReviewAggregateSql = `
  SELECT
    product_id,
    COUNT(*) AS real_review_count,
    ROUND(AVG(rating), 1) AS real_rating,
    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5,
    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4,
    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3,
    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2,
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1
  FROM reviews
  WHERE status = 'APPROVED'
  GROUP BY product_id
`;

export const recalculateProductReviewAggregate = async (connection: PoolConnection, productId: string | number) => {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average_rating
     FROM reviews
     WHERE product_id = ? AND status = 'APPROVED'`,
    [productId]
  );
  const row = (rows as any[])[0] || {};
  const count = Number(row.count || 0);
  const average = count > 0 ? Math.min(5, Math.max(0, Number(row.average_rating || 0))) : 0;
  await connection.execute(
    'UPDATE products SET rating = ?, review_count = ?, updated_at = NOW() WHERE id = ?',
    [average, count, productId]
  );
  return { averageRating: average, reviewCount: count };
};
