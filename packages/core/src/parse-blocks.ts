import type { Block, BlockKind, BlockLanguage, Member, PlcType, Reference } from "./model.js";
import {
  asArray,
  attr,
  child,
  children,
  compare,
  descendants,
  listAttr,
  parseXml,
  pickText,
  text,
  type XmlNode,
} from "./xml.js";

const BLOCK_ELEMENTS: Record<string, { kind: BlockKind; instance?: boolean }> = {
  "SW.Blocks.OB": { kind: "OB" },
  "SW.Blocks.FB": { kind: "FB" },
  "SW.Blocks.FC": { kind: "FC" },
  "SW.Blocks.GlobalDB": { kind: "DB" },
  "SW.Blocks.InstanceDB": { kind: "DB", instance: true },
};

const LANGUAGES = new Set<string>(["LAD", "FBD", "SCL", "STL", "GRAPH"]);

/** Extra things the loader knows from the file system rather than from the XML. */
export interface BlockLocation {
  group: string[];
  source: string;
  textSource?: string;
}

/** Parses an exported block (OB, FB, FC, global DB or instance DB). */
export function parseBlock(xml: string, location: BlockLocation): Block {
  const document = child(parseXml(xml), "Document");
  const rootName = Object.keys(document ?? {}).find((key) => key in BLOCK_ELEMENTS);
  if (!document || !rootName) throw new Error("not a block: no known SW.Blocks element");

  const root = child(document, rootName) as XmlNode;
  const { kind, instance } = BLOCK_ELEMENTS[rootName]!;

  const block: Block = {
    name: listAttr(root, "Name") ?? "",
    kind,
    group: location.group,
    source: location.source,
    references: [],
  };

  const number = Number.parseInt(listAttr(root, "Number") ?? "", 10);
  if (Number.isFinite(number)) block.number = number;

  const language = listAttr(root, "ProgrammingLanguage");
  if (language && LANGUAGES.has(language)) block.language = language as BlockLanguage;

  if (instance) block.instance = true;
  if (location.textSource) block.textSource = location.textSource;

  if (kind === "DB") {
    block.members = parseInterface(child(child(root, "AttributeList"), "Interface"));
  }

  block.references = parseReferences(root);
  return block;
}

/** Parses an exported UDT (`SW.Types.PlcStruct`). */
export function parseType(xml: string, group: string[], source: string): PlcType {
  const root = child(child(parseXml(xml), "Document"), "SW.Types.PlcStruct");
  if (!root) throw new Error("not a UDT: no SW.Types.PlcStruct element");

  return {
    name: listAttr(root, "Name") ?? "",
    group,
    source,
    members: parseInterface(child(child(root, "AttributeList"), "Interface")),
  };
}

/**
 * Members of an `<Interface>`. A DB or UDT has one section; a block with several
 * (Input, Output, Static, ...) has them all listed in document order.
 */
function parseInterface(iface: XmlNode | undefined): Member[] {
  const sections = children(child(iface, "Sections"), "Section");
  return sections.flatMap((section) => children(section, "Member").map(parseMember));
}

function parseMember(node: XmlNode): Member {
  const member: Member = {
    name: attr(node, "Name") ?? "",
    dataType: stripQuotes(attr(node, "Datatype") ?? ""),
  };

  const comment = pickText(
    children(node, "Comment").flatMap((c) =>
      asArray(c["MultiLanguageText"]).map((t) => ({
        culture: attr(t, "Lang"),
        text: text(t),
      })),
    ),
  );
  if (comment) member.comment = comment;

  const nested = children(node, "Member").map(parseMember);
  if (nested.length > 0) member.children = nested;
  return member;
}

/** `"UDT_Motor"` is how TIA writes a user type; the quotes are not part of the name. */
function stripQuotes(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

/**
 * Global names a block accesses: tags and DBs. Every language (LAD, FBD, SCL, STL,
 * GRAPH) writes them as `<Access Scope="GlobalVariable">`, so one scan covers all.
 * The first symbol component is the tag or the DB; the rest are members inside it.
 */
function parseReferences(root: XmlNode): Reference[] {
  const counts = new Map<string, number>();
  for (const access of descendants(root, "Access")) {
    if (attr(access, "Scope") !== "GlobalVariable") continue;
    const first = children(child(access, "Symbol"), "Component")[0];
    const name = attr(first, "Name");
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([name, count]) => ({ name, count }));
}
