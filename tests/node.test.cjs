const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SanctionsKit } = require('../dist/nodes/SanctionsKit/SanctionsKit.node.js');
const { SanctionsKitApi } = require('../dist/credentials/SanctionsKitApi.credentials.js');
const { buildScreening } = require('../dist/nodes/SanctionsKit/validation.js');
const contract = require('./fixtures/contract.json');
const Ajv = require('ajv/dist/2020');

const id = '12345678-1234-4234-8234-123456789abc';
const fixture = {
  id, environment: 'sandbox', status: 'no_match', createdAt: '2026-09-30T00:00:00.000Z', matches: [],
  coverage: [{ sourceId: 'sandbox-synthetic', version: '1', retrievedAt: '2026-09-30T00:00:00.000Z', fresh: true }],
  versions: { dataset: 'synthetic', matchingEngine: 'fixture', policy: 'fixture' },
  disclaimer: 'Synthetic contract fixture. Not a production screening result.',
};
const matchingFixture = {
  version: 'synthetic-matching@1', profile: 'standard', nameThreshold: 80,
  corroboratedNameThreshold: 60, retrievalVersion: 'synthetic-retrieval@1',
};
const policyFixture = {
  name: 'Synthetic test policy', purpose: 'Exercise policy evidence preservation',
  jurisdictions: ['Example jurisdiction'], requiredSources: {}, optionalSources: {},
  exclusions: [], externalChecks: [], review: {}, monitoringIntervalHours: 24,
  retentionTrigger: 'review_completed', id, version: 2, environment: 'sandbox',
  createdAt: '2026-09-30T00:00:00.000Z',
};
const sourceFixture = (sourceId, overrides = {}) => ({
  id: sourceId, name: `Synthetic source ${sourceId}`, authority: 'Synthetic test authority',
  availability: 'available', capabilities: ['person'], rightsStatus: 'approved',
  category: 'reference', fresh: true, ...overrides,
});
const minimalEvidenceFixture = {
  format: 'sanctionskit-evidence@1', result: fixture, retention: 'minimal',
  expires_at: '2026-10-01T00:00:00.000Z', subject: null, reference: null, request: null,
  retainedInputs: false, replayLimit: 'Submitted inputs were not retained.',
};
const responseAjv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
function assertResponseContract(path, method, status, value) {
  const schema = contract.paths[path][method].responses[status].content['application/json'].schema;
  const validate = responseAjv.compile({ ...schema, components: contract.components });
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}
const defaults = { resource: 'screening', operation: 'create', name: 'Alex Example', entityType: 'person', coverage: 'sandbox', idempotencyKey: 'example:screening:001', options: {}, simplify: false };

function harness(parameters = {}, settings = {}) {
  const calls = [];
  const rows = settings.rows ?? [{ json: {} }];
  const node = { id: 'node-test', name: 'SanctionsKit', type: settings.nodeType ?? 'n8n-nodes-sanctionskit.sanctionsKit', typeVersion: 1, position: [0, 0], parameters: {} };
  const context = {
    getInputData: () => rows,
    getNode: () => node,
    getNodeParameter: (key, index, fallback) => {
      const values = { ...defaults, ...parameters, ...(settings.perItem?.[index] ?? {}) };
      return values[key] ?? fallback;
    },
    getCredentials: async () => settings.credentials ?? { apiKey: 'sk_test_fixture', environment: 'sandbox' },
    continueOnFail: () => settings.continueOnFail ?? false,
    helpers: { httpRequestWithAuthentication: async (credentialName, request) => {
      calls.push({ credentialName, request });
      if (settings.error) throw settings.error;
      return settings.response ?? { data: fixture };
    } },
  };
  return { calls, run: () => new SanctionsKit().execute.call(context) };
}

test('screening sends the documented path, bearer credential helper, idempotency and JSON body', async () => {
  const h = harness();
  const [[item]] = await h.run();
  const { credentialName, request } = h.calls[0];
  assert.equal(credentialName, 'sanctionsKitApi');
  assert.equal(request.url, 'https://www.sanctionskit.com/api/v1/screenings');
  assert.equal(request.method, 'POST');
  assert.equal(request.disableFollowRedirect, true);
  assert.equal(request.timeout, 30000);
  assert.equal(request.headers['Idempotency-Key'], defaults.idempotencyKey);
  assert.deepEqual(request.body, { subject: { name: 'Alex Example', entityType: 'person' }, retention: 'standard', package: 'sandbox@1' });
  assert.deepEqual(item, { json: fixture, pairedItem: { item: 0 } });
});

