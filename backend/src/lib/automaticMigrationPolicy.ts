import path from 'node:path';

const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase();

export type AutomaticMigrationDecision = {
  allowed: boolean;
  reason:
    | 'explicit_local_development_opt_in'
    | 'opt_in_missing'
    | 'production_forbidden'
    | 'staging_forbidden'
    | 'unknown_environment'
    | 'inconsistent_environment'
    | 'local_context_missing'
    | 'deployment_context_detected'
    | 'database_target_not_local'
    | 'database_name_not_local'
    | 'database_identity_not_confirmed'
    | 'local_cli_invocation_missing';
};

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Automatic application migrations are restricted to an explicitly marked,
 * non-CI local development process using a loopback MySQL target and a
 * separately confirmed local schema name. Hosted development/staging labels
 * are not sufficient evidence that a process or database is local.
 */
export const resolveAutomaticMigrationDecision = (
  env: NodeJS.ProcessEnv = process.env,
): AutomaticMigrationDecision => {
  const appEnv = normalized(env.APP_ENV);
  const nodeEnv = normalized(env.NODE_ENV);
  if (appEnv === 'production' || nodeEnv === 'production') return { allowed: false, reason: 'production_forbidden' };
  if (appEnv === 'staging' || normalized(env.VERCEL_ENV) === 'preview') return { allowed: false, reason: 'staging_forbidden' };
  if (!['development', 'dev'].includes(appEnv)) return { allowed: false, reason: 'unknown_environment' };
  if (!['development', 'dev'].includes(nodeEnv)) return { allowed: false, reason: 'inconsistent_environment' };
  if (normalized(env.RUN_DATA_MIGRATIONS) !== 'true') return { allowed: false, reason: 'opt_in_missing' };
  if (normalized(env.MIGRATION_EXECUTION_CONTEXT) !== 'local-cli'
      || normalized(env.MIGRATION_LOCAL_ONLY_CONFIRMATION) !== 'yes-local-development-db') {
    return { allowed: false, reason: 'local_context_missing' };
  }
  if (normalized(env.CI) === 'true'
      || normalized(env.RENDER) === 'true'
      || Boolean(normalized(env.RENDER_SERVICE_ID))
      || normalized(env.VERCEL) === '1'
      || Boolean(normalized(env.VERCEL_URL))) {
    return { allowed: false, reason: 'deployment_context_detected' };
  }

  const dbHost = normalized(env.DB_HOST).replace(/^\[|\]$/g, '');
  if (!loopbackHosts.has(dbHost)) return { allowed: false, reason: 'database_target_not_local' };
  const dbName = normalized(env.DB_NAME);
  const confirmedName = normalized(env.LOCAL_MIGRATION_DB_NAME);
  if (!dbName || dbName !== confirmedName || !/(?:_local|_dev|_test)$/.test(dbName)) {
    return { allowed: false, reason: 'database_name_not_local' };
  }
  const expectedHostname = normalized(env.LOCAL_MIGRATION_DB_HOSTNAME);
  const expectedServerId = normalized(env.LOCAL_MIGRATION_DB_SERVER_ID);
  const expectedPort = normalized(env.LOCAL_MIGRATION_DB_PORT);
  const configuredPort = normalized(env.DB_PORT) || '3306';
  if (!expectedHostname || !/^\d+$/.test(expectedServerId) || Number(expectedServerId) < 1
      || !/^\d+$/.test(expectedPort) || Number(expectedPort) < 1 || Number(expectedPort) > 65_535
      || expectedPort !== configuredPort) {
    return { allowed: false, reason: 'database_identity_not_confirmed' };
  }
  return { allowed: true, reason: 'explicit_local_development_opt_in' };
};

export const isConfirmedLocalMigrationDatabaseIdentity = (
  expected: { databaseName: string; hostname: string; serverId: string; port: string },
  actual: { databaseName: unknown; hostname: unknown; serverId: unknown; port: unknown },
) => String(actual.databaseName || '').toLowerCase() === expected.databaseName.toLowerCase()
  && String(actual.hostname || '').toLowerCase() === expected.hostname.toLowerCase()
  && String(actual.serverId || '') === expected.serverId
  && String(actual.port || '') === expected.port;

export const isLocalMigrationCliInvocation = (argv: string[] = process.argv) => {
  const entrypoint = String(argv[1] || '').replace(/\\/g, '/');
  return path.posix.basename(entrypoint).toLowerCase().match(/^migratelocal\.(?:ts|js)$/) !== null
    && path.posix.basename(path.posix.dirname(entrypoint)).toLowerCase() === 'scripts';
};

export const runAutomaticMigrationsIfAllowed = async (
  env: NodeJS.ProcessEnv,
  runDataMigrations: () => Promise<unknown>,
  argv: string[] = process.argv,
) => {
  const decision = resolveAutomaticMigrationDecision(env);
  if (!decision.allowed) return decision;
  if (!isLocalMigrationCliInvocation(argv)) return { allowed: false, reason: 'local_cli_invocation_missing' as const };
  await runDataMigrations();
  return decision;
};
