import { buildApp } from '../src/app.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

let app: ReturnType<typeof buildApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!app) {
    app = buildApp();
    await app.ready();
  }
  app.server.emit('request', req, res);
}
