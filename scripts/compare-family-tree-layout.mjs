import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { familyTreeFixtures } from '../e2e/fixtures/family-tree-fixtures.ts';
import { layoutFamilyTree } from '../src/app/components/catchhole/relationship/family-tree-layout.ts';

const mermaidRoot = resolve(process.env.MERMAID_COMPARISON_ROOT ?? '/tmp/catchhole-gh261-layout-comparison/node_modules/mermaid/dist');
const output = resolve(process.env.LAYOUT_COMPARISON_OUTPUT ?? '/tmp/catchhole-gh261-layout-comparison/output');
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const path = resolve(mermaidRoot, `.${new URL(request.url, 'http://localhost').pathname}`);
    if (!path.startsWith(`${mermaidRoot}/`)) throw new Error('Invalid comparison path');
    response.setHeader('Content-Type', extname(path) === '.mjs' || extname(path) === '.js' ? 'application/javascript' : 'text/plain');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolveStarted => server.listen(0, '127.0.0.1', resolveStarted));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
const summaries = [];
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
function layoutSvg(layout) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
  <style>text{font:14px sans-serif} .name{font-weight:600} path{fill:none;stroke:#5c6f8d;stroke-width:2} rect{fill:#f6f9ff;stroke:#8aa9dc;rx:12}</style>
  ${layout.edges.map(edge => `<path d="${edge.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')}"/><text x="${edge.labelPosition.x}" y="${edge.labelPosition.y}" text-anchor="middle">${escape(edge.id)} ${escape(edge.kind)}</text>`).join('')}
  ${layout.junctions.map(junction => `<circle cx="${junction.position.x}" cy="${junction.position.y}" r="4" fill="#5c6f8d"/>`).join('')}
  ${layout.nodes.map(node => `<rect x="${node.position.x}" y="${node.position.y}" width="${node.width}" height="${node.height}"/><text class="name" x="${node.position.x + node.width / 2}" y="${node.position.y + node.height / 2}" text-anchor="middle">${escape(node.name)}</text>`).join('')}</svg>`;
}
function metrics(fixture, positions) {
  const byId = new Map(positions.map(node => [node.id, node]));
  if (fixture.nodes.some(node => !byId.has(node.id))) throw new Error(`Missing measured node in ${fixture.id}`);
  const parentEdges = fixture.edges.filter(edge => edge.kind === 'PARENT_OF');
  const peers = fixture.edges.filter(edge => edge.kind !== 'PARENT_OF');
  return { nodes: positions.length, parentEdges: parentEdges.length,
    parentsAbove: parentEdges.filter(edge => byId.get(edge.subjectCharacterId)?.y < byId.get(edge.objectCharacterId)?.y).length,
    peerEdges: peers.length, peersAligned: peers.filter(edge => Math.abs(byId.get(edge.subjectCharacterId)?.y - byId.get(edge.objectCharacterId)?.y) < 2).length };
}
try {
  await page.goto(`${url}/mermaid.esm.min.mjs`);
  await page.evaluate(async moduleUrl => {
    const { default: mermaid } = await import(moduleUrl);
    window.comparisonMermaid = mermaid;
    document.body.innerHTML = '<main></main>';
  }, `${url}/mermaid.esm.min.mjs`);
  for (const fixture of familyTreeFixtures.slice(0, 4)) {
    const source = ['flowchart TB', ...fixture.nodes.map(node => `  ${node.id}["${node.name}"]`),
      ...fixture.edges.map(edge => `  ${edge.subjectCharacterId} ${edge.id}@${edge.kind === 'PARENT_OF' ? '-->' : '---'}|"${edge.id} ${edge.kind} ${edge.subtype}"| ${edge.objectCharacterId}`)].join('\n');
    const layout = await layoutFamilyTree(fixture);
    const elkSvg = layoutSvg(layout);
    await writeFile(resolve(output, `${fixture.id}-elk.svg`), elkSvg);
    const engines = {};
    let comparisonSvg = '';
    for (const engine of ['dagre', 'elk']) {
      const rendered = await page.evaluate(async ({ engine, source, id }) => {
        const mermaid = window.comparisonMermaid;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', layout: engine, theme: 'default', flowchart: { htmlLabels: false } });
        const { svg } = await mermaid.render(`diagram-${id}-${engine}`, source);
        document.querySelector('main').innerHTML = svg;
        const positions = [...document.querySelectorAll('main g.node')].map(node => {
          const bounds = node.getBoundingClientRect();
          return { id: node.getAttribute('data-id') ?? node.id.match(/flowchart-(.+)-\d+$/)?.[1], x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        });
        return { svg, positions, edges: document.querySelectorAll('main .edgePath path, main path.flowchart-link').length };
      }, { engine, source, id: fixture.id });
      await writeFile(resolve(output, `${fixture.id}-mermaid-${engine}.svg`), rendered.svg);
      comparisonSvg = rendered.svg;
      engines[engine] = { ...metrics(fixture, rendered.positions), renderedEdges: rendered.edges };
    }
    const summary = { fixture: fixture.id, mermaid: engines,
      elkFamilyLayout: { ...metrics(fixture, layout.nodes.map(node => ({ id: node.id, ...node.position }))), edges: layout.edges.length, junctions: layout.junctions.length, warnings: layout.warnings } };
    summaries.push(summary);
    await writeFile(resolve(output, `${fixture.id}.mmd`), source);
    await page.evaluate(({ elkSvg, comparisonSvg, label }) => {
      document.body.innerHTML = `<style>body{margin:24px;font-family:sans-serif}section{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{border:1px solid #ccd6e4;padding:16px;min-width:0}article svg{width:100%;height:auto}h2{font-size:18px}</style><h1>${label}</h1><section><article><h2>Mermaid 12.2 / ELK</h2>${comparisonSvg}</article><article><h2>ELK + family constraints</h2>${elkSvg}</article></section><main></main>`;
    }, { elkSvg, comparisonSvg, label: fixture.label });
    await page.screenshot({ path: resolve(output, `${fixture.id}-comparison.png`), fullPage: true });
  }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(summaries, null, 2));
  console.log(JSON.stringify({ output, summaries }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolveClosed => server.close(resolveClosed));
}
