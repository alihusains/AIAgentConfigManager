/**
 * Tests for the agent install/uninstall job runner (gui-server).
 * The runner is command-agnostic; route-level allow-listing is covered by the
 * smoke test against the live server. Here we verify spawn + output capture +
 * exit codes + timeout killing.
 */
import { describe, it, expect } from 'vitest';
import { startAgentJob } from './gui-server.js';
import type { AgentJob } from '@ai-agent-config/core';

function awaitCompletion(job: AgentJob, timeoutMs = 8000): Promise<AgentJob> {
  return new Promise((resolve) => {
    if (job.status !== 'running') {
      resolve(job);
      return;
    }
    const t = setInterval(() => {
      if (job.status !== 'running') {
        clearInterval(t);
        resolve(job);
      }
    }, 25);
    setTimeout(() => {
      clearInterval(t);
      resolve(job);
    }, timeoutMs);
  });
}

describe('startAgentJob', () => {
  it('runs a command and captures stdout as output with exit 0', async () => {
    const job = startAgentJob('test-agent', 'install', 'echo hello-agent-job');
    const done = await awaitCompletion(job);
    expect(done.status).toBe('success');
    expect(done.exitCode).toBe(0);
    expect(done.output).toContain('hello-agent-job');
    expect(done.startedAt).toBeTruthy();
    expect(done.finishedAt).toBeTruthy();
  });

  it('merges stderr into output and reports the real exit code on failure', async () => {
    const job = startAgentJob('test-agent', 'uninstall', 'echo boom >&2; exit 3');
    const done = await awaitCompletion(job);
    expect(done.status).toBe('failed');
    expect(done.exitCode).toBe(3);
    expect(done.output).toContain('boom');
  });

  it('kills long-running commands at the timeout', async () => {
    const job = startAgentJob('test-agent', 'install', 'sleep 30', { timeoutMs: 250 });
    const done = await awaitCompletion(job, 5000);
    expect(done.status).toBe('failed');
    expect(done.error).toContain('timeout');
  });
});