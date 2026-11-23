import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { tenantService } from '../src/services/tenantService.js';
import { leadService } from '../src/services/leadService.js';
import { campaignService } from '../src/services/campaignService.js';
import { dashboardService } from '../src/services/dashboardService.js';

const TEST_SECRET = 'voicepilot-phase3-test-jwt-secret-abc999';
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

const aliceToken = generateTestToken('usr_alice_123', 'alice@acme.com', 'Alice Smith');
const bobToken = generateTestToken('usr_bob_456', 'bob@beta.com', 'Bob Jones');
const agentToken = generateTestToken('usr_agent_789', 'agent@acme.com', 'Acme Agent');

test('VoicePilot AI - Phase 3: Lead & Campaign Management Test Suite', async (t) => {
  const app = buildApp();

  // Enable test memory mode
  tenantService.setMemoryMode(true);
  tenantService.clearMemoryState();
  leadService.setMemoryMode(true);
  leadService.clearMemoryState();
  campaignService.setMemoryMode(true);
  campaignService.clearMemoryState();
  dashboardService.setMemoryMode(true);

  let companyAId = '';
  let companyBId = '';

  // Setup Company A and Company B
  await t.test('Setup: Create Company A (Alice = Owner) and Company B (Bob = Owner)', async () => {
    const resA = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { name: 'Acme Enterprise' },
    });
    assert.equal(resA.statusCode, 201);
    companyAId = JSON.parse(resA.body).id;

    // Add Agent to Company A
    await tenantService.ensureUserProfile({
      id: 'usr_agent_789',
      email: 'agent@acme.com',
      fullName: 'Acme Agent',
    });
    tenantService.addMemberInMemory(companyAId, 'usr_agent_789', 'AGENT');

    const resB = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { name: 'Beta Logistics' },
    });
    assert.equal(resB.statusCode, 201);
    companyBId = JSON.parse(resB.body).id;

    assert.ok(companyAId);
    assert.ok(companyBId);
  });

  let leadA1Id = '';

  // --- MODULE 1: LEAD MANAGEMENT ---

  await t.test('1. Create Lead in Company A with consent verification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'Rahul Sharma',
        phoneNumber: '+919876543210',
        email: 'rahul@example.com',
        companyName: 'Sharma Tech',
        country: 'IN',
        languagePreference: 'hi-IN',
        leadSource: 'WEBSITE',
        status: 'NEW',
        consentStatus: 'CONSENT_GRANTED',
        isDnc: false,
      },
    });

    assert.equal(res.statusCode, 201);
    const lead = JSON.parse(res.body);
    assert.equal(lead.fullName, 'Rahul Sharma');
    assert.equal(lead.phoneNumber, '+919876543210');
    assert.equal(lead.consentStatus, 'CONSENT_GRANTED');
    assert.equal(lead.isDnc, false);
    assert.equal(lead.isCallable, true); // Eligible for calling
    leadA1Id = lead.id;
  });

  await t.test('2. Regulatory Calling Restriction: Lead marked DNC is strictly not callable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'DNC Restricted Contact',
        phoneNumber: '+919876543211',
        country: 'IN',
        consentStatus: 'CONSENT_GRANTED',
        isDnc: true, // Marked on DNC registry
        dncReason: 'National DND Registry check',
      },
    });

    assert.equal(res.statusCode, 201);
    const lead = JSON.parse(res.body);
    assert.equal(lead.isDnc, true);
    assert.equal(lead.isCallable, false); // STRICTLY NOT CALLABLE
  });

  await t.test('3. Regulatory Calling Restriction: Lead without documented consent is not callable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'Unverified Lead',
        phoneNumber: '+919876543212',
        country: 'IN',
        consentStatus: 'PENDING_VERIFICATION', // No opt-in documented yet
        isDnc: false,
      },
    });

    assert.equal(res.statusCode, 201);
    const lead = JSON.parse(res.body);
    assert.equal(lead.consentStatus, 'PENDING_VERIFICATION');
    assert.equal(lead.isCallable, false); // NOT CALLABLE until consent verified
  });

  await t.test('4. Duplicate Detection: Same phone number in Company A is rejected (409)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'Rahul Sharma Duplicate',
        phoneNumber: '+919876543210', // duplicate
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body);
    assert.match(body.message, /already exists in this company/i);
  });

  await t.test('5. Multi-Tenant Lead Isolation: Company B cannot see Company A leads', async () => {
    // Bob asks for Company A's lead list -> 403 Forbidden
    const resForbidden = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(resForbidden.statusCode, 403);

    // Bob asks for Company B's lead list -> 200, 0 leads
    const resB = await app.inject({
      method: 'GET',
      url: `/tenants/${companyBId}/leads`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(resB.statusCode, 200);
    assert.equal(JSON.parse(resB.body).total, 0);

    // Bob tries to get Company A lead by ID -> 403
    const resLeadGet = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/leads/${leadA1Id}`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(resLeadGet.statusCode, 403);
  });

  await t.test('6. CSV Bulk Import Preview: Identifies valid rows, invalid formats, and duplicates', async () => {
    const csvRows = [
      {
        fullName: 'Priya Patel',
        phoneNumber: '+919876500001',
        email: 'priya@patel.com',
        consentStatus: 'CONSENT_GRANTED',
        isDnc: false,
      },
      {
        fullName: 'Duplicate Phone Lead',
        phoneNumber: '+919876543210', // Existing in DB from test 1
        consentStatus: 'CONSENT_GRANTED',
      },
      {
        fullName: '', // Invalid: missing full name
        phoneNumber: '+919876500002',
      },
      {
        fullName: 'DNC Customer',
        phoneNumber: '+919876500003',
        consentStatus: 'CONSENT_GRANTED',
        isDnc: true,
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads/import-preview`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { rows: csvRows },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.totalRows, 4);
    assert.equal(body.validRows, 2); // Priya Patel and DNC Customer
    assert.equal(body.invalidRows, 2); // Duplicate and Missing Name
    assert.equal(body.duplicateRows, 1);
  });

  await t.test('7. CSV Bulk Import: Executes import and saves valid leads', async () => {
    const csvRows = [
      {
        fullName: 'Sneha Rao',
        phoneNumber: '+919876500010',
        email: 'sneha@rao.com',
        consentStatus: 'CONSENT_GRANTED',
        isDnc: false,
      },
      {
        fullName: 'Arjun Verma',
        phoneNumber: '+919876500011',
        email: 'arjun@verma.com',
        consentStatus: 'LAWFUL_BASIS',
        isDnc: false,
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads/import`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { rows: csvRows },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.totalImported, 2);
    assert.equal(body.errors.length, 0);
  });

  // --- MODULE 2: CAMPAIGN MANAGEMENT ---

  let campaignId = '';

  await t.test('8. Create Campaign: Agent creates campaign in DRAFT status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/campaigns`,
      headers: { authorization: `Bearer ${agentToken}` },
      payload: {
        name: 'Q4 Enterprise Outbound',
        description: 'Targeting tech companies for SaaS demo',
        salesObjective: 'LEAD_GENERATION',
        salesPersonality: 'CONSULTATIVE',
        preferredLanguage: 'hi-IN',
        voicePreference: 'Priya (Warm)',
        startDate: '2026-12-01',
        startTime: '10:00',
        timezone: 'Asia/Kolkata',
        leadIds: [leadA1Id],
      },
    });

    assert.equal(res.statusCode, 201);
    const campaign = JSON.parse(res.body);
    assert.equal(campaign.name, 'Q4 Enterprise Outbound');
    assert.equal(campaign.status, 'DRAFT');
    assert.equal(campaign.totalLeadsCount, 1);
    assert.equal(campaign.callableLeadsCount, 1);
    campaignId = campaign.id;
  });

  await t.test('9. Campaign Approval Security: AGENT cannot approve campaign (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/campaigns/${campaignId}/approve`,
      headers: { authorization: `Bearer ${agentToken}` },
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.match(body.message, /Insufficient permissions/i);
  });

  await t.test('10. Campaign Approval: OWNER successfully approves campaign', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/campaigns/${campaignId}/approve`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });

    assert.equal(res.statusCode, 200);
    const campaign = JSON.parse(res.body);
    assert.equal(campaign.status, 'APPROVED');
    assert.ok(campaign.approvedById);
    assert.ok(campaign.approvedAt);
  });

  await t.test('11. Campaign State: Pause and resume workflow', async () => {
    // Pause
    const resPause = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/campaigns/${campaignId}/status`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { status: 'PAUSED' },
    });
    assert.equal(resPause.statusCode, 200);
    assert.equal(JSON.parse(resPause.body).status, 'PAUSED');

    // Resume
    const resResume = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/campaigns/${campaignId}/status`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { status: 'APPROVED' },
    });
    assert.equal(resResume.statusCode, 200);
    assert.equal(JSON.parse(resResume.body).status, 'APPROVED');
  });

  await t.test('12. Multi-Tenant Campaign Isolation: Company B cannot access Company A campaigns', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/campaigns/${campaignId}`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(res.statusCode, 403);
  });

  // --- MODULE 3: DASHBOARD STATISTICS ---

  await t.test('13. Dashboard Statistics: Scoped to company and aggregates live metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/dashboard/stats`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.leads.total >= 5);
    assert.ok(body.leads.dncBlocked >= 1);
    assert.equal(body.campaigns.total, 1);
    assert.equal(body.campaigns.active, 1);
    assert.equal(body.compliance.callingEligibilityEnforced, true);
  });

  // --- MODULE 5: LANGUAGE REQUIREMENTS (ml-IN & en-IN) ---

  await t.test('14. Language Requirements: Confirm Malayalam (ml-IN) and Indian English (en-IN) persistence', async () => {
    // 1. Create Lead with Malayalam (ml-IN)
    const resLeadMl = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'Mathew Thomas (Kochi)',
        phoneNumber: '+919876599901',
        email: 'mathew@kerala.com',
        country: 'IN',
        languagePreference: 'ml-IN',
        consentStatus: 'CONSENT_GRANTED',
      },
    });
    assert.equal(resLeadMl.statusCode, 201);
    const leadMl = JSON.parse(resLeadMl.body);
    assert.equal(leadMl.languagePreference, 'ml-IN');

    // 2. Create Lead with Indian English (en-IN)
    const resLeadEn = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/leads`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        fullName: 'Ananya Deshmukh (Bengaluru)',
        phoneNumber: '+919876599902',
        email: 'ananya@bengaluru.com',
        country: 'IN',
        languagePreference: 'en-IN',
        consentStatus: 'CONSENT_GRANTED',
      },
    });
    assert.equal(resLeadEn.statusCode, 201);
    const leadEn = JSON.parse(resLeadEn.body);
    assert.equal(leadEn.languagePreference, 'en-IN');

    // 3. Create Campaign with Malayalam (ml-IN) and custom voice
    const resCampMl = await app.inject({
      method: 'POST',
      url: `/tenants/${companyAId}/campaigns`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        name: 'Kerala Regional SaaS Outreach',
        salesObjective: 'DIRECT_SALES',
        salesPersonality: 'CONSULTATIVE',
        preferredLanguage: 'ml-IN',
        voicePreference: 'Priya (Warm)',
        startDate: '2026-12-10',
        startTime: '11:00',
        timezone: 'Asia/Kolkata',
        leadIds: [leadMl.id],
      },
    });
    assert.equal(resCampMl.statusCode, 201);
    const campMl = JSON.parse(resCampMl.body);
    assert.equal(campMl.preferredLanguage, 'ml-IN');
    assert.equal(campMl.voicePreference, 'Priya (Warm)');

    // 4. Retrieve Campaign and verify persisted values
    const resGet = await app.inject({
      method: 'GET',
      url: `/tenants/${companyAId}/campaigns/${campMl.id}`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    assert.equal(resGet.statusCode, 200);
    const retrievedCamp = JSON.parse(resGet.body);
    assert.equal(retrievedCamp.preferredLanguage, 'ml-IN');
    assert.equal(retrievedCamp.voicePreference, 'Priya (Warm)');
    assert.equal(retrievedCamp.totalLeadsCount, 1);
  });
});
