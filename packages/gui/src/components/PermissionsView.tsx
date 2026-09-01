import { memo, useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { SectionHeader, Card, Badge, Button } from '../ui';
import { AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, Shield } from 'lucide-react';

/**
 * Permissions View — P2-T2 GUI tab
 *
 * Shows per-agent permissions, flagged contradictions, and risk scores.
 * User can manually trigger an audit scan to refresh the visibility.
 */

interface PermissionAuditData {
  scannedAt: string;
  totalAgents: number;
  agentsWithPermissions: number;
  perAgent: Array<{
    agentId: string;
    agentName: string;
    totalPermissions: number;
    allowedPatterns: number;
    deniedPatterns: number;
    contradictions: Array<{
      pattern: string;
      type: string;
      allowingAgents: string[];
      denyingAgents: string[];
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  }>;
  globalContradictions: Array<{
    pattern: string;
    type: string;
    allowingAgents: string[];
    denyingAgents: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  summary: {
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  };
}

const RiskBadge = memo(function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const colors = {
    HIGH: 'bg-red-100 text-red-800 border-red-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded border ${colors[level]}`}>
      {level}
    </span>
  );
});

const ContradictionRow = memo(function ContradictionRow({
  contradiction,
}: {
  contradiction: PermissionAuditData['globalContradictions'][0];
}) {
  return (
    <div className="border-l-4 border-gray-200 pl-4 py-3">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="font-mono text-sm font-semibold break-all">{contradiction.pattern}</div>
          <div className="text-xs text-gray-500 mt-1">
            Type: <span className="font-semibold">{contradiction.type}</span>
          </div>
        </div>
        <RiskBadge level={contradiction.riskLevel} />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
        <div>
          <span className="text-gray-600 block mb-1">Allows:</span>
          <div className="flex flex-wrap gap-1">
            {contradiction.allowingAgents.map((agent) => (
              <Badge key={agent} variant="success">
                {agent}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <span className="text-gray-600 block mb-1">Denies:</span>
          <div className="flex flex-wrap gap-1">
            {contradiction.denyingAgents.map((agent) => (
              <Badge key={agent} variant="warning">
                {agent}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export function PermissionsView() {
  const [auditData, setAuditData] = useState<PermissionAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await api.auditPermissions();
    if (result.ok && result.data) {
      setAuditData(result.data);
    } else {
      setError(result.error || 'Failed to audit permissions');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  return (
    <div className="page-container permissions-view">
      <SectionHeader
        title="Permissions"
        description="Audit permission rules across all agents and identify contradictions."
      />

      {/* Summary */}
      {auditData && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                High Risk
              </span>
            }
          >
            <div className="text-3xl font-bold text-red-600">
              {auditData.summary.highRiskCount}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {auditData.summary.highRiskCount > 0
                ? 'Patterns with 2+ agents on each side'
                : 'No high-risk contradictions'}
            </p>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <AlertCircle size={18} className="text-yellow-600" />
                Medium Risk
              </span>
            }
          >
            <div className="text-3xl font-bold text-yellow-600">
              {auditData.summary.mediumRiskCount}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {auditData.summary.mediumRiskCount > 0 ? '1 agent disagrees' : 'No medium-risk contradictions'}
            </p>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-blue-600" />
                Scanned
              </span>
            }
          >
            <div className="text-3xl font-bold text-blue-600">{auditData.totalAgents}</div>
            <p className="text-xs text-gray-600 mt-2">
              {auditData.agentsWithPermissions > 0 ? (
                <>
                  {auditData.agentsWithPermissions} agent
                  {auditData.agentsWithPermissions !== 1 ? 's' : ''} with rules
                </>
              ) : (
                'No agents with permission rules'
              )}
            </p>
          </Card>
        </div>
      )}

      {/* Refresh Button */}
      <div className="mb-6">
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          onClick={fetchAudit}
          loading={loading}
        >
          {loading ? 'Auditing…' : 'Refresh Audit'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Audit Failed</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && !auditData && (
        <Card className="text-center py-8">
          <div className="animate-spin inline-block">
            <RefreshCw size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-600 mt-2">Scanning all adapters…</p>
        </Card>
      )}

      {/* Global Contradictions */}
      {auditData && auditData.globalContradictions.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Shield size={18} />
              Global Contradictions
            </span>
          }
          className="mb-6"
        >
          <div className="space-y-4">
            {auditData.globalContradictions.map((contradiction, idx) => (
              <ContradictionRow key={idx} contradiction={contradiction} />
            ))}
          </div>
        </Card>
      )}

      {/* No Contradictions */}
      {auditData && auditData.globalContradictions.length === 0 && (
        <Card className="border-green-200 bg-green-50 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">All Clear</h3>
              <p className="text-sm text-green-800 mt-1">
                No permission contradictions detected across{' '}
                {auditData.agentsWithPermissions > 0 ? 'agents' : 'any agents'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Per-Agent Breakdown */}
      {auditData && auditData.perAgent.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Shield size={18} />
              Per-Agent Details
            </span>
          }
        >
          <div className="space-y-4">
            {auditData.perAgent
              .filter((summary) => summary.totalPermissions > 0)
              .map((summary) => (
                <div key={summary.agentId} className="border-l-2 border-gray-300 pl-4 py-3">
                  <div className="font-semibold text-sm mb-2">{summary.agentName}</div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <Badge variant="primary">{summary.totalPermissions} rules</Badge>
                    <Badge variant="success">{summary.allowedPatterns} allowed</Badge>
                    <Badge variant="warning">{summary.deniedPatterns} denied</Badge>
                    {summary.contradictions.length > 0 && (
                      <Badge variant="danger">{summary.contradictions.length} conflict(s)</Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Last Scanned */}
      {auditData && (
        <div className="mt-6 text-xs text-gray-500 text-right">
          Scanned at {new Date(auditData.scannedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
