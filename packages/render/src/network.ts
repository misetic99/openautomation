import { compare } from "@openautomation/core";
import { escapeHtml } from "./html.js";

/** Internal normalized graph contract. No native XML mapping is assumed. */
export interface NetworkNode {
  id: string;
  instruction: string;
  operand?: string;
  inputs: string[];
  outputs: string[];
}
export interface NetworkEndpoint { node: string; port: string }
export interface Network {
  language: "LAD" | "FBD";
  nodes: NetworkNode[];
  wires: { from: NetworkEndpoint; to: NetworkEndpoint }[];
}
export interface Geometry { x: number; y: number; width: number; height: number }
/** Renderers are trusted code and must escape all operand text they interpolate. */
export type InstructionRenderer = (node: NetworkNode, geometry: Geometry) => string;
export type NetworkResult = { status: "rendered"; svg: string }
  | { status: "unsupported"; instructions: string[] };

/** Deterministic graph scaffolding; instruction renderers require native fixture evidence. */
export function renderNetwork(network: Network, renderers: ReadonlyMap<string, InstructionRenderer> = new Map()): NetworkResult {
  const nodes = [...network.nodes].sort((a, b) => compare(a.id, b.id));
  const byId = new Map<string, NetworkNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`Duplicate network node: ${node.id}`);
    if (new Set(node.inputs).size !== node.inputs.length || new Set(node.outputs).size !== node.outputs.length) {
      throw new Error(`Duplicate port on node: ${node.id}`);
    }
    byId.set(node.id, node);
  }
  for (const wire of network.wires) {
    if (!byId.get(wire.from.node)?.outputs.includes(wire.from.port) || !byId.get(wire.to.node)?.inputs.includes(wire.to.port)) {
      throw new Error("Network wire references an unknown node or port");
    }
  }
  const unsupported = [...new Set(nodes.filter((n) => !renderers.has(n.instruction)).map((n) => n.instruction))].sort(compare);
  if (unsupported.length) return { status: "unsupported", instructions: unsupported };
  const geometry = new Map(nodes.map((node, index) => [node.id, { x: 80, y: 40 + index * 160, width: 200, height: 100 }]));
  const point = (end: NetworkEndpoint, output: boolean): [number, number] => {
    const node = byId.get(end.node)!;
    const box = geometry.get(end.node)!;
    const ports = output ? node.outputs : node.inputs;
    return [box.x + (output ? box.width : 0), box.y + box.height * (ports.indexOf(end.port) + 1) / (ports.length + 1)];
  };
  const wires = [...network.wires].sort((a, b) => compare(a.from.node, b.from.node) || compare(a.from.port, b.from.port)
    || compare(a.to.node, b.to.node) || compare(a.to.port, b.to.port));
  const paths = wires.map((wire) => {
    const [x1, y1] = point(wire.from, true);
    const [x2, y2] = point(wire.to, false);
    return `<path d="M ${x1} ${y1} H 320 V ${y2} H ${x2}" fill="none" stroke="currentColor"/>`;
  }).join("");
  const shapes = nodes.map((node) => renderers.get(node.instruction)!(node, geometry.get(node.id)!)).join("");
  return { status: "rendered", svg: `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(network.language)} network" viewBox="0 0 360 ${Math.max(160, nodes.length * 160)}">${paths}${shapes}</svg>\n` };
}
