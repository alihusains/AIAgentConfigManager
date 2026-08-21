"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKiloAdapter = createKiloAdapter;
const opencode_style_1 = require("./opencode-style");
const KILO_CONFIG_PATHS = {
    darwin: '~/.config/kilo/kilo.jsonc',
    win32: '%APPDATA%\\kilo\\kilo.jsonc',
    linux: '~/.config/kilo/kilo.jsonc',
};
/**
 * Create a Kilo Code CLI adapter.
 */
function createKiloAdapter() {
    return new opencode_style_1.OpenCodeStyleAdapter({
        id: 'kilo',
        name: 'Kilo Code',
        description: 'Kilo Code CLI (OpenCode fork, Cline/Roo lineage) — provider-agnostic coding agent with MCP support.',
        binaries: ['kilo'],
        configPaths: { ...KILO_CONFIG_PATHS },
    });
}
//# sourceMappingURL=kilo.js.map