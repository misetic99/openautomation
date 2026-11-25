import { compare, type AddressRange, type HardwareDevice, type HardwareItem } from "@openautomation/core";

export interface HardwareRow {
  device: string;
  /** Project tree folders of the station. */
  group: string;
  /** Rack, CPU or module, with the items it sits in in front: `PLC_1 / PROFINET interface_1`. */
  module: string;
  typeIdentifier: string;
  slot: number | "";
  networkAddress: string;
  /** Input bytes, for example `0..1 (16 bit)`. Empty when the item has none. */
  inputs: string;
  outputs: string;
}

/** Byte range an address range occupies, both ends included. */
export function byteSpan(range: AddressRange): { first: number; last: number } {
  return { first: range.start, last: range.start + Math.max(1, Math.ceil(range.length / 8)) - 1 };
}

export function describeRange(range: AddressRange): string {
  const { first, last } = byteSpan(range);
  const bytes = first === last ? `${first}` : `${first}..${last}`;
  return `${bytes} (${range.length} bit)`;
}

function isIoType(range: AddressRange, kind: "input" | "output"): boolean {
  return range.ioType.toLowerCase() === kind;
}

/** Every item of a station at any depth, with the path of items above it. */
export function* walkItems(
  items: readonly HardwareItem[],
  path: readonly string[] = [],
): Generator<{ item: HardwareItem; path: string[] }> {
  for (const item of items) {
    const here = [...path, item.name];
    yield { item, path: here };
    yield* walkItems(item.items, here);
  }
}

/**
 * One row per rack, CPU, interface or module, in rack order. Items without an address
 * or a slot still get a row: a bill of materials should not hide parts.
 */
export function buildHardwareList(devices: readonly HardwareDevice[]): HardwareRow[] {
  const rows: HardwareRow[] = [];
  const sorted = [...devices].sort(
    (a, b) => compare(a.group.join("/"), b.group.join("/")) || compare(a.name, b.name),
  );

  for (const device of sorted) {
    for (const { item, path } of walkItems(device.items)) {
      rows.push({
        device: device.name,
        group: device.group.join("/"),
        module: path.join(" / "),
        typeIdentifier: item.typeIdentifier,
        slot: item.position ?? "",
        networkAddress: item.networkAddress ?? "",
        inputs: item.addresses.filter((a) => isIoType(a, "input")).map(describeRange).join("; "),
        outputs: item.addresses.filter((a) => isIoType(a, "output")).map(describeRange).join("; "),
      });
    }
  }
  return rows;
}
