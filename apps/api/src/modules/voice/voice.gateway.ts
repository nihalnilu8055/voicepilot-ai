import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyAuthToken } from '../../services/supabase.js';
import { tenantService } from '../../services/tenantService.js';
import { companyKnowledgeService } from '../../services/companyKnowledgeService.js';
import { geminiLiveService, type GeminiLiveBridge } from './geminiLive.service.js';
import { voiceSessionService } from './voiceSession.service.js';
import type { VoiceLanguage, QualificationOutcome } from '@voicepilot/shared';

export const voiceGateway: FastifyPluginAsync = async (app) => {
  app.get('/live', { websocket: true }, (socket: WebSocket, req) => {
    const params = (req.params as any) || {};
    let tenantId = params.tenantId;
    if (!tenantId && req.url) {
      const match = req.url.match(/\/tenants\/([^/?]+)\/voice/);
      if (match) tenantId = match[1];
    }

    let isAuthenticated = false;
    let userId = '';
    let currentSessionId = '';
    let liveBridge: GeminiLiveBridge | null = null;
    let sessionTimeoutTimer: NodeJS.Timeout | null = null;

    // Send safe JSON helper
    const sendJson = (data: Record<string, any>) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(data));
      }
    };

    // Parse token from query parameter or authorization header
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const queryToken = ((req.query as any)?.token as string | undefined) || parsedUrl.searchParams.get('token') || undefined;

    const verifyAndInitialize = async (token: string, initOptions?: { language?: VoiceLanguage; voiceName?: string; leadId?: string; geminiApiKey?: string }) => {
      try {
        const verifiedUser = await verifyAuthToken(token);
        userId = verifiedUser.id;

        // Verify tenant membership
        let tenant: any;
        try {
          tenant = await tenantService.getTenantById(tenantId, userId);
        } catch (err: any) {
          sendJson({
            type: 'error',
            code: err.statusCode === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
            message: err.message || 'User does not belong to this company',
          });
          setTimeout(() => {
            try { socket.close(1008, 'Forbidden'); } catch { /* ignore */ }
          }, 50);
          return;
        }

        isAuthenticated = true;

        // Fetch company approved knowledge
        const knowledgeItems = await companyKnowledgeService.listKnowledge(tenantId);
        const approvedKnowledge = knowledgeItems.filter((k) => k.isApproved);

        const language: VoiceLanguage = initOptions?.language || 'en-IN';
        const voiceName = initOptions?.voiceName || 'Priya (Warm)';

        // Create Voice Session
        const session = await voiceSessionService.createLiveSession(tenantId, userId, {
          language,
          voiceName,
          leadId: initOptions?.leadId,
        });
        currentSessionId = session.id;

        // Initialize Gemini Live Bridge
        liveBridge = await geminiLiveService.startLiveSession({
          companyName: tenant.name,
          language,
          voiceName,
          personality: 'CONSULTATIVE',
          approvedKnowledge,
          geminiApiKey: initOptions?.geminiApiKey,
          callbacks: {
            onAudioDelta: (pcmBase64) => {
              sendJson({ type: 'audio', data: pcmBase64 });
            },
            onTranscript: async (data) => {
              sendJson({ type: 'transcript', ...data });
              await voiceSessionService.appendTranscriptMessage(
                tenantId,
                currentSessionId,
                data.sender,
                data.text,
                language
              );
            },
            onInterrupted: () => {
              sendJson({ type: 'interrupted' });
            },
            onError: (err) => {
              sendJson({ type: 'error', message: err });
            },
            onClose: (reason) => {
              sendJson({ type: 'session_ended', reason });
            },
          },
        });

        // Set maximum free-tier session duration limit (10 minutes)
        const maxDurationMs = voiceSessionService.getMaxSessionLimitSeconds() * 1000;
        sessionTimeoutTimer = setTimeout(async () => {
          sendJson({
            type: 'limit_reached',
            message: 'Free-tier session duration limit reached (10 minutes). Session concluding.',
          });
          if (liveBridge) await liveBridge.close();
          const ended = await voiceSessionService.endLiveSession(tenantId, currentSessionId, 'QUALIFIED');
          sendJson({ type: 'session_completed', session: ended });
          socket.close(1000, 'Duration limit');
        }, maxDurationMs);

        sendJson({
          type: 'ready',
          sessionId: currentSessionId,
          language,
          voiceName,
          companyName: tenant.name,
          maxDurationSeconds: voiceSessionService.getMaxSessionLimitSeconds(),
        });
      } catch (err: any) {
        sendJson({ type: 'error', code: 'UNAUTHORIZED', message: err.message || 'Authentication failed' });
        setTimeout(() => {
          try { socket.close(1008, 'Unauthorized'); } catch { /* ignore */ }
        }, 50);
      }
    };

    // If token provided in query, verify immediately
    if (queryToken) {
      verifyAndInitialize(queryToken);
    }

    // Message handler
    socket.on('message', async (raw: any) => {
      try {
        let msg: any;
        if (typeof raw === 'string') {
          msg = JSON.parse(raw);
        } else if (raw instanceof Buffer) {
          try {
            msg = JSON.parse(raw.toString('utf-8'));
          } catch {
            // Binary audio chunk received directly
            if (isAuthenticated && liveBridge) {
              const base64Audio = raw.toString('base64');
              await liveBridge.sendAudioChunk(base64Audio);
            }
            return;
          }
        }

        if (!msg) return;

        // Auth message
        if (msg.type === 'auth') {
          await verifyAndInitialize(msg.token, {
            language: msg.language,
            voiceName: msg.voiceName,
            leadId: msg.leadId,
            geminiApiKey: msg.geminiApiKey,
          });
          return;
        }

        if (!isAuthenticated) {
          sendJson({ type: 'error', code: 'UNAUTHORIZED', message: 'Session unauthenticated' });
          socket.close(1008, 'Unauthorized');
          return;
        }

        // Audio chunk (Base64 PCM 16kHz)
        if (msg.type === 'audio' && msg.data && liveBridge) {
          await liveBridge.sendAudioChunk(msg.data);
          return;
        }

        // Text input turn
        if (msg.type === 'text' && msg.text && liveBridge) {
          await liveBridge.sendText(msg.text);
          return;
        }

        // End of user speech turn (Hybrid VAD)
        if (msg.type === 'end_turn' && liveBridge) {
          await liveBridge.sendEndOfTurn();
          return;
        }

        // End session
        if (msg.type === 'end_session') {
          if (liveBridge) {
            await liveBridge.close();
            liveBridge = null;
          }
          if (sessionTimeoutTimer) {
            clearTimeout(sessionTimeoutTimer);
            sessionTimeoutTimer = null;
          }
          const ended = await voiceSessionService.endLiveSession(
            tenantId,
            currentSessionId,
            msg.outcome as QualificationOutcome
          );
          sendJson({ type: 'session_completed', session: ended });
          socket.close(1000, 'Session completed');
          return;
        }
      } catch (err: any) {
        sendJson({ type: 'error', message: err.message || 'Error processing message' });
      }
    });

    // Cleanup on disconnect
    socket.on('close', async () => {
      if (sessionTimeoutTimer) {
        clearTimeout(sessionTimeoutTimer);
        sessionTimeoutTimer = null;
      }
      if (liveBridge) {
        await liveBridge.close();
        liveBridge = null;
      }
      if (isAuthenticated && currentSessionId) {
        await voiceSessionService.endLiveSession(tenantId, currentSessionId);
      }
    });

    socket.on('error', async () => {
      if (liveBridge) {
        await liveBridge.close();
        liveBridge = null;
      }
    });
  });
};
