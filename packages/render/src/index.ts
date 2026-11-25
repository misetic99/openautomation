import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { compare, type Block, type Member, type ProjectModel, type TagTable } from "@openautomation/core";
import { escapeHtml } from "./html.js";
import { highlightSource } from "./highlight.js";

export { escapeHtml } from "./html.js";
export { highlightSource } from "./highlight.js";
export * from "./network.js";

function table(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export function renderMembers(members: readonly Member[]): string {
  const rows: string[][] = [];
  const visit = (items: readonly Member[], parent: string): void => {
    for (const item of items) {
      const path = parent ? `${parent}.${item.name}` : item.name;
      rows.push([path, item.dataType, item.comment ?? ""]);
      if (item.children) visit(item.children, path);
    }
  };
  visit(members, "");
  return table(["Member", "Data type", "Comment"], rows);
}

export function renderTagTable(tags: TagTable): string {
  return table(["Name", "Data type", "Address", "Comment"], [...tags.tags]
    .sort((a, b) => compare(a.name, b.name)).map((tag) => [tag.name, tag.dataType, tag.address ?? "", tag.comment ?? ""]));
}

/** Render supported block content, or a visible unsupported/missing-source notice. */
export function renderBlock(block: Block, source?: string): string {
  if (block.kind === "DB") return renderMembers(block.members ?? []);
  if (block.language === "SCL" || block.language === "STL") {
    return source === undefined ? '<p class="notice">Readable source is unavailable.</p>'
      : `<pre><code class="language-${block.language.toLowerCase()}">${highlightSource(source, block.language)}</code></pre>`;
  }
  return `<p class="notice">${escapeHtml(block.language ?? "Unknown language")} rendering is unavailable. Verified native instruction and wire examples are required.</p>`;
}

const style = `:root{font-family:system-ui,sans-serif;color:#192c3a;background:#f2f5f7;color-scheme:light}*{box-sizing:border-box}body{margin:0}header{padding:1.5rem 2rem;background:#163445;color:white}header h1{margin:0 0 .5rem}header p{margin:0}aside{padding:1.5rem;background:white;border-right:1px solid #d3dee4}nav ul{padding-left:1.2rem}nav li{margin:.4rem 0}a{color:#006c83}main{padding:1.5rem;min-width:0;max-width:100rem}article{padding:1.25rem;background:white;border:1px solid #d3dee4;border-radius:.4rem;margin-bottom:1rem;overflow:auto;scroll-margin:1rem}h2{margin-top:2rem}h3{margin-top:0}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:.6rem;border-bottom:1px solid #d3dee4;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf3f5}pre{overflow:auto;background:#112a37;color:#e0ebf0;padding:1rem;tab-size:4;border-radius:.25rem;line-height:1.6}code{font-family:Consolas,monospace}.keyword{color:#86d4ff;font-weight:600}.comment{color:#a1b5bb}.string{color:#edc48b}.symbol{color:#c6e6d7}.number{color:#d1b4ff}.operator{color:#ffb8bf}.notice{background:#fff5d9;border-left:4px solid #ba8500;padding:.8rem}.location{font-size:.85rem;color:#465c6b}details{margin:.5rem 0}summary{cursor:pointer}a:focus-visible,summary:focus-visible{outline:3px solid #be7800;outline-offset:3px}@media(min-width:60rem){.layout{display:grid;grid-template-columns:20rem 1fr}aside{position:sticky;top:0;height:100vh;overflow:auto}}@media print{aside{display:none}main{padding:0}article{break-inside:avoid}pre{white-space:pre-wrap}}`;

/** Standalone offline HTML; all model and source content is escaped. */
export function renderProject(project: ProjectModel, sources: ReadonlyMap<string, string> = new Map()): string {
  const navigation: string[] = [];
  const content: string[] = [];
  for (const [plcIndex, plc] of [...project.plcs].sort((a, b) => compare(a.name, b.name)).entries()) {
    const links: string[] = [];
    content.push(`<h2 id="plc-${plcIndex}">${escapeHtml(plc.name)}</h2>`);
    const objects = [
      ...plc.blocks.map((block) => ({ name: [...block.group, block.name].join("/"), kind: block.kind, source: block.source, body: renderBlock(block, block.textSource ? sources.get(block.textSource) : undefined) })),
      ...plc.types.map((type) => ({ name: [...type.group, type.name].join("/"), kind: "UDT", source: type.source, body: renderMembers(type.members) })),
      ...plc.tagTables.map((tags) => ({ name: [...tags.group, tags.name].join("/"), kind: "Tags", source: tags.source, body: renderTagTable(tags) })),
    ].sort((a, b) => compare(a.kind, b.kind) || compare(a.name, b.name) || compare(a.source, b.source));
    for (const [index, object] of objects.entries()) {
      const id = `object-${plcIndex}-${index}`;
      const label = `${object.kind}: ${object.name}`;
      links.push(`<li><a href="#${id}">${escapeHtml(label)}</a></li>`);
      content.push(`<article id="${id}"><h3>${escapeHtml(label)}</h3><p class="location">${escapeHtml(object.source)}</p>${object.body}</article>`);
    }
    navigation.push(`<details open><summary>${escapeHtml(plc.name)}</summary><ul>${links.join("")}</ul></details>`);
  }
  const warnings = project.warnings.length ? `<section class="notice"><h2>Load warnings</h2><ul>${[...project.warnings].sort(compare).map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></section>` : "";
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>OpenAutomation project viewer</title><style>${style}</style></head><body><header><h1>Project viewer</h1><p>${escapeHtml(project.tiaVersion || "Unknown engineering version")} &middot; ${project.plcs.length} ${project.plcs.length === 1 ? "PLC" : "PLCs"} &middot; Offline export</p></header><div class="layout"><aside><nav aria-label="Project objects"><h2>Project objects</h2>${navigation.join("") || "<p>No PLC objects found.</p>"}</nav></aside><main>${warnings}${content.join("") || "<p>No PLC objects found.</p>"}</main></div></body></html>\n`;
}

function isWithin(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Read adjacent text sources safely and write a deterministic standalone index.html. */
export async function generateViewer(project: ProjectModel, exportRoot: string, outDir: string): Promise<string[]> {
  const root = await realpath(exportRoot);
  const sources = new Map<string, string>();
  const warnings = [...project.warnings];
  const paths = [...new Set(project.plcs.flatMap((plc) => plc.blocks.flatMap((block) => block.textSource ? [block.textSource] : [])))].sort(compare);
  for (const path of paths) {
    try {
      const absolute = resolve(root, path);
      if (!isWithin(root, absolute) || !isWithin(root, await realpath(absolute))) throw new Error("Source outside export");
      sources.set(path, (await readFile(absolute, "utf8")).replace(/^\uFEFF/, ""));
    } catch { warnings.push(`${path}: readable source unavailable or outside export`); }
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), renderProject({ ...project, warnings }, sources), "utf8");
  return ["index.html"];
}
