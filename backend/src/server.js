import { createApp } from './app.js';
import { assertProductionDatabaseSafety, closeDatabase, runMigrations } from './db.js';
import { config } from './config.js';

await runMigrations();

if (config.nodeEnv === 'production') await assertProductionDatabaseSafety();

const app = createApp();
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api] listening on port ${config.port} (${config.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`[api] received ${signal}, shutting down`);
  server.close(async () => {
    try {
      await closeDatabase();
      process.exit(0);
    } catch (error) {
      console.error('[api] graceful shutdown failed', error);
      process.exit(1);
    }
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
