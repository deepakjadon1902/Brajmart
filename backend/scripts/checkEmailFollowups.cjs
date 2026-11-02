const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { isIP } = require('node:net');
const { inspectEmailFollowupSchema, describeEmailFollowupFailure } = require('../src/lib/emailFollowupHealth');
const { isFollowupEmailProviderConfigured, shouldStartCartReminderScheduler } = require('../src/lib/cartFollowups');

// Read-only by design: no worker invocation, queue updates, email submissions,
// recipient reads, schema migrations, or raw connection/provider errors.
async function main() {
  const report = {
    workerEnabled: shouldStartCartReminderScheduler(),
    providerConfigured: isFollowupEmailProviderConfigured(),
    databaseAddressType: isIP(process.env.DB_HOST || '') === 6 ? 'ipv6' : isIP(process.env.DB_HOST || '') === 4 ? 'ipv4' : 'hostname',
    databaseConnected: false,
    schemaReady: false,
  };
  let connection;
  try {
    const missingConfig = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter(key => !String(process.env[key] || '').trim());
    if (missingConfig.length) {
      console.log(JSON.stringify({ ...report, code: 'DATABASE_CONFIG_INCOMPLETE', missingConfig }, null, 2));
      process.exitCode = 1;
      return;
    }
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      connectTimeout: process.env.DB_CONNECT_TIMEOUT_MS ? Number(process.env.DB_CONNECT_TIMEOUT_MS) : 10_000,
    });
    report.databaseConnected = true;
    const issues = await inspectEmailFollowupSchema(async (sql, params) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    });
    report.schemaReady = issues.length === 0;
    const action = issues.length
      ? 'Review backend/sql/migrate_email_followups.sql against the intended application database; apply missing schema through the reviewed migration process.'
      : !report.providerConfigured
        ? 'Configure EMAIL_PROVIDER=resend, RESEND_API_KEY and a verified EMAIL_FROM before enabling the worker.'
        : 'Database schema and provider configuration are ready. This check does not verify sender ownership or send email.';
    console.log(JSON.stringify({ ...report, issues, action }, null, 2));
    if (issues.length || !report.providerConfigured) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ ...report, ...describeEmailFollowupFailure(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end().catch(() => connection.destroy());
  }
}
void main();
