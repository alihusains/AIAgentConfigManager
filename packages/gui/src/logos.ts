/**
 * Agent id -> logo filename (in `public/logos/`, copied to the dist root by Vite).
 * Kept as a .ts module so it type-checks without JSON-module resolution and is
 * bundled into the app — the browser then loads each logo locally, no runtime
 * network fetch. The logo *files* themselves live in `public/logos/`.
 */
const LOGO_FILES: Record<string, string> = {
  'chatgpt': 'chatgpt.svg',
  'claude-code': 'claude-code.svg',
  'opencode': 'opencode.ico',
  'mimo': 'mimo.png',
  'kilo': 'kilo.svg',
  'pi': 'pi.svg',
  'gemini': 'gemini.png',
  'junie': 'junie.svg',
  'omp': 'omp.svg',
  'reasonix': 'reasonix.svg',
  'freebuff': 'freebuff.png',
  'little-coder': 'little-coder.svg',
  'aider': 'aider.png',
  'cline': 'cline.png',
  'goose': 'goose.svg',
  'zed': 'zed.png',
  'continue': 'continue.png',
  'copilot-cli': 'copilot-cli.svg',
  'cursor-cli': 'cursor-cli.svg',
  'windsurf': 'windsurf.ico',
  'devin': 'devin.png',
  'jan': 'jan.ico',
  'ollama': 'ollama.png',
  'lmstudio': 'lmstudio.png',
  'amazonq': 'amazonq.png',
  'kimi': 'kimi.png',
  'qwen': 'qwen.svg',
  'crush': 'crush.png',
  'droid': 'droid.svg',
  'roo': 'roo.png',
  'amp': 'amp.svg',
  'codex-cli': 'codex-cli.svg',
};

const LOGO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(LOGO_FILES).map(([id, file]) => [id, `/logos/${file}`]),
);

export function logoUrl(id?: string): string | undefined {
  if (!id) return undefined;
  return LOGO_URLS[id];
}