test('credentials use password storage, bearer auth and a read-only test', () => {
  const c = new SanctionsKitApi();
  assert.equal(c.properties.find((p) => p.name === 'apiKey').typeOptions.password, true);
  assert.equal(c.authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiKey}}');
  assert.equal(c.test.request.method, 'GET');
  assert.equal(c.test.request.url, '/sources');
  assert.equal(c.test.request.disableFollowRedirect, true);
  assert.equal(c.test.request.timeout, 30000);
});

test('per-item parameters and links survive multiple inputs', async () => {
  const h = harness({}, { rows: [{ json: {} }, { json: {} }], perItem: [{ name: 'Alex Example' }, { name: 'Taylor Example', idempotencyKey: 'example:screening:002' }] });
  const [items] = await h.run();
  assert.deepEqual(items.map((x) => x.pairedItem.item), [0, 1]);
  assert.equal(h.calls[1].request.body.subject.name, 'Taylor Example');
  assert.equal(h.calls[1].request.headers['Idempotency-Key'], 'example:screening:002');
});

for (const [label, parameters, settings] of [
  ['production key selected as sandbox', {}, { credentials: { apiKey: 'sk_live_fixture', environment: 'sandbox' } }],
  ['sandbox key selected as production', {}, { credentials: { apiKey: 'sk_test_fixture', environment: 'production' } }],
  ['production credential with synthetic default', {}, { credentials: { apiKey: 'sk_live_fixture', environment: 'production' } }],
  ['sandbox credential with real sources', { coverage: 'sources', sources: 'ofac_sdn' }, {}],
  ['invalid idempotency key', { idempotencyKey: 'bad key' }, {}],
  ['empty name', { name: ' ' }, {}],
  ['invalid calendar date', { options: { birthDate: '2025-02-29' } }, {}],
  ['invalid identifiers', { options: { identifiers: '[invalid]' } }, {}],
  ['unknown identifier field', { options: { identifiers: '[{"type":"passport","value":"example","secret":"unexpected"}]' } }, {}],
  ['policy version without policy ID', { options: { policyVersion: 2 } }, {}],
  ['path injection', { operation: 'get', screeningId: '../sources' }, {}],
  ['unknown operation', { operation: 'delete' }, {}],
]) {
  test(`rejects ${label} before network activity`, async () => {
    const h = harness(parameters, settings);
    await assert.rejects(h.run());
    assert.equal(h.calls.length, 0);
  });
}

test('production request maps explicit sources and approved policy without adding sandbox', async () => {
  const h = harness({ coverage: 'sources', sources: 'source_one, source_two', options: { policyId: id, policyVersion: 3, country: 'US', birthDate: '1980-06', identifiers: '[{"type":"passport","value":"EXAMPLE","issuer":"US"}]', reference: 'case-1', retention: 'minimal' } }, { credentials: { apiKey: 'sk_live_fixture', environment: 'production' }, response: { data: { ...fixture, environment: 'production' } } });
  await h.run();
  assert.deepEqual(h.calls[0].request.body.sources, ['source_one', 'source_two']);
  assert.deepEqual(h.calls[0].request.body.policy, { id, version: 3 });
  assert.equal(h.calls[0].request.body.package, undefined);
  assert.equal(h.calls[0].request.body.subject.birthDate, '1980-06');
});

