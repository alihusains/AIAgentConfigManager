/**
 * GUI API smoke test for the detection-coverage plan.
 * Usage: node scripts/gui-smoke-test.js <url-with-token>
 *   e.g. node scripts/gui-smoke-test.js "http://127.0.0.1:4321/?t=abc123"
 */
const http = require('node:http');

const rawUrl = process.argv[2] || 'http://127.0.0.1:4321';
const parsed = new URL(rawUrl);
const token = parsed.searchParams.get('t');
const base = `${parsed.protocol}//${parsed.host}`;
if (!token) {
  console.error('usage: node gui-smoke-test.js "http://127.0.0.1:PORT/?t=TOKEN"');
  process.exit(1);
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      base + path + '?t=' + token,
      { method },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(d) }); }
          catch (e) { resolve({ status: res.statusCode, raw: d.slice(0, 200) }); }
        });
      }
    );
    r.on('error', reject);
    if (data) {
      r.setHeader('Content-Type', 'application/json');
      r.write(data);
    }
    r.end();
  });
}

(async () => {
  let failures = 0;
  const check = (name, cond, detail) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!cond) failures++;
  };

  // ---- /api/state: detection fields on adapter agents ----
  const st = (await req('GET', '/api/state')).json;
  const agents = st.data?.agents;
  if (!Array.isArray(agents)) {
    console.error('unexpected /api/state shape:', JSON.stringify(st).slice(0, 300));
    process.exit(1);
  }
  console.log(`agents in /api/state: ${agents.map((a) => a.id).join(', ')}\n`);

  const cc = agents.find((a) => a.id === 'claude-code');
  check('claude-code present', !!cc);
  check('claude-code mcpPath', cc.detection.mcpPath === '~/.claude/mcp.json' || cc.detection.mcpPath?.endsWith('.claude/mcp.json'), cc.detection.mcpPath);
  check('claude-code mcpConfigExists', cc.detection.mcpConfigExists === true);
  check('claude-code mcpServerCount > 0', (cc.detection.mcpServerCount ?? 0) > 0, String(cc.detection.mcpServerCount));
  check('claude-code modelConfigPath', (cc.detection.modelConfigPath || '').includes('.claude'), cc.detection.modelConfigPath);

  const fb = agents.find((a) => a.id === 'freebuff');
  check('freebuff present', !!fb);
  check('freebuff mcpPath', (fb.detection.mcpPath || '').includes('.agents/mcp.json'), fb.detection.mcpPath);

  const oc = agents.find((a) => a.id === 'opencode');
  check('opencode present', !!oc);
  check('opencode mcpPath set', !!oc.detection.mcpPath, oc.detection.mcpPath);

  // ---- /api/system/stats: live RAM meter endpoint ----
  const sys = await req('GET', '/api/system/stats');
  check('system/stats → 200', sys.status === 200, JSON.stringify(sys.json).slice(0, 120));
  const s = sys.json?.data;
  check('system/stats: rssBytes > 0', (s?.rssBytes ?? 0) > 0, 'rss=' + (s?.rssBytes / 1048576).toFixed(1) + 'MB');
  check('system/stats: heapUsedBytes > 0', (s?.heapUsedBytes ?? 0) > 0);
  check('system/stats: processId is number', typeof s?.processId === 'number', 'pid=' + s?.processId);
  check('system/stats: startedAt is ISO', !isNaN(Date.parse(s?.startedAt)), 'startedAt=' + s?.startedAt);
  check('system/stats: uptimeSec >= 0', (s?.uptimeSec ?? -1) >= 0, 'uptime=' + s?.uptimeSec + 's');

  // ---- /api/agents/catalog: catalog agents carry detection too ----
  const cat = (await req('GET', '/api/agents/catalog')).json;
  const catAgents = cat.data?.agents || cat.agents || [];
  console.log(`\ncatalog agents: ${catAgents.map((a) => a.id).join(', ')}\n`);

  const rx = catAgents.find((a) => a.id === 'reasonix');
  check('catalog: reasonix present', !!rx);
  check('catalog: reasonix installed', rx.installed === true || rx.detected?.installed === true);
  check('catalog: reasonix mcpPath', (rx.detected?.detection?.mcpPath || rx.mcpPath || '').includes('.reasonix/config.toml'), rx.detected?.detection?.mcpPath);
  check('catalog: reasonix modelCredentialPath', (rx.detected?.detection?.modelCredentialPath || '').includes('.reasonix/.env'), rx.detected?.detection?.modelCredentialPath);

  const lc = catAgents.find((a) => a.id === 'little-coder');
  check('catalog: little-coder present', !!lc);
  check('catalog: little-coder installed', lc.installed === true || lc.detected?.installed === true);

  // ---- reveal endpoint with kind ----
  const r1 = await req('POST', '/api/agents/claude-code/reveal');
  check('reveal default → 200 + dir', r1.status === 200 && !!r1.json.data, JSON.stringify(r1.json));
  const r2 = await req('POST', '/api/agents/claude-code/reveal', { kind: 'mcp' });
  check('reveal mcp → 200 + mcp path', r2.status === 200 && (r2.json.data?.path || '').includes('.claude'), JSON.stringify(r2.json));
  const r3 = await req('POST', '/api/agents/claude-code/reveal', { kind: 'model' });
  check('reveal model → 200', r3.status === 200, JSON.stringify(r3.json));
  const r4 = await req('POST', '/api/agents/claude-code/reveal', { kind: 'bogus' });
  check('reveal bogus kind → 400 (clean error)', r4.status === 400, JSON.stringify(r4.json));
  const r5 = await req('POST', '/api/agents/claude-code/reveal', { kind: 'mcp' });
  check('reveal mcp idempotent (path stable)', r5.status === 200 && r5.json.data?.path === r2.json.data?.path);
  // agent without an MCP file → clean 404
  const r6 = await req('POST', '/api/agents/freebuff/reveal', { kind: 'mcp' });
  check('reveal mcp for missing file → 404 (clean error)', r6.status === 404, JSON.stringify(r6.json));

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('smoke test crashed:', e.message);
  process.exit(1);
});