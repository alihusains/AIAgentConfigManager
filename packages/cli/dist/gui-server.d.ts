/**
 * GUI Server — serves the static dashboard and the REST API for the registry.
 *
 * Runs on 127.0.0.1 (loopback only) on a random, conflict-avoiding port, and
 * opens the browser. The API is guarded by a per-launch token carried in the
 * URL query string (the page re-sends it on every fetch).
 */
import type { AgentConfigManager } from '@ai-agent-config/core';
import type { AgentJob } from '@ai-agent-config/core';
export interface GUIServerOptions {
    /** Preferred port; random conflict-free port when omitted */
    port?: number;
    /** Override the GUI dist directory (default: <cli>/../../gui/dist) */
    distDir?: string;
    /** Open the browser automatically (default: true) */
    openBrowser?: boolean;
}
export interface GUIServerHandle {
    url: string;
    port: number;
    token: string;
    close(): Promise<void>;
}
declare function startAgentJob(agentId: string, action: 'install' | 'uninstall', command: string, options?: {
    timeoutMs?: number;
}): AgentJob;
export { startAgentJob };
export declare function startGuiServer(manager: AgentConfigManager, options?: GUIServerOptions): Promise<GUIServerHandle>;
//# sourceMappingURL=gui-server.d.ts.map