import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { emptyProject, loadProject } from "@openautomation/core";
import { escapeHtml, generateViewer, highlightSource, renderBlock, renderMembers, renderNetwork, renderProject, renderTagTable, type Network, type InstructionRenderer } from "./index.js";

const fixture = fileURLToPath(new URL("../../../corpus/synthetic/v18/basic", import.meta.url));

describe("source highlighting", () => {
  it("escapes executable content and preserves strings, symbols and comments", () => {
    const html = highlightSource('IF "Start" THEN\n  x := \'IF // <img src=x>\'; (* THEN *)\nEND_IF;', "SCL");
    expect(html).toContain('<span class="keyword">IF</span>');
    expect(html).toContain('<span class="symbol">&quot;Start&quot;</span>');
    expect(html).toContain('<span class="string">&#39;IF // &lt;img src=x&gt;&#39;</span>');
    expect(html).toContain('<span class="comment">(* THEN *)</span>');
    expect(html).not.toContain('<img');
  });
  it("highlights STL instructions and numeric literals without changing plain text", () => {
    const source = 'A "Enable"\nAN "Stop"\n= "Running"\nL 16#FF // example\nT #Value';
    const html = highlightSource(source, "STL");
    expect(html).toContain('<span class="keyword">AN</span>');
    expect(html).toContain('<span class="number">16#FF</span>');
    const restored = html.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"');
    expect(restored).toBe(source);
  });
});

describe("object rendering", () => {
  it("renders nested DB fields and escapes tag data", () => {
    expect(renderMembers([{ name: "Motor", dataType: "Struct", children: [{ name: "Running", dataType: "Bool" }] }]))
      .toContain('<td>Motor.Running</td>');
    const html = renderTagTable({ name: "Inputs", group: [], source: "x", tags: [{ name: '<script>bad()</script>', dataType: "Bool", comment: '"quoted" & safe' }] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;quoted&quot; &amp; safe');
  });
  it("keeps unsupported languages and missing sources visible", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    expect(renderBlock(plc.blocks.find((b) => b.language === "LAD")!)).toContain("Verified native");
    expect(renderBlock(plc.blocks.find((b) => b.language === "SCL")!)).toContain("source is unavailable");
    expect(renderProject(emptyProject())).toContain("No PLC objects found");
  });
});

describe("network infrastructure", () => {
  const network: Network = { language: "LAD", nodes: [
    { id: "b", instruction: "FixtureBox", inputs: ["in"], outputs: [] },
    { id: "a", instruction: "FixtureBox", operand: "<example>", inputs: [], outputs: ["out"] },
  ], wires: [{ from: { node: "a", port: "out" }, to: { node: "b", port: "in" } }] };
  it("reports unsupported instructions rather than drawing an incomplete network", () => {
    expect(renderNetwork(network)).toEqual({ status: "unsupported", instructions: ["FixtureBox"] });
  });
  it("lays out an explicitly registered synthetic renderer deterministically", () => {
    const draw: InstructionRenderer = (node, g) => `<g><rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"/><text>${escapeHtml(node.operand ?? node.id)}</text></g>`;
    const renderers = new Map([["FixtureBox", draw]]);
    const first = renderNetwork(network, renderers);
    expect(first.status).toBe("rendered");
    if (first.status === "rendered") {
      expect(first.svg).toContain('&lt;example&gt;');
      expect(first.svg).toContain('<path d="M 280 90 H 320 V 250 H 80"');
      expect(renderNetwork({ ...network, nodes: [...network.nodes].reverse() }, renderers)).toEqual(first);
    }
  });
  it("rejects broken node IDs and wire endpoints", () => {
    expect(() => renderNetwork({ ...network, nodes: [network.nodes[0]!, network.nodes[0]!] })).toThrow("Duplicate");
    expect(() => renderNetwork({ ...network, wires: [{ from: { node: "a", port: "missing" }, to: { node: "b", port: "in" } }] })).toThrow("unknown");
  });
});

describe("standalone viewer", () => {
  it("loads and highlights an adjacent AWL file through the project loader", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oa-stl-viewer-"));
    try {
      await cp(fixture, join(dir, "export"), { recursive: true });
      await writeFile(join(dir, "export/PLC_1/blocks/FC_Logic.xml"),
        '<Document><SW.Blocks.FC><AttributeList><Name>FC_Logic</Name><ProgrammingLanguage>STL</ProgrammingLanguage></AttributeList></SW.Blocks.FC></Document>');
      await writeFile(join(dir, "export/PLC_1/blocks/FC_Logic.awl"), 'A "Enable"\n= "Running"\n');
      const project = await loadProject(join(dir, "export"));
      expect(project.plcs[0]!.blocks.find((b) => b.name === "FC_Logic")!.textSource).toBe("PLC_1/blocks/FC_Logic.awl");
      await generateViewer(project, join(dir, "export"), join(dir, "viewer"));
      const html = await readFile(join(dir, "viewer/index.html"), "utf8");
      expect(html).toContain('class="language-stl"');
      expect(html).toContain('<span class="keyword">A</span>');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("writes identical bytes across roots, clocks and model ordering", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oa-viewer-"));
    try {
      await cp(fixture, join(dir, "copy"), { recursive: true });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2000-01-01T00:00:00Z"));
      const project = await loadProject(fixture);
      expect(await generateViewer(project, fixture, join(dir, "a"))).toEqual(["index.html"]);
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      const copy = await loadProject(join(dir, "copy"));
      copy.plcs[0]!.blocks.reverse();
      copy.plcs[0]!.tagTables.reverse();
      await generateViewer(copy, join(dir, "copy"), join(dir, "b"));
      const html = await readFile(join(dir, "a/index.html"), "utf8");
      expect(await readFile(join(dir, "b/index.html"), "utf8")).toBe(html);
      expect(html).toContain('class="language-scl"');
      expect(html).toContain('Motor1');
      expect(html).toContain('Start button');
      expect(html).toContain("default-src 'none'");
      expect(html).not.toContain(dir);
    } finally { vi.useRealTimers(); await rm(dir, { recursive: true, force: true }); }
  });
  it("does not read text sources outside the export and reports missing source files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oa-viewer-path-"));
    try {
      await cp(fixture, join(dir, "copy"), { recursive: true });
      await writeFile(join(dir, "secret.scl"), 'PRIVATE_SENTINEL');
      const project = await loadProject(join(dir, "copy"));
      const block = project.plcs[0]!.blocks.find((b) => b.language === "SCL")!;
      block.textSource = "../secret.scl";
      await generateViewer(project, join(dir, "copy"), join(dir, "out"));
      const html = await readFile(join(dir, "out/index.html"), "utf8");
      expect(html).not.toContain('PRIVATE_SENTINEL');
      expect(html).toContain('outside export');
      expect(project.warnings).toEqual([]);
      block.textSource = "missing.scl";
      await generateViewer(project, join(dir, "copy"), join(dir, "out"));
      expect(await readFile(join(dir, "out/index.html"), "utf8")).toContain("missing.scl: readable source unavailable");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
