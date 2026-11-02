import { dbQuery } from './db';

// Only application-owned schema names appear in diagnostics. Never include raw
// MySQL messages, SQL, parameters, provider responses, or recipient records.
const requiredColumns = {
  email_contact_preferences: ['email', 'user_id', 'customer_name', 'cart_reminder_consent', 'offer_email_consent', 'whatsapp_followup_consent', 'cart_reminder_consented_at', 'offer_email_consented_at', 'whatsapp_followup_consented_at', 'consent_source', 'consent_version', 'created_at', 'updated_at'],
  cart_reminder_jobs: ['id', 'email', 'user_id', 'customer_name', 'items', 'items_subtotal', 'activity_at', 'due_at', 'status', 'attempts', 'idempotency_key', 'last_error', 'created_at', 'updated_at'],
  email_unsubscribe_tokens: ['token_hash', 'email', 'created_at', 'used_at'],
  offer_email_deliveries: ['id', 'campaign_key', 'coupon_id', 'email', 'customer_name', 'status', 'attempts', 'idempotency_key', 'last_error', 'created_at', 'updated_at'],
} as const;

export type FollowupSchemaIssue = {
  table: keyof typeof requiredColumns;
  missingTable?: true;
  missingColumns?: string[];
  missingStatuses?: string[];
};
type ColumnRow = { tableName: string; columnName: string; columnType: string };
type SchemaQuery = (sql: string, params: string[]) => Promise<ColumnRow[]>;

export const inspectEmailFollowupSchema = async (query: SchemaQuery = dbQuery): Promise<FollowupSchemaIssue[]> => {
  const tables = Object.keys(requiredColumns) as (keyof typeof requiredColumns)[];
  const rows = await query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => '?').join(',')})`,
    tables,
  );
  const issues: FollowupSchemaIssue[] = [];
  for (const table of tables) {
    const columns = rows.filter(row => row.tableName === table);
    if (!columns.length) {
      issues.push({ table, missingTable: true });
      continue;
    }
    const missingColumns = requiredColumns[table].filter(name => !columns.some(row => row.columnName === name));
    if (missingColumns.length) issues.push({ table, missingColumns });
    const statusType = columns.find(row => row.columnName === 'status')?.columnType || '';
    if (/^enum\(/i.test(statusType)) {
      const missingStatuses = ['pending', 'sending', 'sent', 'cancelled', 'failed', 'uncertain'].filter(status => !statusType.includes(`'${status}'`));
      if (missingStatuses.length) issues.push({ table, missingStatuses });
    }
  }
  return issues;
};

export class EmailFollowupSchemaError extends Error {
  constructor(public readonly issues: FollowupSchemaIssue[]) {
    super('Email follow-up schema is incomplete. Review backend/sql/migrate_email_followups.sql for the intended application database.');
    this.name = 'EmailFollowupSchemaError';
  }
}

export class EmailFollowupBatchError extends Error {
  constructor(public readonly stage: string, public readonly failure: unknown) {
    super('Email follow-up batch could not finish');
    this.name = 'EmailFollowupBatchError';
  }
}

const knownErrors: Record<string, string> = {
  ER_NO_SUCH_TABLE: 'A required table is missing. Review the follow-up migration for the intended database.',
  ER_BAD_FIELD_ERROR: 'A required column is missing. Review the deployed database schema.',
  ER_TABLEACCESS_DENIED_ERROR: 'The database user lacks permission for a required table.',
  ER_COLUMNACCESS_DENIED_ERROR: 'The database user lacks permission for a required column.',
  ER_DBACCESS_DENIED_ERROR: 'The database user cannot access the configured database.',
  ER_ACCESS_DENIED_ERROR: 'MySQL authentication was rejected. Check the backend database configuration.',
  ER_BAD_DB_ERROR: 'The configured application database does not exist.',
  ER_LOCK_DEADLOCK: 'A database deadlock interrupted the batch. The next scheduled batch can retry.',
  ER_LOCK_WAIT_TIMEOUT: 'A database lock timed out. Check database load and long transactions.',
  ER_DATA_TOO_LONG: 'A stored value exceeds the deployed column size. Review the database schema.',
  WARN_DATA_TRUNCATED: 'A stored value does not match the deployed column type. Review the database schema.',
  EACCES: 'The database connection was blocked. Check network access to the configured MySQL server.',
  ECONNREFUSED: 'MySQL refused the connection. Check the database service and port.',
  ECONNRESET: 'The MySQL connection was reset. Check database and network availability.',
  ETIMEDOUT: 'The MySQL connection timed out. Check database availability, firewall and IP access rules.',
  ENOTFOUND: 'The database hostname could not be resolved. Check DB_HOST and DNS.',
  EAI_AGAIN: 'Database DNS resolution is temporarily unavailable.',
  PROTOCOL_CONNECTION_LOST: 'The MySQL connection was lost. Check database and network availability.',
};

export const describeEmailFollowupFailure = (error: unknown, defaultStage = 'database-check') => {
  const stage = error instanceof EmailFollowupBatchError ? error.stage : defaultStage;
  const failure = error instanceof EmailFollowupBatchError ? error.failure : error;
  if (failure instanceof EmailFollowupSchemaError) {
    return { stage, code: 'EMAIL_FOLLOWUP_SCHEMA_INCOMPLETE', action: failure.message, issues: failure.issues };
  }
  const code = typeof failure === 'object' && failure !== null && 'code' in failure ? String(failure.code) : '';
  const known = Object.prototype.hasOwnProperty.call(knownErrors, code);
  return {
    stage,
    code: known ? code : 'FOLLOWUP_BATCH_FAILED',
    action: known ? knownErrors[code] : 'Run npm run check:email-followups in the backend directory to inspect configuration and schema. No recipient data is logged.',
  };
};
