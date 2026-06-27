// Bundle the MCP server + the form engine it imports into ONE self-contained
// file (server/dist/mcp.mjs). The Docker image ships only this artifact — no
// repo, no node_modules tree. It's a generated output (like the web app's
// dist/), never hand-edited: change the source, re-run `npm run mcp:bundle`.
import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, 'mcp-formengine.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: path.join(__dirname, 'dist', 'mcp.mjs'),
  // Some bundled deps are CJS and expect a `require`; provide one in the ESM output.
  banner: { js: "import { createRequire as __npCreateRequire } from 'module'; const require = __npCreateRequire(import.meta.url);" },
  logLevel: 'info',
});

console.log('bundled → server/dist/mcp.mjs');
