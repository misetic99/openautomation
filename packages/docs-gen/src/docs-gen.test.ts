import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";
import { loadProject } from "@openautomation/core";
import {
  buildCrossReferences,
  buildIoList,
  generateDocs,
  ioColumns,
  parseIoAddress,
  toCsv,
} from "./index.js";

const fixture = fileURLToPath(new URL("../../../corpus/synthetic/v18/basic", import.meta.url));

describe("parseIoAddress", () => {
  it("reads bit, byte, word and double word addresses", () => {
    expect(parseIoAddress("%I0.3")).toEqual({ area: "Input", byte: 0, bit: 3 });
    expect(parseIoAddress("%QW64")).toEqual({ area: "Output", byte: 64, bit: -1 });
    expect(parseIoAddress("%ID100")).toEqual({ area: "Input", byte: 100, bit: -1 });
    expect(parseIoAddress("%IW64:P")).toEqual({ area: "Input", byte: 64, bit: -1 });
  });

  it("rejects memory addresses and malformed ones", () => {
    expect(parseIoAddress("%M0.0")).toBeUndefined();
    expect(parseIoAddress("%MW10")).toBeUndefined();
    expect(parseIoAddress("%I0.9")).toBeUndefined();
    expect(parseIoAddress("I0.0")).toBeUndefined();
  });
});

describe("IO list", () => {
  it("lists inputs before outputs, ordered by address", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    const rows = buildIoList(plc);

    expect(rows.map((r) => `${r.address} ${r.name}`)).toEqual([
      "%I0.0 Start",
      "%I0.1 Stop",
      "%I0.2 Overload",
      "%I0.7 Unused",
      "%IW64 AnalogIn",
      "%Q0.0 MotorRun",
      "%Q0.1 Lamp",
      "%QW64 AnalogOut",
    ]);
  });

  it("does not include marker tags", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    const names = buildIoList(plc).map((r) => r.name);
    expect(names).not.toContain("Setpoint");
    expect(names).not.toContain("Running");
  });

  it("shows where each channel is used and leaves unused ones empty", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    const rows = new Map(buildIoList(plc).map((r) => [r.name, r]));

    expect(rows.get("Start")!.usedIn).toEqual(["Main", "Motors/FC_MotorControl"]);
    expect(rows.get("Unused")!.usedIn).toEqual([]);
  });
});

describe("cross references", () => {
  it("has one row per tag and block, and one empty row for an unused tag", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    const rows = buildCrossReferences(plc);

    expect(rows.filter((r) => r.tag === "Start").map((r) => [r.block, r.count])).toEqual([
      ["Main", 2],
      ["Motors/FC_MotorControl", 1],
    ]);
    expect(rows.filter((r) => r.tag === "Unused")).toEqual([
      {
        tag: "Unused",
        address: "%I0.7",
        dataType: "Bool",
        table: "Machine/Markers",
        block: "",
        blockKind: "",
        language: "",
        count: "",
      },
    ]);
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and starts with a BOM", () => {
    const csv = toCsv(
      [{ a: 'x,"y"', b: "line\nbreak" }],
      [
        { header: "A", value: (r) => r.a },
        { header: "B", value: (r) => r.b },
      ],
    );
    expect(csv).toBe('﻿A,B\n"x,""y""","line\nbreak"\n');
  });
});

describe("generateDocs", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  it("writes CSV and Excel files that are identical on every run for CSV", async () => {
    const project = await loadProject(fixture);
    const a = await mkdtemp(join(tmpdir(), "oa-docs-"));
    const b = await mkdtemp(join(tmpdir(), "oa-docs-"));
    dirs.push(a, b);

    const written = await generateDocs(project, a);
    await generateDocs(project, b);

    expect(written).toEqual([
      "PLC_1/io-list.csv",
      "PLC_1/cross-references.csv",
      "PLC_1/io-list.xlsx",
    ]);
    for (const name of ["io-list.csv", "cross-references.csv"]) {
      expect(await readFile(join(a, "PLC_1", name), "utf8")).toBe(
        await readFile(join(b, "PLC_1", name), "utf8"),
      );
    }

    const csv = await readFile(join(a, "PLC_1", "io-list.csv"), "utf8");
    expect(csv.split("\n")[0]).toBe("﻿" + ioColumns.map((c) => c.header).join(","));
  });

  it("writes a workbook with both sheets", async () => {
    const out = await mkdtemp(join(tmpdir(), "oa-docs-"));
    dirs.push(out);
    await generateDocs(await loadProject(fixture), out);

    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(join(out, "PLC_1", "io-list.xlsx"));
    expect(book.worksheets.map((s) => s.name)).toEqual(["IO list", "Cross references"]);
    expect(book.getWorksheet("IO list")!.rowCount).toBe(9);
    expect(book.getWorksheet("IO list")!.getRow(2).getCell(3).value).toBe("Start");
  });
});
