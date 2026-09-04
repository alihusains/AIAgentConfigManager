/**
 * CLI Manager command catalog — the single source of truth for the canned
 * commands the dashboard's CLI Manager executes.
 *
 * Design: the GUI never sends a command STRING to execute. It sends the
 * canned command's ID; the server expands the ID to its trusted literal.
 * This removes the old free-form "command not in allow-list" failure mode
 * entirely — every command shown in the UI is executable by construction,
 * and nothing outside this catalog can run.
 */

export interface CliManagerCommand {
  /** Stable id — the only thing the client sends. */
  id: string;
  /** The trusted literal the server executes. */
  command: string;
  /** Human label (also used by the GUI; kept here so both sides agree). */
  label: string;
  description: string;
  category:
    | 'development'
    | 'package-manager'
    | 'ai-agent'
    | 'docker'
    | 'utility'
    | 'system';
  /** Per-command timeout override (ms). */
  timeoutMs?: number;
}

export const CLI_MANAGER_COMMANDS: Record<string, CliManagerCommand> = {
  // Development
  'npm-build': {
    id: 'npm-build',
    command: 'npm run build',
    label: 'Build',
    description: 'Build the project (npm run build)',
    category: 'development',
  },
  'npm-dev': {
    id: 'npm-dev',
    command: 'npm run dev',
    label: 'Dev Server',
    description: 'Start the dev server (npm run dev)',
    category: 'development',
    timeoutMs: 60_000,
  },
  'npm-test': {
    id: 'npm-test',
    command: 'npm test',
    label: 'Run Tests',
    description: 'Run the test suite',
    category: 'development',
  },
  'npm-lint': {
    id: 'npm-lint',
    command: 'npm run lint',
    label: 'Lint',
    description: 'Lint the codebase',
    category: 'development',
  },
  'npm-typecheck': {
    id: 'npm-typecheck',
    command: 'npm run typecheck',
    label: 'Typecheck',
    description: 'Typecheck the codebase',
    category: 'development',
  },

  // Package managers
  'pnpm-install': {
    id: 'pnpm-install',
    command: 'pnpm install',
    label: 'Install Deps',
    description: 'Install dependencies (pnpm install)',
    category: 'package-manager',
  },
  'pnpm-update': {
    id: 'pnpm-update',
    command: 'pnpm update',
    label: 'Update Deps',
    description: 'Update dependencies to latest allowed versions',
    category: 'package-manager',
  },
  'pnpm-outdated': {
    id: 'pnpm-outdated',
    command: 'pnpm outdated',
    label: 'Outdated Deps',
    description: 'List outdated dependencies',
    category: 'package-manager',
  },

  // AI agent management (this tool's own lifecycle)
  'acm-start': {
    id: 'acm-start',
    command: 'acm start',
    label: 'Start Dashboard',
    description: 'Start the AI Config Manager dashboard',
    category: 'ai-agent',
  },
  'acm-stop': {
    id: 'acm-stop',
    command: 'acm stop',
    label: 'Stop Dashboard',
    description: 'Stop the running dashboard',
    category: 'ai-agent',
  },
  'acm-health': {
    id: 'acm-health',
    command: 'acm health',
    label: 'Health Check',
    description: 'Check the dashboard health',
    category: 'ai-agent',
  },

  // Docker
  'docker-ps': {
    id: 'docker-ps',
    command: 'docker ps',
    label: 'Running Containers',
    description: 'List running containers',
    category: 'docker',
  },
  'docker-ps-all': {
    id: 'docker-ps-all',
    command: 'docker ps -a',
    label: 'All Containers',
    description: 'List all containers (running and stopped)',
    category: 'docker',
  },
  'docker-images': {
    id: 'docker-images',
    command: 'docker images',
    label: 'Images',
    description: 'List local docker images',
    category: 'docker',
  },

  // Utilities
  'git-status': {
    id: 'git-status',
    command: 'git status',
    label: 'Git Status',
    description: 'Show the working tree status',
    category: 'utility',
  },
  'git-log': {
    id: 'git-log',
    command: 'git log --oneline -10',
    label: 'Git Log',
    description: 'Show the last 10 commits',
    category: 'utility',
  },
  'git-diff': {
    id: 'git-diff',
    command: 'git diff --stat',
    label: 'Git Diff',
    description: 'Summarize uncommitted changes',
    category: 'utility',
  },
  'jq-help': {
    id: 'jq-help',
    command: 'jq --version',
    label: 'jq Version',
    description: 'Show the installed jq version',
    category: 'utility',
  },

  // System monitoring
  'top-info': {
    id: 'top-info',
    command:
      process.platform === 'darwin' ? 'top -l 1 -n 10' : 'top -b -n 1 | head -20',
    label: 'System Resources',
    description: 'Snapshot of system resource usage',
    category: 'system',
  },
  'disk-usage': {
    id: 'disk-usage',
    command: 'du -sh .',
    label: 'Disk Usage',
    description: 'Disk usage summary for the working directory',
    category: 'system',
  },
  'process-list': {
    id: 'process-list',
    command: 'ps aux',
    label: 'Process List',
    description: 'List running processes',
    category: 'system',
  },
};

/** Look up a canned command by id — the only accepted client input. */
export function getCliManagerCommand(id: string): CliManagerCommand | undefined {
  return CLI_MANAGER_COMMANDS[id];
}

/** Group ids by category, ordered for the GUI. */
export const CLI_MANAGER_CATEGORIES = [
  'development',
  'package-manager',
  'ai-agent',
  'docker',
  'utility',
  'system',
] as const;
