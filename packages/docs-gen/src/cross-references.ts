import { compare, type Plc } from "@openautomation/core";
import { blockLabel, usageByName } from "./io-list.js";

export interface CrossReferenceRow {
  tag: string;
  address: string;
  dataType: string;
  table: string;
  /** Empty when nothing accesses the tag. */
  block: string;
  blockKind: string;
  language: string;
  /** How many times the block accesses the tag. */
  count: number | "";
}

/**
 * Where each tag of a PLC is used. A tag that nothing accesses still gets one row with
 * an empty block, so unused tags are visible instead of missing.
 *
 * Only global tags are listed. Access type (read or write) is not part of this
 * list yet, because SimaticML does not state it uniformly across languages.
 */
export function buildCrossReferences(plc: Plc): CrossReferenceRow[] {
  const usage = usageByName(plc);
  const rows: CrossReferenceRow[] = [];

  for (const table of plc.tagTables) {
    for (const tag of table.tags) {
      const base = {
        tag: tag.name,
        address: tag.address ?? "",
        dataType: tag.dataType,
        table: [...table.group, table.name].join("/"),
      };

      const uses = usage.get(tag.name) ?? [];
      if (uses.length === 0) {
        rows.push({ ...base, block: "", blockKind: "", language: "", count: "" });
        continue;
      }
      for (const use of uses) {
        rows.push({
          ...base,
          block: blockLabel(use.block),
          blockKind: use.block.kind,
          language: use.block.language ?? "",
          count: use.count,
        });
      }
    }
  }

  return rows.sort(
    (a, b) => compare(a.tag, b.tag) || compare(a.table, b.table) || compare(a.block, b.block),
  );
}
