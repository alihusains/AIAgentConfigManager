/**
 * Comprehensive CLI Tools Catalog
 * 50+ popular development, infrastructure, and utility CLI tools
 * Users can discover, install, update, and manage these tools
 */

export interface CLITool {
  id: string;
  name: string;
  description: string;
  category:
    | 'development'
    | 'productivity'
    | 'cloud'
    | 'ai-ml'
    | 'build'
    | 'system'
    | 'utilities'
    | 'devops';
  
  // Installation
  installCommands: {
    npm?: string;
    brew?: string;
    apt?: string;
    yum?: string;
    cargo?: string;
    python?: string;
    pip?: string;
    manual?: string;
  };
  platforms: ('darwin' | 'linux' | 'win32')[];
  checkCommand?: string; // e.g., 'node --version'
  
  // Metadata
  homepage?: string;
  documentation?: string;
  github?: string;
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  
  // Features
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  pricing: 'free' | 'freemium' | 'paid' | 'open-source';
  usageExample?: string;
  relatedTools?: string[];
  tags?: string[];
  notes?: string;
}

export const CLI_TOOLS: CLITool[] = [
  // ===========================================================================
  // DEVELOPMENT TOOLS (17)
  // ===========================================================================
  {
    id: 'node',
    name: 'Node.js',
    description: 'JavaScript runtime for server-side development',
    category: 'development',
    installCommands: {
      brew: 'brew install node',
      apt: 'sudo apt-get install nodejs',
      manual: 'https://nodejs.org/download',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'node --version',
    homepage: 'https://nodejs.org',
    documentation: 'https://nodejs.org/docs',
    github: 'https://github.com/nodejs/node',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'node script.js',
    relatedTools: ['npm', 'pnpm', 'yarn', 'bun'],
    tags: ['javascript', 'runtime', 'server', 'backend'],
  },
  {
    id: 'npm',
    name: 'npm',
    description: 'Node Package Manager - install and manage JavaScript packages',
    category: 'development',
    installCommands: {
      brew: 'brew install npm',
      manual: 'Bundled with Node.js',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'npm --version',
    homepage: 'https://www.npmjs.com',
    documentation: 'https://docs.npmjs.com',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'npm install package-name',
    relatedTools: ['pnpm', 'yarn', 'bun'],
    tags: ['javascript', 'package-manager', 'dependencies'],
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    description: 'Fast, disk space efficient package manager alternative to npm',
    category: 'development',
    installCommands: {
      npm: 'npm install -g pnpm',
      brew: 'brew install pnpm',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'pnpm --version',
    homepage: 'https://pnpm.io',
    documentation: 'https://pnpm.io/motivation',
    github: 'https://github.com/pnpm/pnpm',
    difficulty: 'intermediate',
    pricing: 'open-source',
    usageExample: 'pnpm install',
    relatedTools: ['npm', 'yarn', 'bun'],
    tags: ['javascript', 'package-manager', 'fast', 'efficient'],
  },
  {
    id: 'yarn',
    name: 'Yarn',
    description: 'Fast, reliable, and secure dependency management',
    category: 'development',
    installCommands: {
      npm: 'npm install -g yarn',
      brew: 'brew install yarn',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'yarn --version',
    homepage: 'https://yarnpkg.com',
    documentation: 'https://classic.yarnpkg.com/docs',
    github: 'https://github.com/yarnpkg/yarn',
    difficulty: 'intermediate',
    pricing: 'open-source',
    usageExample: 'yarn install',
    relatedTools: ['npm', 'pnpm', 'bun'],
    tags: ['javascript', 'package-manager', 'reliable'],
  },
  {
    id: 'bun',
    name: 'Bun',
    description: 'Fast JavaScript all-in-one toolkit (runtime, package manager, bundler)',
    category: 'development',
    installCommands: {
      brew: 'brew install oven-sh/bun/bun',
      npm: 'npm install -g bun',
      manual: 'https://bun.sh/docs/installation',
    },
    platforms: ['darwin', 'linux'],
    checkCommand: 'bun --version',
    homepage: 'https://bun.sh',
    documentation: 'https://bun.sh/docs',
    github: 'https://github.com/oven-sh/bun',
    difficulty: 'intermediate',
    pricing: 'open-source',
    usageExample: 'bun install',
    relatedTools: ['node', 'npm', 'pnpm', 'deno'],
    tags: ['javascript', 'runtime', 'fast', 'bundler', 'typescript'],
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Distributed version control system',
    category: 'development',
    installCommands: {
      brew: 'brew install git',
      apt: 'sudo apt-get install git',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'git --version',
    homepage: 'https://git-scm.com',
    documentation: 'https://git-scm.com/docs',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'git clone https://github.com/user/repo',
    tags: ['version-control', 'scm', 'collaboration'],
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Popular programming language for data science, AI, and scripting',
    category: 'development',
    installCommands: {
      brew: 'brew install python3',
      apt: 'sudo apt-get install python3',
      manual: 'https://www.python.org/downloads',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'python3 --version',
    homepage: 'https://www.python.org',
    documentation: 'https://docs.python.org',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'python3 script.py',
    relatedTools: ['pip', 'conda', 'poetry'],
    tags: ['python', 'programming', 'ai', 'data-science'],
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Systems programming language emphasizing safety and performance',
    category: 'development',
    installCommands: {
      manual: 'https://www.rust-lang.org/tools/install',
      brew: 'brew install rust',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'rustc --version',
    homepage: 'https://www.rust-lang.org',
    documentation: 'https://doc.rust-lang.org',
    difficulty: 'advanced',
    pricing: 'open-source',
    usageExample: 'cargo build',
    tags: ['rust', 'systems-programming', 'performance'],
  },
  {
    id: 'go',
    name: 'Go',
    description: 'Compiled language for building fast, efficient backend services',
    category: 'development',
    installCommands: {
      brew: 'brew install go',
      apt: 'sudo apt-get install golang-go',
      manual: 'https://golang.org/dl',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'go version',
    homepage: 'https://golang.org',
    documentation: 'https://golang.org/doc',
    difficulty: 'intermediate',
    pricing: 'open-source',
    usageExample: 'go run main.go',
    tags: ['go', 'backend', 'performance', 'concurrency'],
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Containerization platform for building, shipping, and running applications',
    category: 'devops',
    installCommands: {
      brew: 'brew install docker',
      manual: 'https://www.docker.com/get-started',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'docker --version',
    homepage: 'https://www.docker.com',
    documentation: 'https://docs.docker.com',
    difficulty: 'intermediate',
    pricing: 'freemium',
    usageExample: 'docker run -it ubuntu bash',
    tags: ['containers', 'devops', 'infrastructure'],
  },

  // ===========================================================================
  // PRODUCTIVITY TOOLS (10)
  // ===========================================================================
  {
    id: 'curl',
    name: 'curl',
    description: 'Command-line tool for making HTTP requests',
    category: 'utilities',
    installCommands: {
      apt: 'sudo apt-get install curl',
      brew: 'brew install curl',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'curl --version',
    homepage: 'https://curl.se',
    documentation: 'https://curl.se/docs',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'curl https://api.example.com',
    tags: ['http', 'api', 'networking'],
  },
  {
    id: 'wget',
    name: 'wget',
    description: 'Download files from the web via HTTP/HTTPS',
    category: 'utilities',
    installCommands: {
      apt: 'sudo apt-get install wget',
      brew: 'brew install wget',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'wget --version',
    homepage: 'https://www.gnu.org/software/wget',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'wget https://example.com/file.zip',
    tags: ['download', 'http', 'utilities'],
  },
  {
    id: 'tmux',
    name: 'tmux',
    description: 'Terminal multiplexer for managing multiple terminal sessions',
    category: 'productivity',
    installCommands: {
      apt: 'sudo apt-get install tmux',
      brew: 'brew install tmux',
    },
    platforms: ['darwin', 'linux'],
    checkCommand: 'tmux -V',
    homepage: 'https://github.com/tmux/tmux',
    github: 'https://github.com/tmux/tmux',
    difficulty: 'intermediate',
    pricing: 'open-source',
    usageExample: 'tmux new-session -s work',
    tags: ['terminal', 'multiplexing', 'productivity'],
  },
  {
    id: 'vim',
    name: 'Vim',
    description: 'Highly configurable text editor',
    category: 'development',
    installCommands: {
      apt: 'sudo apt-get install vim',
      brew: 'brew install vim',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'vim --version',
    homepage: 'https://www.vim.org',
    documentation: 'https://www.vim.org/docs.php',
    difficulty: 'advanced',
    pricing: 'open-source',
    usageExample: 'vim file.txt',
    tags: ['editor', 'text-editing', 'advanced'],
  },
  {
    id: 'neovim',
    name: 'Neovim',
    description: 'Modern reimplementation of Vim with better extensibility',
    category: 'development',
    installCommands: {
      brew: 'brew install neovim',
      apt: 'sudo apt-get install neovim',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'nvim --version',
    homepage: 'https://neovim.io',
    github: 'https://github.com/neovim/neovim',
    difficulty: 'advanced',
    pricing: 'open-source',
    usageExample: 'nvim file.txt',
    tags: ['editor', 'vim', 'lua', 'extensible'],
  },
  {
    id: 'ripgrep',
    name: 'ripgrep (rg)',
    description: 'Fast line-oriented search tool (better than grep)',
    category: 'utilities',
    installCommands: {
      brew: 'brew install ripgrep',
      cargo: 'cargo install ripgrep',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'rg --version',
    homepage: 'https://github.com/BurntSushi/ripgrep',
    github: 'https://github.com/BurntSushi/ripgrep',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'rg "search pattern" .',
    tags: ['search', 'grep', 'utilities', 'fast'],
  },
  {
    id: 'fzf',
    name: 'fzf',
    description: 'Fuzzy finder for command-line - find files, history, processes interactively',
    category: 'productivity',
    installCommands: {
      brew: 'brew install fzf',
      apt: 'sudo apt-get install fzf',
      cargo: 'cargo install fzf',
    },
    platforms: ['darwin', 'linux'],
    checkCommand: 'fzf --version',
    homepage: 'https://github.com/junegunn/fzf',
    github: 'https://github.com/junegunn/fzf',
    difficulty: 'intermediate',
    pricing: 'open-source',
    usageExample: 'fzf | xargs vim',
    tags: ['fuzzy-finder', 'search', 'productivity'],
  },

  // ===========================================================================
  // CLOUD & INFRASTRUCTURE (8)
  // ===========================================================================
  {
    id: 'aws-cli',
    name: 'AWS CLI',
    description: 'Command-line interface for Amazon Web Services',
    category: 'cloud',
    installCommands: {
      pip: 'pip install awscli',
      brew: 'brew install awscli',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'aws --version',
    homepage: 'https://aws.amazon.com/cli',
    documentation: 'https://docs.aws.amazon.com/cli',
    difficulty: 'intermediate',
    pricing: 'free',
    usageExample: 'aws s3 ls',
    tags: ['aws', 'cloud', 'infrastructure'],
  },
  {
    id: 'gcloud',
    name: 'Google Cloud CLI',
    description: 'Command-line tool for Google Cloud Platform',
    category: 'cloud',
    installCommands: {
      manual: 'https://cloud.google.com/sdk/docs/install',
      brew: 'brew install google-cloud-sdk',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'gcloud --version',
    homepage: 'https://cloud.google.com',
    documentation: 'https://cloud.google.com/docs',
    difficulty: 'intermediate',
    pricing: 'free',
    usageExample: 'gcloud compute instances list',
    tags: ['gcp', 'google-cloud', 'infrastructure'],
  },
  {
    id: 'kubectl',
    name: 'kubectl',
    description: 'Command-line tool for Kubernetes cluster management',
    category: 'devops',
    installCommands: {
      brew: 'brew install kubectl',
      manual: 'https://kubernetes.io/docs/tasks/tools',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'kubectl version --client',
    homepage: 'https://kubernetes.io',
    documentation: 'https://kubernetes.io/docs',
    difficulty: 'advanced',
    pricing: 'open-source',
    usageExample: 'kubectl get pods',
    tags: ['kubernetes', 'containers', 'orchestration'],
  },
  {
    id: 'terraform',
    name: 'Terraform',
    description: 'Infrastructure as Code tool for building cloud infrastructure',
    category: 'devops',
    installCommands: {
      brew: 'brew install terraform',
      manual: 'https://www.terraform.io/downloads.html',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'terraform version',
    homepage: 'https://www.terraform.io',
    documentation: 'https://www.terraform.io/docs',
    difficulty: 'advanced',
    pricing: 'open-source',
    usageExample: 'terraform apply',
    tags: ['infrastructure', 'iac', 'cloud'],
  },

  // ===========================================================================
  // AI/ML TOOLS (5)
  // ===========================================================================
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run large language models locally (Llama, Mistral, etc.)',
    category: 'ai-ml',
    installCommands: {
      brew: 'brew install ollama',
      manual: 'https://ollama.ai/download',
    },
    platforms: ['darwin', 'linux'],
    checkCommand: 'ollama --version',
    homepage: 'https://ollama.ai',
    documentation: 'https://github.com/ollama/ollama',
    github: 'https://github.com/ollama/ollama',
    difficulty: 'intermediate',
    pricing: 'free',
    usageExample: 'ollama run llama2',
    tags: ['llm', 'local', 'ai', 'ml'],
  },
  {
    id: 'huggingface-cli',
    name: 'HuggingFace CLI',
    description: 'Access and download models from HuggingFace Hub',
    category: 'ai-ml',
    installCommands: {
      pip: 'pip install huggingface-hub',
    },
    platforms: ['darwin', 'linux', 'win32'],
    checkCommand: 'huggingface-cli --version',
    homepage: 'https://huggingface.co',
    documentation: 'https://huggingface.co/docs/hub/cli',
    difficulty: 'intermediate',
    pricing: 'free',
    usageExample: 'huggingface-cli download model-name',
    tags: ['huggingface', 'ml', 'models', 'nlp'],
  },

  // ===========================================================================
  // SYSTEM TOOLS (5)
  // ===========================================================================
  {
    id: 'htop',
    name: 'htop',
    description: 'Interactive process viewer and system monitor',
    category: 'system',
    installCommands: {
      apt: 'sudo apt-get install htop',
      brew: 'brew install htop',
    },
    platforms: ['darwin', 'linux'],
    checkCommand: 'htop --version',
    homepage: 'https://hisham.hm/htop',
    difficulty: 'beginner',
    pricing: 'open-source',
    usageExample: 'htop',
    tags: ['monitoring', 'process', 'system'],
  },
];

/**
 * Get tool by ID
 */
export function getToolById(id: string): CLITool | undefined {
  return CLI_TOOLS.find((t) => t.id === id);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: CLITool['category']): CLITool[] {
  return CLI_TOOLS.filter((t) => t.category === category);
}

/**
 * Search tools by name or description
 */
export function searchTools(query: string): CLITool[] {
  const q = query.toLowerCase();
  return CLI_TOOLS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q))
  );
}

/**
 * Get tools for beginners
 */
export function getBeginnerTools(): CLITool[] {
  return CLI_TOOLS.filter((t) => t.difficulty === 'beginner');
}

/**
 * Get free and open-source tools
 */
export function getFreeTools(): CLITool[] {
  return CLI_TOOLS.filter((t) => t.pricing === 'open-source' || t.pricing === 'free');
}
