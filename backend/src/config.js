function integerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be an integer`);
  }
  return value;
}

function boundedIntegerFromEnv(name, fallback, minimum, maximum) {
  const value = integerFromEnv(name, fallback);
  if (value < minimum || value > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const cookieSecure = (process.env.AUTH_COOKIE_SECURE ?? 'false') === 'true';
const configuredOrigins = process.env.AUTH_TRUSTED_ORIGINS;
const trustedOrigins = (configuredOrigins ?? 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const qrSecret = process.env.ATTENDANCE_QR_SECRET ?? 'change-this-attendance-secret-in-development';
const databasePassword = process.env.DB_PASSWORD ?? 'annachill_dev';

if (nodeEnv === 'production') {
  if (!cookieSecure) throw new Error('AUTH_COOKIE_SECURE must be true in production');
  if (!configuredOrigins) throw new Error('AUTH_TRUSTED_ORIGINS must be configured in production');
  if (qrSecret.length < 32 || qrSecret.includes('change-this') || qrSecret.includes('local-development')) {
    throw new Error('ATTENDANCE_QR_SECRET must be a strong secret in production');
  }
  if (databasePassword === 'annachill_dev' || databasePassword.length < 16) {
    throw new Error('DB_PASSWORD must be a strong password in production');
  }
}

export const config = Object.freeze({
  nodeEnv,
  port: integerFromEnv('PORT', 3000),
  store: {
    name: process.env.STORE_NAME ?? 'AnnaChill Beauty',
    adminName: process.env.ADMIN_NAME ?? 'Quản trị hệ thống',
  },
  vietqr: {
    bankBin: process.env.VIETQR_BANK_BIN ?? 'ICB',
    accountNumber: process.env.VIETQR_ACCOUNT_NUMBER ?? '108868686868',
    accountName: process.env.VIETQR_ACCOUNT_NAME ?? 'ANNA CHILL BEAUTY',
  },
  http: {
    trustProxyHops: boundedIntegerFromEnv('TRUST_PROXY_HOPS', 1, 0, 5),
    trustedOrigins: Object.freeze(trustedOrigins),
    apiRateLimit: boundedIntegerFromEnv('API_RATE_LIMIT_PER_MINUTE', 300, 10, 10_000),
    loginRateLimit: boundedIntegerFromEnv('LOGIN_RATE_LIMIT_PER_15_MINUTES', 10, 3, 100),
  },
  auth: {
    sessionHours: boundedIntegerFromEnv('AUTH_SESSION_HOURS', 12, 1, 168),
    cookieSecure,
    qrSecret,
    qrLifetimeSeconds: 15,
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: integerFromEnv('DB_PORT', 5432),
    name: process.env.DB_NAME ?? 'annachill',
    user: process.env.DB_USER ?? 'annachill',
    password: databasePassword,
    maxConnections: integerFromEnv('DB_POOL_SIZE', 10),
  },
});
