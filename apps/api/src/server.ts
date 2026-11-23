import { buildApp } from './app.js';
import { env } from './config/env.js';

async function startServer() {
  const app = buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`\n🚀 VoicePilot AI API is running at: ${address}`);
    console.log(`📡 Health Check endpoint: ${address}/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }
}

startServer();