test('request bodies validate against the dated official OpenAPI request schema', () => {
  const ajv = new Ajv({ strict: false, validateFormats: false });
  const validate = ajv.compile(contract.screeningRequest);
  for (const [input, environment] of [
    [defaults, 'sandbox'],
    [{ ...defaults, coverage: 'sources', sources: 'source_one', options: { policyId: id, policyVersion: 1 } }, 'production'],
    [{ ...defaults, coverage: 'package', package: 'example@1', options: { birthDate: '2000-02-29', identifiers: '[{"type":"registration","value":"example"}]' } }, 'production'],
  ]) {
    const body = buildScreening(input, environment);
    assert.equal(validate(body), true, JSON.stringify(validate.errors));
  }
  const header = contract.paths['/screenings'].post.parameters.find((p) => p.name === 'Idempotency-Key');
  assert.equal(header.required, true);
  assert.equal(contract.paths['/results/{id}/evidence'].get.responses['200'].content['application/json'].schema.$ref, '#/components/schemas/ScreeningEvidence');
});

test('all happy-path response fixtures satisfy the pinned official response schemas', () => {
  assertResponseContract('/screenings', 'post', '201', { data: fixture });
  assertResponseContract('/screenings', 'post', '201', { data: { ...fixture, matching: matchingFixture, policySnapshot: policyFixture } });
  assertResponseContract('/results/{id}', 'get', '200', { data: { ...fixture, subject: { name: 'Alex Example' }, reference: 'synthetic' } });
  assertResponseContract('/results/{id}/evidence', 'get', '200', minimalEvidenceFixture);
  assertResponseContract('/sources', 'get', '200', { data: [sourceFixture('one'), sourceFixture('two', { availability: 'disabled', rightsStatus: 'review_required', disabledReason: 'Synthetic inactive source' })] });
  assertResponseContract('/policies', 'get', '200', { data: { items: [policyFixture], requirePolicy: true, nextCursor: null } });
});

test('recorded synthetic potential-match contract example preserves candidate evidence', async () => {
  const response = structuredClone(contract.paths['/screenings'].post.responses['201'].content['application/json'].examples.recorded_potential_match.value);
  assertResponseContract('/screenings', 'post', '201', response);
  const h = harness({}, { response });
  const [[item]] = await h.run();
  assert.equal(item.json.status, 'potential_match');
  assert.ok(item.json.matches.length > 0);
  assert.deepEqual(item.json.matches, response.data.matches);
  assert.deepEqual(item.json.coverage, response.data.coverage);
});

test('response schema validation catches incomplete nested evidence in fixtures', () => {
  const validate = responseAjv.compile({ $ref: '#/components/schemas/ScreeningResult', components: contract.components });
  const missingTimestamp = structuredClone(fixture);
  delete missingTimestamp.coverage[0].retrievedAt;
  assert.equal(validate(missingTimestamp), false);
  assert.equal(validate({ ...fixture, versions: {} }), false);
  assert.equal(validate({ ...fixture, policySnapshot: { id, version: 2 } }), false);
  const localValidate = responseAjv.compile({ $ref: '#/components/schemas/ScreeningResult', components: contract.localResponseContract.components });
  assert.equal(localValidate({ ...fixture, matching: { profile: 'standard' } }), false);
  assert.equal(localValidate({ ...fixture, matching: matchingFixture, policySnapshot: policyFixture }), true, JSON.stringify(localValidate.errors));
});

test('retrieves result and keeps retained inputs and future fields', async () => {
  const data = { ...fixture, subject: { name: 'Alex Example' }, reference: 'example', futureField: true };
  const h = harness({ operation: 'get', screeningId: id }, { response: { data } });
  const [[item]] = await h.run();
  assert.equal(h.calls[0].request.url, `https://www.sanctionskit.com/api/v1/results/${id}`);
  assert.deepEqual(item.json, data);
});

test('simplification retains policy, coverage, candidates and interpretation limits', async () => {
  const policySnapshot = policyFixture;
  const h = harness({ simplify: true }, { response: { data: { ...fixture, matching: matchingFixture, policySnapshot, subject: { name: 'Alex Example' } } } });
  const [[item]] = await h.run();
  assert.equal(item.json.subject, undefined);
  assert.deepEqual(item.json.policySnapshot, policySnapshot);
  assert.deepEqual(item.json.coverage, fixture.coverage);
  assert.equal(item.json.disclaimer, fixture.disclaimer);
  assert.equal(Object.keys(item.json).length, 10);
});

