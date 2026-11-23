import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { tenantService } from '../src/services/tenantService.js';
import { leadService } from '../src/services/leadService.js';
import { companyKnowledgeService } from '../src/services/companyKnowledgeService.js';
import { voiceEngineService } from '../src/services/voiceEngineService.js';
import { conversationEvaluationService } from '../src/services/conversationEvaluationService.js';

const TEST_SECRET = 'voicepilot-phase4-test-jwt-secret-xyz888';
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

const aliceToken = generateTestToken('usr_alice_voice', 'alice@enterprise.com', 'Alice Enterprise');
const bobToken = generateTestToken('usr_bob_voice', 'bob@competitor.com', 'Bob Competitor');

test('VoicePilot AI - Phase 4: AI Voice Engine & Knowledge Suite', async (t) => {
  const app = buildApp();

  // Enable in-memory testing mode
  tenantService.setMemoryMode(true);
  tenantService.clearMemoryState();
  leadService.setMemoryMode(true);
  leadService.clearMemoryState();
  companyKnowledgeService.setMemoryMode(true);
  companyKnowledgeService.clearMemoryState();
  voiceEngineService.setMemoryMode(true);
  voiceEngineService.clearMemoryState();
  conversationEvaluationService.setMemoryMode(true);
  conversationEvaluationService.clearMemoryState();

  let companyAId = '';
  let companyBId = '';
  let leadA1Id = '';

  await t.test('Setup: Create Company A (Alice) and Company B (Bob)', async () => {
    const resA = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { name: 'Kerala Cloud Solutions' },
    });
    assert.equal(resA.statusCode, 201);
    companyAId = JSON.parse(resA.body).id;

    const resB = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { name: 'Delta Analytics' },
    });
    assert.equal(resB.statusCode, 201);
    companyBId = JSON.parse(resB.body).id;

    // Create a Lead in Company A
    const resLead = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'Vipin Kumar',
        phoneNumber: '+919876512345',
        companyName: 'Vipin Retails',
        country: 'IN',
        languagePreference: 'ml-IN',
        consentStatus: 'CONSENT_GRANTED',
      },
    });
    assert.equal(resLead.statusCode, 201);
    leadA1Id = JSON.parse(resLead.body).id;

    assert.ok(companyAId);
    assert.ok(companyBId);
  });

  // --- MODULE 1: COMPANY KNOWLEDGE BASE & GROUNDING ---

  let knowledge1Id = '';

  await t.test('1. Company Knowledge: Add approved product catalog to Company A', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/knowledge`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        title: 'ERP Sync Pro',
        category: 'PRODUCTS',
        content: 'Real-time inventory and billing synchronization software supporting GST filing for Indian retail businesses.',
        tags: ['ERP', 'Retail', 'GST'],
        isApproved: true,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.title, 'ERP Sync Pro');
    assert.equal(body.isApproved, true);
    knowledge1Id = body.id;
  });

  await t.test('2. Multi-Tenant Knowledge Isolation: Company B cannot view Company A knowledge (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/knowledge/${knowledge1Id}`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // --- MODULE 2: VOICE SESSIONS & LIVE DIALOGUE ---

  let sessionId = '';

  await t.test('3. Initialize Voice Session: English and Malayalam configurations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/voice/sessions`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        language: 'en-IN',
        voiceName: 'Priya (Warm)',
        personality: 'CONSULTATIVE',
        leadId: leadA1Id,
      },
    });

    assert.equal(res.statusCode, 201);
    const session = JSON.parse(res.body);
    assert.equal(session.status, 'ACTIVE');
    assert.equal(session.voiceName, 'Priya (Warm)');
    assert.equal(session.messages.length, 1); // Initial greeting
    assert.equal(session.messages[0].sender, 'AI');
    sessionId = session.id;
  });

  await t.test('4. Grounded Consultation: AI explains ERP Sync Pro accurately using approved knowledge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/voice/sessions/${sessionId}/messages`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        sessionId,
        text: 'Can you tell me about ERP Sync Pro?',
        language: 'en-IN',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.userMessage.text, 'Can you tell me about ERP Sync Pro?');
    assert.equal(body.aiResponse.sender, 'AI');
    // Confirms knowledge was retrieved and quoted
    assert.match(body.aiResponse.text, /ERP Sync Pro/i);
    assert.match(body.aiResponse.text, /inventory|billing|retail/i);
  });

  await t.test('5. Hallucination Safeguard: AI refuses to invent unverified prices and offers callback', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/voice/sessions/${sessionId}/messages`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        sessionId,
        text: 'What is the exact discounted price for 50 stores right now?',
        language: 'en-IN',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    // Verified guardrail: AI must NOT hallucinate arbitrary dollar/rupee figures
    assert.doesNotMatch(body.aiResponse.text, /₹\s*\d+|\$\s*\d+/);
    assert.match(body.aiResponse.text, /Specialist|call|pricing|accurate/i);
  });

  await t.test('6. Malayalam (ml-IN) Natural Language Dialogue & Switching', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/voice/sessions/${sessionId}/messages`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        sessionId,
        text: 'നമസ്കാരം, ഇത് ചെറുകിട വ്യാപാരികൾക്ക് ഉപയോഗിക്കാൻ എളുപ്പമാണോ?',
        language: 'ml-IN',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.aiResponse.language, 'ml-IN');
    // Verified Malayalam response content
    assert.match(body.aiResponse.text, /[\u0D00-\u0D7F]/); // Contains Malayalam Unicode characters
  });

  await t.test('7. Multi-Tenant Voice Isolation: Company B cannot access Company A voice session (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/voice/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // --- MODULE 3: CALL CONCLUSION & AI EVALUATION ---

  await t.test('8. End Voice Session & Automated Conversation Evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/voice/sessions/${sessionId}/end`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        sessionId,
        qualificationOutcome: 'QUALIFIED',
        callbackTime: '2026-11-25T10:00:00Z',
        notes: 'High intent customer interested in ERP Sync Pro with 5 retail stores.',
      },
    });

    assert.equal(res.statusCode, 200);
    const session = JSON.parse(res.body);
    assert.equal(session.status, 'COMPLETED');
    assert.equal(session.qualificationOutcome, 'QUALIFIED');
    assert.ok(session.evaluation);
    assert.ok(session.evaluation.leadScore >= 50);
    assert.ok(session.evaluation.qualificationSummary.length > 0);
  });

  await t.test('9. Retrieve Final Evaluation Report via API', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/voice/sessions/${sessionId}/evaluation`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });

    assert.equal(res.statusCode, 200);
    const evaluation = JSON.parse(res.body);
    assert.equal(evaluation.sessionId, sessionId);
    assert.ok(evaluation.suggestedNextStep);
  });
});
