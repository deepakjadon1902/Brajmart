import { Router } from 'express';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { dbQuery, isDbConnected } from '../lib/db';
import { merchantOrderWhereSql } from '../lib/orderVisibility';
import {
  createOrUpdateShippingLabel,
  isShippingLabelsConfigured,
  syncShippingLabelForOrder,
  syncShippingLabelsBatch,
} from '../lib/shippingLabels';
import { insertAdminAuditLog } from '../lib/adminAudit';

const router = Router();

router.use(auth, adminOnly);

router.get('/status', (_req, res) => {
  res.json({ configured: isShippingLabelsConfigured() });
});

router.post('/orders/:orderId/label', async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE id = ? AND ${merchantOrderWhereSql('orders')}
       LIMIT 1`,
      [req.params.orderId]
    );
    const order = rows[0];
    if (!order) {
      return res.status(404).json({ message: 'Verified paid/COD order not found' });
    }
    const result = await createOrUpdateShippingLabel(order);
    await insertAdminAuditLog(null, {
      req,
      action: result.created ? 'SHIPPING_LABEL_CREATE' : 'SHIPPING_LABEL_OPEN',
      entityType: 'order',
      entityId: order.id,
      after: {
        labelId: result.label.id,
        courier: result.label.courier_name,
        trackingId: result.label.tracking_id,
        status: result.label.status,
      },
      reason: result.created ? 'Shipping label created in ShippingLabelsDashboard' : 'Existing shipping label reused',
    }).catch(() => {});
    res.status(result.created ? 201 : 200).json(result);
  } catch (error: any) {
    res.status(Number(error?.status) || 500).json({ message: error?.message || 'Unable to create shipping label' });
  }
});

router.post('/orders/:orderId/sync', async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const result = await syncShippingLabelForOrder(req.params.orderId);
    await insertAdminAuditLog(null, {
      req,
      action: 'SHIPPING_LABEL_SYNC',
      entityType: 'order',
      entityId: req.params.orderId,
      after: { orderStatus: result.orderStatus, labelStatus: result.label.status, updated: result.updated },
      reason: 'Courier tracking synchronized from ShippingLabelsDashboard',
    }).catch(() => {});
    res.json(result);
  } catch (error: any) {
    res.status(Number(error?.status) || 500).json({ message: error?.message || 'Unable to sync shipping label' });
  }
});

router.post('/sync', async (req: AuthRequest, res) => {
  try {
    const result = await syncShippingLabelsBatch();
    await insertAdminAuditLog(null, {
      req,
      action: 'SHIPPING_LABEL_SYNC_BATCH',
      entityType: 'shipping_labels',
      entityId: 'batch',
      after: result,
      reason: 'Manual ShippingLabelsDashboard batch sync',
    }).catch(() => {});
    res.json(result);
  } catch (error: any) {
    res.status(Number(error?.status) || 500).json({ message: error?.message || 'Unable to sync shipping labels' });
  }
});

export default router;
