// Smoke test: spawn the formengine MCP server over stdio, drive it with a real
// MCP client, and assert the full build → export flow produces on-convention JSON.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, 'mcp-formengine.mjs');

const transport = new StdioClientTransport({ command: 'node', args: [serverPath] });
const client = new Client({ name: 'smoke', version: '0.0.0' }, { capabilities: {} });
await client.connect(transport);

const text = (r) => r.content?.map((c) => c.text).join('\n') ?? '';
let pass = 0, fail = 0;
const check = (label, cond) => { (cond ? (pass++, console.log('✅', label)) : (fail++, console.log('❌', label))); };

// 1. tools advertised = builder edit tools + lifecycle tools
const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
check(`lists tools (${tools.length})`, tools.length >= 8);
check('exposes lifecycle tools', ['new_form', 'import_form', 'export_form', 'get_form'].every((n) => names.includes(n)));
check('exposes edit tools (add_section, add_field)', names.includes('add_section') && names.includes('add_field'));
check('every tool has an inputSchema', tools.every((t) => t.inputSchema && t.inputSchema.type === 'object'));

// 2. build a small form
await client.callTool({ name: 'new_form', arguments: {} });
const sec = text(await client.callTool({ name: 'add_section', arguments: { container_name: 'moulding' } }));
check('add_section responds', sec.length > 0 && !sec.startsWith('⚠'));
const fld = text(await client.callTool({ name: 'add_field', arguments: { section: 'moulding', label: 'Total Qty', field_type: 'number', required: true } }));
check('add_field responds', !fld.startsWith('⚠'));

// 3. bad call must NOT corrupt state (returns a ⚠ message)
const bad = text(await client.callTool({ name: 'add_field', arguments: { section: 'does_not_exist', label: 'X', type: 'text' } }));
check('bad call returns ⚠ (no crash)', bad.includes('⚠'));

// 3b. custom np-dlms component: spectrometer (advertised + buildable via MCP)
check('spectrometer tool advertised', names.includes('add_field') && tools.find((t) => t.name === 'add_field')?.inputSchema?.properties?.url);
const spec = text(await client.callTool({ name: 'add_field', arguments: { section: 'moulding', label: 'Composition', field_type: 'spectrometer', url: 'https://dev/read', elements: 'C,Si,Mn' } }));
check('add spectrometer field responds', !spec.startsWith('⚠'));

// 4. export → valid FormEngine JSON with our invariants
const exported = JSON.parse(text(await client.callTool({ name: 'export_form', arguments: {} })));
const nodeKeys = [];
let spectro = null;
(function walk(nodes) { (nodes || []).forEach((n) => { if (n.key) nodeKeys.push(n.key); if (n.type === 'RsSpectrometerReading') spectro = n; walk(n.children); }); })(exported.form?.children || exported.children || []);
check('export has a form/version', !!(exported.version || exported.form));
check('no duplicate node keys', new Set(nodeKeys).size === nodeKeys.length);
check('no legacy __N__ keys', !nodeKeys.some((k) => /__\d+__/.test(k)));
check('export emits RsSpectrometerReading with dataKey + props', !!spectro && !!spectro.dataKey && spectro.props?.url?.value === 'https://dev/read' && spectro.props?.elements?.value === 'C,Si,Mn');

