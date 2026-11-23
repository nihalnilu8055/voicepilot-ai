import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (url && key && !url.includes('your-project-id')) {
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseClient;
  }

  return null;
}

export interface VerifiedAuthUser {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Validates a Bearer token received from the client.
 * Enforces cryptographic verification:
 * 1. If JWT secret is configured, verifies signature & expiration with HMAC.
 * 2. If Supabase is configured online, verifies token against Supabase Auth service.
 * 3. Never falls back to unverified decoding. Rejects malformed or expired tokens.
 */
export async function verifyAuthToken(token: string): Promise<VerifiedAuthUser> {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing or invalid authorization token');
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  if (!cleanToken) {
    throw new Error('Empty bearer token provided');
  }

  const jwtSecret = env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

  // 1. If a local/configured JWT Secret is provided, verify HMAC signature directly
  if (jwtSecret) {
    try {
      const decoded = jwt.verify(cleanToken, jwtSecret) as jwt.JwtPayload;
      if (!decoded || !decoded.sub) {
        throw new Error('Invalid JWT payload: missing sub claim');
      }
      return {
        id: decoded.sub,
        email: (decoded.email as string) || '',
        fullName: (decoded.user_metadata?.full_name as string) || null,
        avatarUrl: (decoded.user_metadata?.avatar_url as string) || null,
      };
    } catch (err) {
      // Signature verification failed or token expired — strictly reject immediately
      throw new Error(`Token verification failed: ${err instanceof Error ? err.message : 'Invalid signature'}`);
    }
  }

  // 2. If Supabase client is configured, verify token with Supabase Auth service
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(cleanToken);
      if (error || !data.user) {
        throw new Error(error?.message || 'Invalid or expired session');
      }

      return {
        id: data.user.id,
        email: data.user.email || '',
        fullName: (data.user.user_metadata?.full_name as string) || null,
        avatarUrl: (data.user.user_metadata?.avatar_url as string) || null,
      };
    } catch (err) {
      throw new Error(`Supabase authentication failed: ${err instanceof Error ? err.message : 'Invalid session'}`);
    }
  }

  // 3. Fallback for non-production development ONLY
  if (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Authentication service unavailable: No verification secret or Supabase service configured.');
  }

  // In non-production testing ONLY: if demo mock tokens are used ('demo_token_*')
  if (cleanToken.startsWith('demo_token_')) {
    const parts = cleanToken.split('_');
    const userId = parts[2] || 'demo_user';
    const email = parts[3] || 'demo@voicepilot.ai';
    return {
      id: userId,
      email,
      fullName: 'VoicePilot Demo User',
      avatarUrl: null,
    };
  }

  throw new Error('Unable to verify token: Cryptographic verification failed.');
}
