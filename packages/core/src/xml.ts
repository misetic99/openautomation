import { XMLParser } from "fast-xml-parser";

/** Parsed XML node as produced by fast-xml-parser. Attributes are prefixed with `@_`. */
export type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

export function parseXml(xml: string): XmlNode {
  return parser.parse(xml) as XmlNode;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Direct child elements with this name. */
export function children(node: unknown, name: string): XmlNode[] {
  if (!isNode(node)) return [];
  return asArray(node[name]).filter(isNode);
}

export function child(node: unknown, name: string): XmlNode | undefined {
  return children(node, name)[0];
}

/** Every descendant element with this name, in document order. */
export function descendants(node: unknown, name: string): XmlNode[] {
  const found: XmlNode[] = [];
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!isNode(current)) return;
    for (const [key, value] of Object.entries(current)) {
      if (key.startsWith("@_") || key === "#text") continue;
      if (key === name) found.push(...asArray(value).filter(isNode));
      visit(value);
    }
  };
  visit(node);
  return found;
}

/** Text of a leaf element such as `<Name>x</Name>`, or the `#text` of one with attributes. */
export function text(node: unknown): string | undefined {
  if (typeof node === "string") return node;
  if (isNode(node) && typeof node["#text"] === "string") return node["#text"];
  return undefined;
}

export function attr(node: unknown, name: string): string | undefined {
  if (!isNode(node)) return undefined;
  const value = node[`@_${name}`];
  return typeof value === "string" ? value : undefined;
}

/** Text of `<AttributeList><Name>…</Name></AttributeList>` style attributes. */
export function listAttr(node: unknown, name: string): string | undefined {
  const list = child(node, "AttributeList");
  return list ? text(asArray(list[name])[0]) : undefined;
}

/** Code-point comparison, independent of locale, so sorting is the same everywhere. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Picks one translation. TIA exports every language of a text; prefer `en-US`, then the
 * first one that has any text.
 */
export function pickText(items: { culture?: string; text?: string }[]): string | undefined {
  const withText = items.filter((i) => i.text !== undefined && i.text !== "");
  const preferred = withText.find((i) => i.culture === "en-US") ?? withText[0];
  return preferred?.text;
}

/** Comment of a tag, from the MultilingualText items of an exported object. */
export function multilingualComment(node: unknown): string | undefined {
  return pickText(
    descendants(node, "MultilingualTextItem").map((item) => ({
      culture: listAttr(item, "Culture"),
      text: listAttr(item, "Text"),
    })),
  );
}
