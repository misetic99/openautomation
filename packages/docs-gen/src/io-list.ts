import { compare, type Block, type HardwareDevice, type Plc } from "@openautomation/core";
import { byteSpan, walkItems } from "./hardware-list.js";

export interface IoRow {
  address: string;
  area: "Input" | "Output";
  name: string;
  dataType: string;
  comment: string;
  /** Tag table, with its user group in front when it has one. */
  table: string;
  /** Module that provides the channel, `Station / Module`. Empty when none or several match. */
  module: string;
  /** Blocks that access the tag. Empty means the channel is not used anywhere. */
  usedIn: string[];
}

export interface ParsedAddress {
  area: "Input" | "Output";
  byte: number;
  bit: number;
  /** Bytes the address covers: 1 for a bit or byte, 2 for a word, 4 for a double word. */
  size: number;
}

/** `%I0.0`, `%QW64`, `%ID100`, `%IB3`, also with a `:P` peripheral suffix. */
const IO_ADDRESS = /^%([IQ])([BWD])?(\d+)(?:\.([0-7]))?(?::P)?$/;

export function parseIoAddress(address: string): ParsedAddress | undefined {
  const match = IO_ADDRESS.exec(address.trim());
  if (!match) return undefined;
  return {
    area: match[1] === "I" ? "Input" : "Output",
    byte: Number.parseInt(match[3]!, 10),
    bit: match[4] === undefined ? -1 : Number.parseInt(match[4], 10),
    size: match[2] === "W" ? 2 : match[2] === "D" ? 4 : 1,
  };
}

export function blockLabel(block: Pick<Block, "group" | "name">): string {
  return [...block.group, block.name].join("/");
}

/** Which blocks access which global name, for one PLC. */
export function usageByName(plc: Plc): Map<string, { block: Block; count: number }[]> {
  const usage = new Map<string, { block: Block; count: number }[]>();
  for (const block of plc.blocks) {
    for (const reference of block.references) {
      const list = usage.get(reference.name) ?? [];
      list.push({ block, count: reference.count });
      usage.set(reference.name, list);
    }
  }
  return usage;
}

/**
 * The module whose address range contains the whole address. Modules of the PLC's own
 * station are tried first (central I/O); otherwise a module elsewhere counts only if it
 * is the single match, because distributed I/O of different controllers can overlap.
 */
export function findModule(
  plc: Plc,
  parsed: ParsedAddress,
  hardware: readonly HardwareDevice[],
): string {
  const kind = parsed.area === "Input" ? "input" : "output";
  const last = parsed.byte + parsed.size - 1;

  const matches = (device: HardwareDevice): string[] => {
    const found: string[] = [];
    for (const { item, path } of walkItems(device.items)) {
      const covers = item.addresses.some((range) => {
        if (range.ioType.toLowerCase() !== kind) return false;
        const span = byteSpan(range);
        return span.first <= parsed.byte && last <= span.last;
      });
      if (covers) found.push(`${device.name} / ${path.join(" / ")}`);
    }
    return found;
  };

  const own = hardware.filter((d) => d.plc === plc.name).flatMap(matches);
  if (own.length > 0) return own.length === 1 ? own[0]! : "";

  const others = hardware.filter((d) => d.plc !== plc.name).flatMap(matches);
  return others.length === 1 ? others[0]! : "";
}

/**
 * The I/O list of one PLC: every tag with an input or output address, sorted by
 * area (inputs first), byte and bit. Markers and other memory areas are not part of it.
 */
export function buildIoList(plc: Plc, hardware: readonly HardwareDevice[] = []): IoRow[] {
  const usage = usageByName(plc);
  const rows: { row: IoRow; sort: ParsedAddress }[] = [];

  for (const table of plc.tagTables) {
    for (const tag of table.tags) {
      const parsed = tag.address ? parseIoAddress(tag.address) : undefined;
      if (!tag.address || !parsed) continue;

      rows.push({
        sort: parsed,
        row: {
          address: tag.address,
          area: parsed.area,
          name: tag.name,
          dataType: tag.dataType,
          comment: tag.comment ?? "",
          table: [...table.group, table.name].join("/"),
          module: findModule(plc, parsed, hardware),
          usedIn: [...new Set((usage.get(tag.name) ?? []).map((u) => blockLabel(u.block)))].sort(
            compare,
          ),
        },
      });
    }
  }

  rows.sort(
    (a, b) =>
      (a.sort.area === b.sort.area ? 0 : a.sort.area === "Input" ? -1 : 1) ||
      a.sort.byte - b.sort.byte ||
      a.sort.bit - b.sort.bit ||
      compare(a.row.name, b.row.name),
  );
  return rows.map((r) => r.row);
}
