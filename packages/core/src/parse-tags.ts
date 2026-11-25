import type { Tag, TagTable } from "./model.js";
import { child, children, listAttr, multilingualComment, parseXml } from "./xml.js";

/**
 * Parses an exported PLC tag table (`SW.Tags.PlcTagTable`).
 * `group` and `source` come from where the file lives, not from the XML.
 */
export function parseTagTable(xml: string, group: string[], source: string): TagTable {
  const table = child(child(parseXml(xml), "Document"), "SW.Tags.PlcTagTable");
  if (!table) throw new Error("not a tag table: no SW.Tags.PlcTagTable element");

  const tags: Tag[] = [];
  for (const node of children(child(table, "ObjectList"), "SW.Tags.PlcTag")) {
    const name = listAttr(node, "Name");
    if (name === undefined) continue;

    const tag: Tag = { name, dataType: listAttr(node, "DataTypeName") ?? "" };
    const address = listAttr(node, "LogicalAddress");
    if (address) tag.address = address;
    const comment = multilingualComment(node);
    if (comment) tag.comment = comment;
    tags.push(tag);
  }

  return {
    name: listAttr(table, "Name") ?? "",
    group,
    source,
    tags,
  };
}
