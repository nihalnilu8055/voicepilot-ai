import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAuthToken, type VerifiedAuthUser } from '../services/supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: VerifiedAuthUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authorization header is missing. Please provide a Bearer token.',
    });
  }

  try {
    const user = await verifyAuthToken(authHeader);
    request.user = user;
  } catch (error) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid or expired authentication token',
    });
  }
}