test('evidence endpoint uses its raw envelope and preserves minimal-retention limits', async () => {
  const evidence = minimalEvidenceFixture;
  const h = harness({ operation: 'getEvidence', screeningId: id }, { response: evidence });
  const [[item]] = await h.run();
  assert.equal(h.calls[0].request.url, `https://www.sanctionskit.com/api/v1/results/${id}/evidence`);
  assert.deepEqual(item.json, evidence);
});

test('source catalog preserves disabled and unqualified entries with their notices', async () => {
  const sources = [sourceFixture('one'), sourceFixture('two', { availability: 'disabled', rightsStatus: 'review_required', disabledReason: 'Not activated' })];
  const h = harness({ resource: 'source', operation: 'getMany' }, { response: { data: sources } });
  const [items] = await h.run();
  assert.equal(h.calls[0].request.url, 'https://www.sanctionskit.com/api/v1/sources');
  assert.deepEqual(items.map((i) => i.json), sources);
});

test('source limit only limits output when explicitly requested', async () => {
  const h = harness({ resource: 'source', operation: 'getMany', returnAll: false, limit: 1 }, { response: { data: [sourceFixture('one'), sourceFixture('two')] } });
  const [items] = await h.run();
  assert.equal(items.length, 1);
});

test('policy page retains requirePolicy and cursor even when no policies returned', async () => {
  const page = { items: [], requirePolicy: true, nextCursor: null };
  const h = harness({ resource: 'policy', operation: 'getPage', pageSize: 20, cursor: id }, { response: { data: page } });
  const [[item]] = await h.run();
  assert.deepEqual(h.calls[0].request.qs, { limit: 20, cursor: id });
  assert.deepEqual(item.json, page);
});

for (const status of [401, 402, 403, 409, 429, 503]) {
  test(`HTTP ${status} stays an error without leaking credentials or input`, async () => {
    const h = harness({}, { error: { statusCode: status, message: 'sk_test_private Alex Example', response: { data: { error: { code: 'coverage_unavailable', message: 'Alex Example sk_test_private' } } } } });
    await assert.rejects(h.run(), (error) => {
      assert.match(error.message, /coverage_unavailable/);
      assert.doesNotMatch(JSON.stringify(error), /sk_test_private|Alex Example/);
      return true;
    });
    assert.equal(h.calls.length, 1);
  });
}

test('continue on fail marks only an error, never a false no-match', async () => {
  const h = harness({}, { error: new Error('network failure'), continueOnFail: true });
  const [[item]] = await h.run();
  assert.deepEqual(Object.keys(item.json), ['error']);
  assert.equal(item.pairedItem.item, 0);
});

for (const response of [{ data: { ...fixture, environment: 'production' } }, { data: { ...fixture, coverage: undefined } }, { data: { ...fixture, matches: [{}] } }, { data: { ...fixture, status: 'potential_match', matches: [] } }, { data: { ...fixture, status: 'clear' } }]) {
  test(`rejects incomplete or inconsistent screening response ${JSON.stringify(response.data)}`, async () => {
    await assert.rejects(harness({}, { response }).run());
  });
}

test('tool selected output preserves environment, coverage and interpretation limits', async () => {
  const h = harness({ operation: 'get', screeningId: id, outputMode: 'selected', outputFields: ['reference'] }, { nodeType: 'n8n-nodes-sanctionskit.sanctionsKitTool', response: { data: { ...fixture, reference: 'example-event', subject: { name: 'Alex Example' } } } });
  const [[item]] = await h.run();
  assert.equal(item.json.reference, 'example-event');
  assert.equal(item.json.subject, undefined);
  assert.equal(item.json.matches, undefined);
  assert.equal(item.json.id, fixture.id);
  assert.equal(item.json.environment, fixture.environment);
  assert.deepEqual(item.json.coverage, fixture.coverage);
  assert.equal(item.json.disclaimer, fixture.disclaimer);
});

test('tool raw output preserves full result', async () => {
  const data = { ...fixture, reference: 'example-event', subject: { name: 'Alex Example' } };
  const h = harness({ operation: 'get', screeningId: id, outputMode: 'raw' }, { nodeType: 'n8n-nodes-sanctionskit.sanctionsKitTool', response: { data } });
  const [[item]] = await h.run();
  assert.deepEqual(item.json, data);
});