// 4b. preview_url returns a self-contained /preview#f= link that decodes back to the form
const previewUrl = text(await client.callTool({ name: 'preview_url', arguments: {} }));
check('preview_url returns a /preview#f= link', /\/preview#f=.+/.test(previewUrl));
let decodedOk = false;
try {
  const { decodeForm, payloadFromHash } = await import('../src/ui-builder/preview-url.js');
  const round = JSON.parse(decodeForm(payloadFromHash(previewUrl.split('#')[1] ? '#' + previewUrl.split('#')[1] : '')));
  decodedOk = !!(round.form || round.version);
} catch { decodedOk = false; }
check('preview link decodes back to the form JSON', decodedOk);

// 5. get_form summary + form://current resource
const summary = text(await client.callTool({ name: 'get_form', arguments: {} }));
check('get_form returns summary JSON', summary.includes('moulding'));
const res = await client.readResource({ uri: 'form://current' });
check('form://current resource readable', (res.contents?.[0]?.text || '').length > 0);

// 6. multi-step flow: add a step, edit each, export → {sections:[…]}
await client.callTool({ name: 'new_form', arguments: {} });
await client.callTool({ name: 'add_section', arguments: { container_name: 'step_one' } });
await client.callTool({ name: 'add_step', arguments: { name: 'Inspection' } });
await client.callTool({ name: 'add_section', arguments: { container_name: 'step_two' } });
const listed = JSON.parse(text(await client.callTool({ name: 'list_steps', arguments: {} })));
check('list_steps shows 2 steps', Array.isArray(listed) && listed.length === 2 && listed[1].name === 'Inspection');
const ms = JSON.parse(text(await client.callTool({ name: 'export_form', arguments: {} })));
check('multi-step export has sections[]', Array.isArray(ms.sections) && ms.sections.length === 2);
check('each step is its own FormEngine form', !!ms.sections[0].form_json?.form && !!ms.sections[1].form_json?.form);
check('multi-step preview_url works', /\/preview#f=/.test(text(await client.callTool({ name: 'preview_url', arguments: {} }))));
// switch back to step 1 and confirm edits target the active step
await client.callTool({ name: 'switch_step', arguments: { index: 0 } });
await client.callTool({ name: 'add_section', arguments: { container_name: 'extra_on_one' } });
const ms2 = JSON.parse(text(await client.callTool({ name: 'export_form', arguments: {} })));
check('edit targeted the active step', JSON.stringify(ms2.sections[0]).includes('extra_on_one') && !JSON.stringify(ms2.sections[1]).includes('extra_on_one'));

// 7. Tier-1 behaviors: default value, calculated field, validations
await client.callTool({ name: 'new_form', arguments: {} });
await client.callTool({ name: 'add_section', arguments: { container_name: 'm' } });
await client.callTool({ name: 'add_field', arguments: { section: 'm', field_type: 'date', label: 'Pour Date' } });
await client.callTool({ name: 'add_field', arguments: { section: 'm', field_type: 'number', label: 'A' } });
await client.callTool({ name: 'add_field', arguments: { section: 'm', field_type: 'number', label: 'B' } });
check('set_default advertised', names.includes('set_default'));
const sd = text(await client.callTool({ name: 'set_default', arguments: { section: 'm', field: 'Pour Date', mode: 'today' } }));
check('set_default responds', !sd.startsWith('⚠'));
await client.callTool({ name: 'add_total', arguments: { section: 'm', label: 'Total', fields: ['m__a', 'm__b'], op: 'sum' } });
await client.callTool({ name: 'add_validation', arguments: { section: 'm', field: 'A', type: 'between', min: 1, max: 10 } });
const t1 = JSON.parse(text(await client.callTool({ name: 'export_form', arguments: {} })));
const t1s = JSON.stringify(t1);
check('default_value action emitted', !!t1.actions.set_default_value);
check('calculated field + between validation in export', t1s.includes('m__a') && t1s.includes('Number(value) < 1'));

// 8. on-submit raw code (advanced / developer)
await client.callTool({ name: 'new_form', arguments: {} });
await client.callTool({ name: 'add_section', arguments: { container_name: 'm' } });
check('set_on_submit advertised', names.includes('set_on_submit'));
await client.callTool({ name: 'set_on_submit', arguments: { code: 'e.data.flag = true;' } });
const os = JSON.parse(text(await client.callTool({ name: 'export_form', arguments: {} })));
check('onSubmit emitted + try/catch wrapped', !!os.actions.onSubmit && /try \{/.test(os.actions.onSubmit.body) && os.actions.onSubmit.body.includes('e.data.flag'));

await client.close();
console.log(`\nmcp-smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
