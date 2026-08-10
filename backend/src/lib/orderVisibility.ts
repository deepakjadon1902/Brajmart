export const paidOnlinePaymentExistsSql = (orderAlias = 'o') => `(
  EXISTS (
    SELECT 1
    FROM payments vp
    WHERE vp.order_id = ${orderAlias}.id
      AND vp.status = 'paid'
  )
  OR EXISTS (
    SELECT 1
    FROM payment_status vps
    WHERE vps.order_id = ${orderAlias}.id
      AND vps.status = 'paid'
  )
)`;

export const merchantOrderWhereSql = (orderAlias = 'o') => `(
  LOWER(${orderAlias}.payment_method) IN ('cod', 'cash on delivery')
  OR ${paidOnlinePaymentExistsSql(orderAlias)}
)`;

export const finalPaymentWhereSql = (paymentAlias = 'p') =>
  `${paymentAlias}.status IN ('paid', 'failed', 'refunded')`;
