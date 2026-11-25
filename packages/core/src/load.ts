import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Block, Plc, PlcType, ProjectModel, TagTable } from "./model.js";
import { parseBlock, parseType } from "./parse-blocks.js";
import { parseTagTable } from "./parse-tags.js";
import { compare } from "./xml.js";

/** One file found under a PLC folder. */
interface Found {
  /** Path relative to the export root, with forward slashes. */
  relative: string;
  /** Folders between the kind folder (`blocks`, `types`, `tags`) and the file. */
  group: string[];
  /** File name without extension. */
  stem: string;
  extension: string;
  absolute: string;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string> {
  return (await readFile(path, "utf8")).replace(/^﻿/, "");
}

/** All files below `root/plc/kind`, sorted so that loading is deterministic. */
async function listFiles(root: string, plc: string, kind: string): Promise<Found[]> {
  const base = join(root, plc, kind);
  if (!(await isDirectory(base))) return [];

  const found: Found[] = [];
  const visit = async (dir: string, group: string[]): Promise<void> => {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      compare(a.name, b.name),
    );
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await visit(join(dir, entry.name), [...group, entry.name]);
      } else if (entry.isFile()) {
        const dot = entry.name.lastIndexOf(".");
        found.push({
          relative: [plc, kind, ...group, entry.name].join("/"),
          group,
          stem: dot === -1 ? entry.name : entry.name.slice(0, dot),
          extension: dot === -1 ? "" : entry.name.slice(dot).toLowerCase(),
          absolute: join(dir, entry.name),
        });
      }
    }
  };
  await visit(base, []);
  return found;
}

const byGroupThenName = (
  a: { group: string[]; name: string },
  b: { group: string[]; name: string },
): number => compare(a.group.join("/"), b.group.join("/")) || compare(a.name, b.name);

async function loadPlc(root: string, name: string, warnings: string[]): Promise<Plc> {
  const attempt = async <T>(file: Found, parse: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await parse();
    } catch (error) {
      warnings.push(`${file.relative}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };

  const tagTables: TagTable[] = [];
  for (const file of await listFiles(root, name, "tags")) {
    if (file.extension !== ".xml") continue;
    const table = await attempt(file, async () =>
      parseTagTable(await readText(file.absolute), file.group, file.relative),
    );
    if (table) tagTables.push(table);
  }

  const types: PlcType[] = [];
  for (const file of await listFiles(root, name, "types")) {
    if (file.extension !== ".xml") continue;
    const type = await attempt(file, async () =>
      parseType(await readText(file.absolute), file.group, file.relative),
    );
    if (type) types.push(type);
  }

  const blockFiles = await listFiles(root, name, "blocks");
  const textSources = new Map<string, string>();
  for (const file of blockFiles) {
    if (file.extension === ".scl" || file.extension === ".awl") {
      textSources.set([...file.group, file.stem].join("/"), file.relative);
    }
  }

  const blocks: Block[] = [];
  for (const file of blockFiles) {
    if (file.extension !== ".xml") continue;
    const textSource = textSources.get([...file.group, file.stem].join("/"));
    const block = await attempt(file, async () =>
      parseBlock(await readText(file.absolute), {
        group: file.group,
        source: file.relative,
        ...(textSource ? { textSource } : {}),
      }),
    );
    if (block) blocks.push(block);
  }

  return {
    name,
    blocks: blocks.sort(byGroupThenName),
    types: types.sort(byGroupThenName),
    tagTables: tagTables.sort(byGroupThenName),
  };
}

/**
 * Reads an export folder written by the bridge and builds the project model.
 * Files that cannot be understood become entries in `warnings` instead of being
 * dropped silently.
 */
export async function loadProject(root: string): Promise<ProjectModel> {
  if (!(await isDirectory(root))) throw new Error(`Not a folder: ${root}`);

  const warnings: string[] = [];
  let tiaVersion = "";
  let plcNames: string[] | undefined;

  try {
    const meta = JSON.parse(await readText(join(root, "project.json"))) as {
      tiaVersion?: unknown;
      plcs?: unknown;
    };
    if (typeof meta.tiaVersion === "string") tiaVersion = meta.tiaVersion;
    if (Array.isArray(meta.plcs)) plcNames = meta.plcs.filter((p) => typeof p === "string");
  } catch {
    warnings.push("project.json: missing or unreadable, PLCs taken from the folder names");
  }

  if (!plcNames) {
    const entries = await readdir(root, { withFileTypes: true });
    plcNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  }

  const plcs: Plc[] = [];
  for (const name of [...plcNames].sort(compare)) {
    plcs.push(await loadPlc(root, name, warnings));
  }

  return {
    schemaVersion: 1,
    tiaVersion,
    plcs,
    warnings: warnings.sort(compare),
  };
}

/** Same model, same text: key order is fixed by the model builders and arrays are sorted. */
export function toStableJson(model: ProjectModel): string {
  return JSON.stringify(model, null, 2) + "\n";
}
