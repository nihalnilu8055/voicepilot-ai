import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { tenantService } from '../src/services/tenantService.js';
import { companyKnowledgeService } from '../src/services/companyKnowledgeService.js';
import { geminiLiveService } from '../src/modules/voice/geminiLive.service.js';
import { voiceSessionService } from '../src/modules/voice/voiceSession.service.js';
import { conversationEvaluationService } from '../src/services/conversationEvaluationService.js';

const TEST_SECRET = 'voicepilot-gemini-live-jwt-test-secret-444';
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;

function generateTestToken(userId: string, email: string, fullName: string) {
  return jwt.sign(
    {
      sub: userId,
      email,
      user_metadata: { full_name: fullName },
      aud: 'authenticated',
      role: 'authenticated',
    },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

const aliceToken = generateTestToken('usr_alice_live', 'alice@keralaenterprise.com', 'Alice Menon');
const bobToken = generateTestToken('usr_bob_live', 'bob@intruder.com', 'Bob Intruder');

test('VoicePilot AI — Phase 4.2: Gemini Live Voice Engine Test Suite', async (t) => {
  const app = buildApp();

  // Enable test mock modes
  tenantService.setMemoryMode(true);
  tenantService.clearMemoryState();
  companyKnowledgeService.setMemoryMode(true);
  companyKnowledgeService.clearMemoryState();
  geminiLiveService.setMockMode(true);
  voiceSessionService.setMemoryMode(true);
  voiceSessionService.clearMemoryState();
  conversationEvaluationService.setMemoryMode(true);
  conversationEvaluationService.clearMemoryState();

  // Start app on ephemeral port for live WebSocket testing
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address() as { port: number };
  const port = address.port;

  let companyAId = '';
  let companyBId = '';

  await t.test('Setup: Create Company A (Alice = Owner) & Company B (Bob = Owner)', async () => {
    const resA = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { name: 'Kochi Tech Cloud' },
    });
    assert.equal(resA.statusCode, 201);
    companyAId = JSON.parse(resA.body).id;

    const resB = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { name: 'Rival Dialing Corp' },
    });
    assert.equal(resB.statusCode, 201);
    companyBId = JSON.parse(resB.body).id;

    // Add company knowledge
    await companyKnowledgeService.createKnowledge(companyAId, {
      title: 'VoicePilot Enterprise Outbound',
      category: 'PRODUCTS',
      content: 'Autonomous multilingual voice calling with real-time consultative AI agents for Malayalam and Indian English markets.',
      tags: ['Voice', 'AI', 'Sales'],
      isApproved: true,
    });
  });

  await t.test('1. Unauthorized WebSocket Connection is Rejected', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/tenants/${companyAId}/voice/live`);

    const received: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        received.push(JSON.parse(data.toString()));
        ws.close();
        resolve();
      });
      ws.on('close', () => resolve());
      ws.on('open', () => {
        // Send request without auth
        ws.send(JSON.stringify({ type: 'text', text: 'Hello' }));
      });
    });

    assert.ok(received.some((m) => m.type === 'error' && m.code === 'UNAUTHORIZED'));
  });

  await t.test('2. CROSS-TENANT DENIAL: User B cannot connect to Company A voice gateway', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/tenants/${companyAId}/voice/live?token=${bobToken}`);

    const received: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        received.push(JSON.parse(data.toString()));
        ws.close();
        resolve();
      });
      ws.on('close', () => resolve());
    });

    // Bob belongs to Company B, connecting to Company A -> Forbidden
    assert.ok(received.some((m) => m.type === 'error' && m.code === 'FORBIDDEN'));
  });

  await t.test('3. Authenticated WebSocket Handshake & Ready Signal', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/tenants/${companyAId}/voice/live?token=${aliceToken}`);

    const received: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        received.push(msg);
        if (msg.type === 'ready') {
          ws.close();
          resolve();
        }
      });
    });

    const readyMsg = received.find((m) => m.type === 'ready');
    assert.ok(readyMsg);
    assert.ok(readyMsg.sessionId);
    assert.equal(readyMsg.companyName, 'Kochi Tech Cloud');
    assert.equal(readyMsg.maxDurationSeconds, 600); // 10 minutes free tier limit
  });

  await t.test('4. Real-Time Malayalam (ml-IN) Live Dialogue & Audio Streaming', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/tenants/${companyAId}/voice/live`);

    const received: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        // Send auth message specifying Malayalam (ml-IN)
        ws.send(
          JSON.stringify({
            type: 'auth',
            token: aliceToken,
            language: 'ml-IN',
            voiceName: 'Priya (Warm)',
          })
        );
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        received.push(msg);

        // When ready, stream an audio chunk and customer text query
        if (msg.type === 'ready') {
          const mockPcm16k = Buffer.alloc(640).toString('base64');
          ws.send(JSON.stringify({ type: 'audio', data: mockPcm16k }));

          // Customer speaks in Malayalam
          ws.send(
            JSON.stringify({
              type: 'text',
              text: 'നമസ്കാരം, VoicePilot Enterprise Outbound എന്താണ്?',
            })
          );
        }

        // Wait for AI transcript response and audio chunk
        const aiTranscript = received.find(
          (m) => m.type === 'transcript' && m.sender === 'AI' && m.text.includes('VoicePilot')
        );
        const audioReceived = received.some((m) => m.type === 'audio');

        if (aiTranscript && audioReceived) {
          ws.close();
          resolve();
        }
      });
    });

    // Verify audio and Malayalam transcript
    const aiTranscript = received.find(
      (m) => m.type === 'transcript' && m.sender === 'AI'
    );
    assert.ok(aiTranscript);
    assert.match(aiTranscript.text, /[\u0D00-\u0D7F]/); // Malayalam Unicode verified

    const audioMsg = received.find((m) => m.type === 'audio');
    assert.ok(audioMsg);
    assert.ok(audioMsg.data.length > 0);
  });

  await t.test('5. Session Conclusion & Automated Lead Evaluation via WebSocket', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/tenants/${companyAId}/voice/live`);

    let finalSession: any = null;
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token: aliceToken }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ready') {
          // Conclude session with outcome
          ws.send(
            JSON.stringify({
              type: 'end_session',
              outcome: 'QUALIFIED',
            })
          );
        }
        if (msg.type === 'session_completed') {
          finalSession = msg.session;
          ws.close();
          resolve();
        }
      });
    });

    assert.ok(finalSession);
    assert.equal(finalSession.status, 'COMPLETED');
    assert.equal(finalSession.qualificationOutcome, 'QUALIFIED');
    assert.ok(finalSession.evaluation);
    assert.ok(finalSession.evaluation.leadScore >= 60);
  });

  // Teardown HTTP/WS server
  await app.close();
});
