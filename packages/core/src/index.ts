/** Languages a TIA Portal block can be written in. */
export type BlockLanguage = "LAD" | "FBD" | "SCL" | "STL" | "GRAPH";

export type BlockKind = "OB" | "FB" | "FC" | "DB" | "UDT";

export interface Tag {
  name: string;
  dataType: string;
  address?: string;
  comment?: string;
}

export interface TagTable {
  name: string;
  tags: Tag[];
}

export interface Block {
  name: string;
  number?: number;
  kind: BlockKind;
  language?: BlockLanguage;
  /** Path of the exported file, relative to the export root. */
  source: string;
}

/** In-memory model of one exported TIA Portal project. */
export interface ProjectModel {
  /** Model schema version, bumped on any breaking change to this shape. */
  schemaVersion: 1;
  blocks: Block[];
  tagTables: TagTable[];
}

export function emptyProject(): ProjectModel {
  return { schemaVersion: 1, blocks: [], tagTables: [] };
}
