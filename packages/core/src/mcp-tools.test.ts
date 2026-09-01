/**
 * Tests for the MCP tool-listing module (mcp-tools.ts).
 *
 * The module's contract is: never throw, never fabricate a count. These tests
 * prove the failure paths degrade to `{ tools: [], count: 0, error }` and the
 * success path parses a real `tools/list` result — using a real local stdio
 * MCP server stub (a tiny node script that speaks enough JSON-RPC to answer
 * initialize + tools/list), so the stdio transport is exercised end to end
 * without any network.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listMCPTools } from './mcp-tools';
import type { MCPServerConfig } from './types';

/** Build a minimal stdio MCP server stub that lists a fixed set of tools. */
function writeMcpStub(toolNames: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-stub-'));
  const file = join(dir, 'server.js');
  const namesJson = JSON.stringify(toolNames);
  const code = `
    const readline = require('node:readline');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg.method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'stub', version: '0.0.0' } },
        }) + '\\n');
      } else if (msg.method === 'tools/list') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          result: { tools: ${namesJson}.map((n) => ({ name: n, description: 'd', inputSchema: {} })) },
        }) + '\\n');
      }
    });
  `;
  writeFileSync(file, code, 'utf8');
  return file;
}

describe('listMCPTools', () => {
  it('lists tools from a real stdio MCP server stub', async () => {
    const stub = writeMcpStub(['alpha', 'beta', 'gamma']);
    const server: MCPServerConfig = {
      name: 'stub',
      type: 'stdio',
      command: process.execPath,
      args: [stub],
      enabled: true,
    };
    const result = await listMCPTools(server, 5000);
    expect(result.error).toBeUndefined();
    expect(result.count).toBe(3);
    expect(result.tools).toEqual(['alpha', 'beta', 'gamma']);
    unlinkSync(stub);
  });

  it('returns count 0 + error (never throws) when the stdio command is missing', async () => {
    const server: MCPServerConfig = {
      name: 'nope',
      type: 'stdio',
      // A command that does not exist on any PATH.
      command: 'definitely-not-a-real-binary-xyz',
      enabled: true,
    };
    const result = await listMCPTools(server, 2000);
    expect(result.count).toBe(0);
    expect(result.tools).toEqual([]);
    expect(typeof result.error).toBe('string');
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it('returns count 0 + error for a stdio server with no command', async () => {
    const result = await listMCPTools({ name: 'x', type: 'stdio', enabled: true }, 2000);
    expect(result.count).toBe(0);
    expect(result.error).toMatch(/no command/i);
  });

  it('returns count 0 + error for an http server with no url', async () => {
    const result = await listMCPTools({ name: 'x', type: 'http', enabled: true }, 2000);
    expect(result.count).toBe(0);
    expect(result.error).toMatch(/no url/i);
  });

  it('returns count 0 + honest error for an sse server (unsupported)', async () => {
    const result = await listMCPTools(
      { name: 'x', type: 'sse', url: 'http://127.0.0.1:1/sse', enabled: true },
      2000
    );
    expect(result.count).toBe(0);
    expect(result.tools).toEqual([]);
    expect(result.error).toMatch(/not supported/i);
  });

  it('times out (never hangs, never throws) on a stdio server that never answers', async () => {
    // A stub that reads stdin but never responds to initialize.
    const dir = mkdtempSync(join(tmpdir(), 'mcp-stub-hang-'));
    const file = join(dir, 'hang.js');
    writeFileSync(file, 'process.stdin.resume();', 'utf8');
    const server: MCPServerConfig = {
      name: 'hang',
      type: 'stdio',
      command: process.execPath,
      args: [file],
      enabled: true,
    };
    const started = Date.now();
    const result = await listMCPTools(server, 1500);
    const elapsed = Date.now() - started;
    expect(result.count).toBe(0);
    expect(result.error).toBeTruthy();
    // Must actually respect the timeout (well under the default 15s).
    expect(elapsed).toBeLessThan(10000);
    expect(elapsed).toBeGreaterThanOrEqual(1000);
    unlinkSync(file);
  });
});
