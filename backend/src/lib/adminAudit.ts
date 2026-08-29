import { PoolConnection } from 'mysql2/promise';
import { AuthRequest } from '../middleware/auth';
import { dbExecute, dbQuery } from './db';

const SENSITIVE_KEY_PATTERN = /(password|secret|token|otp|jwt|authorization|cookie|razorpay.*secret|webhook.*secret|key_secret|private_key|api_key)/i;

const cleanText = (value: unknown, max = 255) => String(value ?? '').trim().slice(0, max);

const sanitize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitize(child);
    }
    return output;
  }
  return value;
};

export const actorFromRequest = (req: AuthRequest) => ({
  adminId: cleanText(req.user?.id, 80),
  adminEmail: cleanText(req.user?.email, 255),
});

export const ensureAdminAuditLogTable = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_id VARCHAR(80) NULL,
      admin_email VARCHAR(255) NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(120) NOT NULL,
      before_data JSON NULL,
      after_data JSON NULL,
      reason VARCHAR(255) NULL,
      metadata JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_audit_created (created_at),
      KEY idx_admin_audit_action (action),
      KEY idx_admin_audit_entity (entity_type, entity_id),
      KEY idx_admin_audit_admin (admin_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

export const insertAdminAuditLog = async (
  connection: Pick<PoolConnection, 'execute'> | null,
  input: {
    req?: AuthRequest;
    action: string;
    entityType: string;
    entityId: string | number;
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: unknown;
  }
) => {
  const actor = input.req ? actorFromRequest(input.req) : { adminId: '', adminEmail: '' };
  const params = [
    actor.adminId || null,
    actor.adminEmail || null,
    cleanText(input.action, 80),
    cleanText(input.entityType, 80),
    cleanText(input.entityId, 120),
    input.before === undefined ? null : JSON.stringify(sanitize(input.before)),
    input.after === undefined ? null : JSON.stringify(sanitize(input.after)),
    input.reason ? cleanText(input.reason, 255) : null,
    input.metadata === undefined ? null : JSON.stringify(sanitize(input.metadata)),
  ];
  const sql = `
    INSERT INTO admin_audit_logs
      (admin_id, admin_email, action, entity_type, entity_id, before_data, after_data, reason, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  if (connection) {
    await connection.execute(sql, params);
  } else {
    await dbExecute(sql, params);
  }
};

export const fetchAdminAuditLogs = async (filters: {
  q?: string;
  action?: string;
  entityType?: string;
  admin?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => {
  await ensureAdminAuditLogTable();
  const where: string[] = [];
  const params: unknown[] = [];
  const q = cleanText(filters.q, 120);
  const action = cleanText(filters.action, 80);
  const entityType = cleanText(filters.entityType, 80);
  const admin = cleanText(filters.admin, 120);
  const from = cleanText(filters.from, 30);
  const to = cleanText(filters.to, 30);
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(10, Number(filters.limit || 25)));

  if (q) {
    where.push('(action LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR reason LIKE ? OR admin_email LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (action && action !== 'ALL') {
    where.push('action = ?');
    params.push(action);
  }
  if (entityType && entityType !== 'ALL') {
    where.push('entity_type = ?');
    params.push(entityType);
  }
  if (admin) {
    where.push('admin_email LIKE ?');
    params.push(`%${admin}%`);
  }
  if (from) {
    where.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('created_at <= ?');
    params.push(to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRows = await dbQuery<any>(`SELECT COUNT(*) AS count FROM admin_audit_logs ${whereSql}`, params);
  const rows = await dbQuery<any>(
    `SELECT *
     FROM admin_audit_logs
     ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return {
    page,
    limit,
    total: Number(countRows[0]?.count || 0),
    totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.count || 0) / limit)),
    items: rows.map((row: any) => ({
      id: String(row.id),
      adminId: row.admin_id || '',
      adminEmail: row.admin_email || '',
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      beforeData: row.before_data,
      afterData: row.after_data,
      reason: row.reason || '',
      metadata: row.metadata,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
  };
};
