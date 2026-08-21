/**
 * Kilo Code CLI Adapter
 *
 * Kilo Code is an OpenCode fork (Cline/Roo lineage). Its CLI shares the
 * OpenCode config schema byte-for-byte, including the `mcp` key in the main
 * config file:
 *   - macOS/Linux: ~/.config/kilo/kilo.jsonc
 *   - Windows:     %APPDATA%\kilo\kilo.jsonc
 *
 * Because the on-disk schema is identical, this adapter is a thin
 * parameterization of OpenCodeStyleAdapter — only the binary name and the
 * config path differ.
 *
 * Source: https://kilo.ai/docs/code-with-ai/platforms/cli
 */
import { OpenCodeStyleAdapter } from './opencode-style';
/**
 * Create a Kilo Code CLI adapter.
 */
export declare function createKiloAdapter(): OpenCodeStyleAdapter;
//# sourceMappingURL=kilo.d.ts.map