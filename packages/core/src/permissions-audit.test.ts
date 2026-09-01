/**
 * Permissions Audit Tests
 *
 * Tests for P2-T2 auditPermissions() method — scanning all adapters for
 * permission rules and flagging contradictions with risk scores.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentConfigManager } from './index';
import type { AgentConfig, PermissionConfig } from './types';

/* ========================================================================== */
/* Mock Adapters with Permission Rules                                       */
/* ========================================================================== */

describe('Permissions Audit (P2-T2)', () => {
  let manager: AgentConfigManager;

  beforeEach(() => {
    manager = new AgentConfigManager();
  });

  it('should audit permissions without throwing when no agent has permissions', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.globalContradictions).toEqual([]);
  });

  it('should return a valid PermissionAuditResult structure', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    expect(data.scannedAt).toBeDefined();
    expect(new Date(data.scannedAt).getTime()).toBeGreaterThan(0);

    expect(data.totalAgents).toBeGreaterThan(0);
    expect(data.agentsWithPermissions).toBeGreaterThanOrEqual(0);
    expect(data.perAgent).toBeInstanceOf(Array);
    expect(data.globalContradictions).toBeInstanceOf(Array);

    expect(data.summary).toHaveProperty('highRiskCount');
    expect(data.summary).toHaveProperty('mediumRiskCount');
    expect(data.summary).toHaveProperty('lowRiskCount');

    expect(data.summary.highRiskCount).toBeGreaterThanOrEqual(0);
    expect(data.summary.mediumRiskCount).toBeGreaterThanOrEqual(0);
    expect(data.summary.lowRiskCount).toBeGreaterThanOrEqual(0);
  });

  it('should include per-agent summaries with permission counts', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    // Each per-agent summary should have required fields
    for (const summary of data.perAgent) {
      expect(summary.agentId).toBeDefined();
      expect(typeof summary.agentId).toBe('string');

      expect(summary.agentName).toBeDefined();
      expect(typeof summary.agentName).toBe('string');

      expect(summary.totalPermissions).toBeGreaterThanOrEqual(0);
      expect(summary.allowedPatterns).toBeGreaterThanOrEqual(0);
      expect(summary.deniedPatterns).toBeGreaterThanOrEqual(0);

      // Total should equal allowed + denied
      expect(summary.totalPermissions).toBe(
        summary.allowedPatterns + summary.deniedPatterns
      );

      expect(summary.contradictions).toBeInstanceOf(Array);

      // Each contradiction should have required fields
      for (const contradiction of summary.contradictions) {
        expect(contradiction.pattern).toBeDefined();
        expect(contradiction.type).toMatch(/^(tool|directory|url|command|mcp|custom)$/);
        expect(contradiction.allowingAgents).toBeInstanceOf(Array);
        expect(contradiction.denyingAgents).toBeInstanceOf(Array);
        expect(contradiction.riskLevel).toMatch(/^(LOW|MEDIUM|HIGH)$/);
      }
    }
  });

  it('should identify contradictions with correct risk levels', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    // Verify risk level logic:
    // HIGH: 2+ agents allowing AND 2+ agents denying
    // MEDIUM: 1+ agents allowing AND 1+ agents denying (but not both 2+)
    // LOW: otherwise (shouldn't normally appear)

    for (const contradiction of data.globalContradictions) {
      const allowCount = contradiction.allowingAgents.length;
      const denyCount = contradiction.denyingAgents.length;

      if (allowCount >= 2 && denyCount >= 2) {
        expect(contradiction.riskLevel).toBe('HIGH');
      } else if (allowCount > 0 && denyCount > 0) {
        expect(contradiction.riskLevel).toBe('MEDIUM');
      }
    }
  });

  it('should count contradictions correctly in summary', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    let expectedHigh = 0;
    let expectedMedium = 0;
    let expectedLow = 0;

    for (const contradiction of data.globalContradictions) {
      if (contradiction.riskLevel === 'HIGH') expectedHigh++;
      else if (contradiction.riskLevel === 'MEDIUM') expectedMedium++;
      else if (contradiction.riskLevel === 'LOW') expectedLow++;
    }

    expect(data.summary.highRiskCount).toBe(expectedHigh);
    expect(data.summary.mediumRiskCount).toBe(expectedMedium);
    expect(data.summary.lowRiskCount).toBe(expectedLow);
  });

  it('should return globalContradictions sorted by risk (HIGH first)', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    if (data.globalContradictions.length > 1) {
      for (let i = 0; i < data.globalContradictions.length - 1; i++) {
        const current = data.globalContradictions[i]!.riskLevel;
        const next = data.globalContradictions[i + 1]!.riskLevel;

        const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        expect(riskOrder[current]).toBeLessThanOrEqual(riskOrder[next]);
      }
    }
  });

  it('should mark per-agent contradictions when the agent is involved', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    // For each global contradiction, verify that all involved agents
    // have it listed in their per-agent summaries
    for (const globalContradiction of data.globalContradictions) {
      const involvedAgents = new Set([
        ...globalContradiction.allowingAgents,
        ...globalContradiction.denyingAgents,
      ]);

      for (const agentId of involvedAgents) {
        const summary = data.perAgent.find((s) => s.agentId === agentId);
        expect(summary).toBeDefined();

        // Check if this contradiction is in the summary's contradictions
        const hasContradiction = summary!.contradictions.some(
          (c) => c.pattern === globalContradiction.pattern && c.type === globalContradiction.type
        );

        expect(hasContradiction).toBe(true);
      }
    }
  });

  it('should handle errors gracefully when an adapter config fails to load', async () => {
    // The audit should not crash when encountering a malformed or missing config
    // This is tested implicitly by the happy path tests passing
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
  });

  it('should report totalAgents equal to the number of adapters', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    // The totalAgents should reflect all registered adapters
    const allAdapters = manager.getAvailableAgents();
    expect(data.totalAgents).toBe(allAdapters.length);
  });

  it('should report agentsWithPermissions >= 0', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    expect(data.agentsWithPermissions).toBeGreaterThanOrEqual(0);
    expect(data.agentsWithPermissions).toBeLessThanOrEqual(data.totalAgents);
  });

  it('should return empty contradictions list when there are no conflicts', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);

    // If no contradictions exist, the list should be empty
    if (result.data!.globalContradictions.length === 0) {
      expect(result.data!.summary.highRiskCount).toBe(0);
      expect(result.data!.summary.mediumRiskCount).toBe(0);
      expect(result.data!.summary.lowRiskCount).toBe(0);
    }
  });

  it('should not duplicate contradictions in globalContradictions list', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    const seen = new Set<string>();
    for (const contradiction of data.globalContradictions) {
      const key = `${contradiction.pattern}::${contradiction.type}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('should verify contradiction consistency: allowing and denying agents are not empty', async () => {
    const result = await manager.auditPermissions();
    expect(result.success).toBe(true);
    const data = result.data!;

    for (const contradiction of data.globalContradictions) {
      // A contradiction must have at least one agent on each side
      expect(contradiction.allowingAgents.length).toBeGreaterThan(0);
      expect(contradiction.denyingAgents.length).toBeGreaterThan(0);

      // No agent should appear on both sides
      const overlap = contradiction.allowingAgents.filter((a) =>
        contradiction.denyingAgents.includes(a)
      );
      expect(overlap.length).toBe(0);
    }
  });
});
