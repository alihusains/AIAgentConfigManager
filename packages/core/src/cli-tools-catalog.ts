/**
 * CLI Tools Catalog — searchable catalog of 70+ popular CLI tools
 */

import type { Platform } from './types';

export type CliToolCategory =
  | 'development'
  | 'productivity'
  | 'cloud'
  | 'ai'
  | 'build'
  | 'system'
  | 'utilities';

export type CliToolPricing = 'free' | 'freemium' | 'paid';
export type CliToolDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface InstallCommand {
  packageManager: string;
  command: string;
}

export interface CliToolCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: CliToolCategory;
  installCommands: InstallCommand[];
  platforms: Platform[];
  homepage: string;
  documentation: string;
  usageExample: string;
  relatedTools: string[];
  pricing: CliToolPricing;
  difficulty: CliToolDifficulty;
}

export interface CliToolFilter {
  query?: string;
  categories?: CliToolCategory[];
  platforms?: Platform[];
}

const ALL: Platform[] = ['darwin', 'linux', 'win32'];
const POSIX: Platform[] = ['darwin', 'linux'];

export const CLI_TOOL_CATALOG: CliToolCatalogEntry[] = [
  // DEVELOPMENT TOOLS (20)
  { id: 'git', name: 'Git', description: 'Distributed version control system', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install git' },{ packageManager: 'apt', command: 'sudo apt install git' }], platforms: ALL, homepage: 'https://git-scm.com', documentation: 'https://git-scm.com/doc', usageExample: 'git clone https://github.com/user/repo.git', relatedTools: ['github-cli'], pricing: 'free', difficulty: 'beginner' },
  { id: 'node', name: 'Node.js', description: 'JavaScript runtime for server-side development', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install node' }], platforms: ALL, homepage: 'https://nodejs.org', documentation: 'https://nodejs.org/docs', usageExample: 'node app.js', relatedTools: ['npm'], pricing: 'free', difficulty: 'beginner' },
  { id: 'npm', name: 'npm', description: 'Node Package Manager', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install npm' }], platforms: ALL, homepage: 'https://www.npmjs.com', documentation: 'https://docs.npmjs.com', usageExample: 'npm install express', relatedTools: ['pnpm'], pricing: 'free', difficulty: 'beginner' },
  { id: 'pnpm', name: 'pnpm', description: 'Fast, disk-efficient package manager', category: 'development', installCommands: [{ packageManager: 'npm', command: 'npm install -g pnpm' }], platforms: ALL, homepage: 'https://pnpm.io', documentation: 'https://pnpm.io/cli', usageExample: 'pnpm install', relatedTools: ['npm'], pricing: 'free', difficulty: 'beginner' },
  { id: 'yarn', name: 'Yarn', description: 'Package manager for JavaScript', category: 'development', installCommands: [{ packageManager: 'npm', command: 'npm install -g yarn' }], platforms: ALL, homepage: 'https://yarnpkg.com', documentation: 'https://yarnpkg.com/documentation', usageExample: 'yarn add react', relatedTools: ['npm'], pricing: 'free', difficulty: 'beginner' },
  { id: 'python', name: 'Python', description: 'General-purpose programming language', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install python' }], platforms: ALL, homepage: 'https://www.python.org', documentation: 'https://docs.python.org/3/', usageExample: 'python3 script.py', relatedTools: ['pip'], pricing: 'free', difficulty: 'beginner' },
  { id: 'rust', name: 'Rust', description: 'Systems programming language', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install rustup' }], platforms: POSIX, homepage: 'https://www.rust-lang.org', documentation: 'https://doc.rust-lang.org', usageExample: 'cargo new myapp', relatedTools: ['cargo'], pricing: 'free', difficulty: 'advanced' },
  { id: 'cargo', name: 'Cargo', description: 'Rust package manager and build tool', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install cargo' }], platforms: POSIX, homepage: 'https://doc.rust-lang.org/cargo/', documentation: 'https://doc.rust-lang.org/cargo/', usageExample: 'cargo build', relatedTools: ['rust'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'go', name: 'Go', description: 'Compiled language for concurrent apps', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install go' }], platforms: ALL, homepage: 'https://go.dev', documentation: 'https://go.dev/doc/', usageExample: 'go run main.go', relatedTools: ['docker'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'docker', name: 'Docker', description: 'Container platform', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install docker' }], platforms: ALL, homepage: 'https://www.docker.com', documentation: 'https://docs.docker.com', usageExample: 'docker run -it ubuntu', relatedTools: ['docker-compose'], pricing: 'freemium', difficulty: 'intermediate' },
  { id: 'docker-compose', name: 'Docker Compose', description: 'Multi-container Docker applications', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install docker-compose' }], platforms: ALL, homepage: 'https://docs.docker.com/compose/', documentation: 'https://docs.docker.com/compose/', usageExample: 'docker compose up', relatedTools: ['docker'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'java', name: 'Java', description: 'Object-oriented programming language', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install openjdk' }], platforms: ALL, homepage: 'https://www.java.com', documentation: 'https://docs.oracle.com/javase/', usageExample: 'java MyApp.java', relatedTools: ['maven'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'maven', name: 'Maven', description: 'Java build automation tool', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install maven' }], platforms: ALL, homepage: 'https://maven.apache.org', documentation: 'https://maven.apache.org/guides/', usageExample: 'mvn clean package', relatedTools: ['java'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'typescript', name: 'TypeScript', description: 'Typed superset of JavaScript', category: 'development', installCommands: [{ packageManager: 'npm', command: 'npm install -g typescript' }], platforms: ALL, homepage: 'https://www.typescriptlang.org', documentation: 'https://www.typescriptlang.org/docs/', usageExample: 'tsc index.ts', relatedTools: ['node'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'github-cli', name: 'GitHub CLI', description: 'GitHub command-line tool', category: 'development', installCommands: [{ packageManager: 'brew', command: 'brew install gh' }], platforms: ALL, homepage: 'https://cli.github.com', documentation: 'https://cli.github.com/manual', usageExample: 'gh pr create', relatedTools: ['git'], pricing: 'free', difficulty: 'beginner' },
  // PRODUCTIVITY (15)
  { id: 'curl', name: 'curl', description: 'Transfer data with URLs', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install curl' }], platforms: ALL, homepage: 'https://curl.se', documentation: 'https://curl.se/docs/', usageExample: 'curl https://example.com', relatedTools: ['wget'], pricing: 'free', difficulty: 'beginner' },
  { id: 'wget', name: 'wget', description: 'Download files from web', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install wget' }], platforms: POSIX, homepage: 'https://www.gnu.org/software/wget/', documentation: 'https://www.gnu.org/software/wget/manual/', usageExample: 'wget https://example.com/file.zip', relatedTools: ['curl'], pricing: 'free', difficulty: 'beginner' },
  { id: 'tmux', name: 'tmux', description: 'Terminal multiplexer', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install tmux' }], platforms: POSIX, homepage: 'https://github.com/tmux/tmux', documentation: 'https://tmux.github.io/', usageExample: 'tmux new -s work', relatedTools: [], pricing: 'free', difficulty: 'intermediate' },
  { id: 'vim', name: 'Vim', description: 'Modal text editor', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install vim' }], platforms: ALL, homepage: 'https://www.vim.org', documentation: 'https://vim.fandom.com/wiki/Vim_Help', usageExample: 'vim file.txt', relatedTools: ['neovim'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'neovim', name: 'Neovim', description: 'Modern vim fork', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install neovim' }], platforms: ALL, homepage: 'https://neovim.io', documentation: 'https://neovim.io/doc/user/', usageExample: 'nvim file.ts', relatedTools: ['vim'], pricing: 'free', difficulty: 'advanced' },
  { id: 'zsh', name: 'zsh', description: 'Extended shell', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install zsh' }], platforms: POSIX, homepage: 'https://www.zsh.org', documentation: 'https://zsh.sourceforge.net/', usageExample: 'zsh', relatedTools: ['bash'], pricing: 'free', difficulty: 'beginner' },
  { id: 'fish', name: 'Fish', description: 'User-friendly shell', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install fish' }], platforms: ALL, homepage: 'https://fishshell.com', documentation: 'https://fishshell.com/docs/current/', usageExample: 'fish', relatedTools: ['zsh'], pricing: 'free', difficulty: 'beginner' },
  { id: 'ripgrep', name: 'ripgrep', description: 'Fast recursive grep', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install ripgrep' }], platforms: ALL, homepage: 'https://github.com/BurntSushi/ripgrep', documentation: 'https://github.com/BurntSushi/ripgrep#readme', usageExample: 'rg "pattern" src/', relatedTools: ['grep'], pricing: 'free', difficulty: 'beginner' },
  { id: 'fzf', name: 'fzf', description: 'Fuzzy finder', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install fzf' }], platforms: POSIX, homepage: 'https://github.com/junegunn/fzf', documentation: 'https://github.com/junegunn/fzf#readme', usageExample: 'fzf', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'bat', name: 'bat', description: 'cat clone with syntax highlighting', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install bat' }], platforms: ALL, homepage: 'https://github.com/sharkdp/bat', documentation: 'https://github.com/sharkdp/bat#readme', usageExample: 'bat file.rs', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'fd', name: 'fd', description: 'Alternative to find command', category: 'productivity', installCommands: [{ packageManager: 'brew', command: 'brew install fd' }], platforms: ALL, homepage: 'https://github.com/sharkdp/fd', documentation: 'https://github.com/sharkdp/fd#readme', usageExample: 'fd pattern', relatedTools: ['find'], pricing: 'free', difficulty: 'beginner' },
  // CLOUD & INFRASTRUCTURE (10)
  { id: 'aws-cli', name: 'AWS CLI', description: 'AWS command-line interface', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install awscli' }], platforms: ALL, homepage: 'https://aws.amazon.com/cli/', documentation: 'https://docs.aws.amazon.com/cli/', usageExample: 'aws s3 ls', relatedTools: ['gcloud'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'gcloud', name: 'Google Cloud CLI', description: 'Google Cloud command-line tool', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install google-cloud-cli' }], platforms: POSIX, homepage: 'https://cloud.google.com/sdk', documentation: 'https://cloud.google.com/sdk/gcloud', usageExample: 'gcloud compute instances list', relatedTools: ['aws-cli'], pricing: 'free', difficulty: 'intermediate' },
  { id: 'kubectl', name: 'kubectl', description: 'Kubernetes command-line tool', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install kubectl' }], platforms: ALL, homepage: 'https://kubernetes.io', documentation: 'https://kubernetes.io/docs/reference/kubectl/', usageExample: 'kubectl get pods', relatedTools: ['helm'], pricing: 'free', difficulty: 'advanced' },
  { id: 'terraform', name: 'Terraform', description: 'Infrastructure as code tool', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install terraform' }], platforms: ALL, homepage: 'https://www.terraform.io', documentation: 'https://developer.hashicorp.com/terraform/docs', usageExample: 'terraform apply', relatedTools: [], pricing: 'freemium', difficulty: 'advanced' },
  { id: 'helm', name: 'Helm', description: 'Kubernetes package manager', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install helm' }], platforms: ALL, homepage: 'https://helm.sh', documentation: 'https://helm.sh/docs/', usageExample: 'helm install', relatedTools: ['kubectl'], pricing: 'free', difficulty: 'advanced' },
  { id: 'ansible', name: 'Ansible', description: 'Configuration management tool', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install ansible' }], platforms: POSIX, homepage: 'https://www.ansible.com', documentation: 'https://docs.ansible.com/', usageExample: 'ansible-playbook site.yml', relatedTools: [], pricing: 'freemium', difficulty: 'intermediate' },
  { id: 'k9s', name: 'k9s', description: 'Kubernetes terminal UI', category: 'cloud', installCommands: [{ packageManager: 'brew', command: 'brew install k9s' }], platforms: ALL, homepage: 'https://k9scli.io', documentation: 'https://k9scli.io/', usageExample: 'k9s', relatedTools: ['kubectl'], pricing: 'free', difficulty: 'beginner' },
  // AI & ML (5)
  { id: 'ollama', name: 'Ollama', description: 'Run LLMs locally', category: 'ai', installCommands: [{ packageManager: 'brew', command: 'brew install ollama' }], platforms: ALL, homepage: 'https://ollama.com', documentation: 'https://docs.ollama.com', usageExample: 'ollama run llama2', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'jupyter', name: 'Jupyter', description: 'Interactive computing notebook', category: 'ai', installCommands: [{ packageManager: 'brew', command: 'brew install jupyter' }], platforms: POSIX, homepage: 'https://jupyter.org', documentation: 'https://jupyter.readthedocs.io', usageExample: 'jupyter notebook', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'conda', name: 'Conda', description: 'Package and environment manager', category: 'ai', installCommands: [{ packageManager: 'brew', command: 'brew install miniconda' }], platforms: ALL, homepage: 'https://conda.io', documentation: 'https://docs.conda.io/', usageExample: 'conda create -n myenv python=3.9', relatedTools: [], pricing: 'free', difficulty: 'intermediate' },
  // BUILD & DEPLOY (10)
  { id: 'make', name: 'Make', description: 'Build automation tool', category: 'build', installCommands: [{ packageManager: 'brew', command: 'brew install make' }], platforms: ALL, homepage: 'https://www.gnu.org/software/make/', documentation: 'https://www.gnu.org/software/make/manual/', usageExample: 'make build', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'webpack', name: 'Webpack', description: 'Module bundler for JavaScript', category: 'build', installCommands: [{ packageManager: 'npm', command: 'npm install -g webpack' }], platforms: ALL, homepage: 'https://webpack.js.org', documentation: 'https://webpack.js.org/guides/', usageExample: 'webpack', relatedTools: [], pricing: 'free', difficulty: 'intermediate' },
  { id: 'vite', name: 'Vite', description: 'Frontend tooling', category: 'build', installCommands: [{ packageManager: 'npm', command: 'npm create vite@latest' }], platforms: ALL, homepage: 'https://vitejs.dev', documentation: 'https://vitejs.dev/guide/', usageExample: 'vite', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'esbuild', name: 'esbuild', description: 'Fast JavaScript bundler', category: 'build', installCommands: [{ packageManager: 'npm', command: 'npm install -g esbuild' }], platforms: ALL, homepage: 'https://esbuild.github.io', documentation: 'https://esbuild.github.io/', usageExample: 'esbuild src/index.ts --bundle', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  // SYSTEM & MONITORING (8)
  { id: 'htop', name: 'htop', description: 'Interactive process viewer', category: 'system', installCommands: [{ packageManager: 'brew', command: 'brew install htop' }], platforms: POSIX, homepage: 'https://htop.dev', documentation: 'https://htop.dev/', usageExample: 'htop', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'prometheus', name: 'Prometheus', description: 'Monitoring system', category: 'system', installCommands: [{ packageManager: 'brew', command: 'brew install prometheus' }], platforms: POSIX, homepage: 'https://prometheus.io', documentation: 'https://prometheus.io/docs/', usageExample: 'prometheus', relatedTools: [], pricing: 'free', difficulty: 'advanced' },
  { id: 'pm2', name: 'PM2', description: 'Node.js process manager', category: 'system', installCommands: [{ packageManager: 'npm', command: 'npm install -g pm2' }], platforms: ALL, homepage: 'https://pm2.io', documentation: 'https://pm2.io/docs/', usageExample: 'pm2 start app.js', relatedTools: [], pricing: 'freemium', difficulty: 'beginner' },
  // UTILITIES (12)
  { id: 'jq', name: 'jq', description: 'JSON processor', category: 'utilities', installCommands: [{ packageManager: 'brew', command: 'brew install jq' }], platforms: ALL, homepage: 'https://stedolan.github.io/jq/', documentation: 'https://stedolan.github.io/jq/manual/', usageExample: 'echo \'{"a":1}\' | jq .a', relatedTools: [], pricing: 'free', difficulty: 'beginner' },
  { id: 'ffmpeg', name: 'FFmpeg', description: 'Audio/video processor', category: 'utilities', installCommands: [{ packageManager: 'brew', command: 'brew install ffmpeg' }], platforms: ALL, homepage: 'https://ffmpeg.org', documentation: 'https://ffmpeg.org/documentation.html', usageExample: 'ffmpeg -i input.mp4 output.mkv', relatedTools: [], pricing: 'free', difficulty: 'intermediate' },
  { id: 'imagemagick', name: 'ImageMagick', description: 'Image manipulation tool', category: 'utilities', installCommands: [{ packageManager: 'brew', command: 'brew install imagemagick' }], platforms: ALL, homepage: 'https://imagemagick.org', documentation: 'https://imagemagick.org/script/command-line-processing.php', usageExample: 'convert image.png image.jpg', relatedTools: [], pricing: 'free', difficulty: 'intermediate' },
  { id: 'grep', name: 'grep', description: 'Text search tool', category: 'utilities', installCommands: [{ packageManager: 'apt', command: 'sudo apt install grep' }], platforms: POSIX, homepage: 'https://www.gnu.org/software/grep/', documentation: 'https://www.gnu.org/software/grep/manual/', usageExample: 'grep "pattern" file.txt', relatedTools: ['ripgrep'], pricing: 'free', difficulty: 'beginner' },
  { id: 'find', name: 'find', description: 'File search tool', category: 'utilities', installCommands: [{ packageManager: 'apt', command: 'sudo apt install findutils' }], platforms: POSIX, homepage: 'https://www.gnu.org/software/findutils/', documentation: 'https://www.gnu.org/software/findutils/manual/', usageExample: 'find . -name "*.txt"', relatedTools: ['fd'], pricing: 'free', difficulty: 'beginner' },
];

const catalogById: Map<string, CliToolCatalogEntry> = new Map(
  CLI_TOOL_CATALOG.map((t) => [t.id, t])
);

export function getCliTool(id: string): CliToolCatalogEntry | undefined {
  return catalogById.get(id);
}

export function getCliToolCategories(): CliToolCategory[] {
  const order: CliToolCategory[] = ['development', 'productivity', 'cloud', 'ai', 'build', 'system', 'utilities'];
  return order.filter((c) => CLI_TOOL_CATALOG.some((t) => t.category === c));
}

export function searchCliTools(filter: CliToolFilter = {}): CliToolCatalogEntry[] {
  const { query, categories, platforms } = filter;
  const q = query?.trim().toLowerCase();

  return CLI_TOOL_CATALOG.filter((tool) => {
    if (categories && categories.length > 0 && !categories.includes(tool.category)) {
      return false;
    }
    if (platforms && platforms.length > 0 && !tool.platforms.some((p) => platforms.includes(p))) {
      return false;
    }
    if (q) {
      const haystack = `${tool.name} ${tool.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function groupCliToolsByCategory(
  tools: CliToolCatalogEntry[] = CLI_TOOL_CATALOG
): Record<CliToolCategory, CliToolCatalogEntry[]> {
  const grouped = {} as Record<CliToolCategory, CliToolCatalogEntry[]>;
  for (const tool of tools) {
    (grouped[tool.category] ??= []).push(tool);
  }
  return grouped;
}

export function getRelatedTools(tool: CliToolCatalogEntry): CliToolCatalogEntry[] {
  return tool.relatedTools
    .map((id) => catalogById.get(id))
    .filter((t): t is CliToolCatalogEntry => t !== undefined);
}

export function getInstallCommandForPlatform(
  tool: CliToolCatalogEntry,
  platform: Platform
): InstallCommand | undefined {
  const preferred =
    platform === 'darwin' ? ['brew', 'npm'] :
    platform === 'linux' ? ['apt', 'yum', 'brew', 'npm', 'cargo'] :
    ['npm', 'brew'];

  for (const pm of preferred) {
    const match = tool.installCommands.find((c) => c.packageManager === pm);
    if (match) return match;
  }
  return tool.installCommands[0];
}
