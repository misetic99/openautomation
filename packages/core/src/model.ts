/** Languages a TIA Portal block can be written in. */
export type BlockLanguage = "LAD" | "FBD" | "SCL" | "STL" | "GRAPH";

export type BlockKind = "OB" | "FB" | "FC" | "DB";

/** A variable inside a block interface, DB or UDT. Structs nest through `children`. */
export interface Member {
  name: string;
  /** Data type as written in TIA Portal, without surrounding quotes. */
  dataType: string;
  comment?: string;
  children?: Member[];
}

export interface Tag {
  name: string;
  dataType: string;
  /** Absolute address such as `%I0.0`. */
  address?: string;
  comment?: string;
}

export interface TagTable {
  name: string;
  /** User groups the table sits in, outermost first. */
  group: string[];
  /** Path of the exported file, relative to the export root. */
  source: string;
  tags: Tag[];
}

/** One use of a global name (a tag or a DB) inside a block. */
export interface Reference {
  name: string;
  /** Present only when the producer can establish the access direction. */
  access?: "read" | "write" | "readwrite";
  /** How many times the block accesses it. */
  count: number;
}

export interface Block {
  name: string;
  kind: BlockKind;
  number?: number;
  language?: BlockLanguage;
  /** True for instance DBs. */
  instance?: boolean;
  group: string[];
  /** Path of the exported SimaticML file, relative to the export root. */
  source: string;
  /** Path of the readable SCL or STL source next to it, when the block has one. */
  textSource?: string;
  /** Interface members of a DB. */
  members?: Member[];
  /** Global tags and DBs the block accesses, sorted by name. */
  references: Reference[];
}

/** A PLC data type (UDT). */
export interface PlcType {
  name: string;
  group: string[];
  source: string;
  members: Member[];
}

export interface Plc {
  name: string;
  blocks: Block[];
  types: PlcType[];
  tagTables: TagTable[];
}

/** An I/O address range of a module. */
export interface AddressRange {
  /** `Input` or `Output`, as TIA Portal names them. */
  ioType: string;
  /** Start address in bytes. */
  start: number;
  /** Length in bits. */
  length: number;
}

/** A rack, CPU, interface or module inside a station. Items nest. */
export interface HardwareItem {
  name: string;
  /** For example `OrderNumber:6ES7 521-1BH00-0AB0/V2.1`. */
  typeIdentifier: string;
  /** Slot number. */
  position?: number;
  networkAddress?: string;
  addresses: AddressRange[];
  items: HardwareItem[];
}

/** A station in the project: a PLC, an HMI, an I/O device, a switch. */
export interface HardwareDevice {
  name: string;
  typeIdentifier: string;
  /** Project tree folders the station sits in, outermost first. */
  group: string[];
  /** Kind of software it hosts, for example `PlcSoftware` or `HmiTarget`. */
  software?: string;
  /** Name of the matching entry in `ProjectModel.plcs`, when it hosts a PLC. */
  plc?: string;
  items: HardwareItem[];
}

/**
 * In-memory model of one exported TIA Portal project.
 *
 * Everything is sorted and no field is time dependent, so the same export always
 * serializes to the same JSON.
 */
export interface ProjectModel {
  /** Bumped on any breaking change to this shape. */
  schemaVersion: 1;
  /** TIA Portal version the export came from, for example `V18`. Empty if unknown. */
  tiaVersion: string;
  plcs: Plc[];
  /** Every station, from `hardware/devices.json`. Empty when the export has none. */
  hardware: HardwareDevice[];
  /** Optional normalized alarm data; absent in exports without alarm files. */
  alarms?: Alarm[];
  /** Files that could not be read or understood. Never silently dropped. */
  warnings: string[];
}

/** A normalized alarm, independent of any version-specific engineering API. */
export interface Alarm {
  id: string;
  name: string;
  texts: Record<string, string>;
  source: "PLC" | "HMI";
  /** Name of the device folder that supplied this alarm. */
  device: string;
  plc?: string;
  class?: string;
  /** Global PLC tag name, after resolving any HMI connection mapping. */
  triggerTag?: string;
  triggerBit?: number;
}

export function emptyProject(): ProjectModel {
  return { schemaVersion: 1, tiaVersion: "", plcs: [], hardware: [], warnings: [] };
}
