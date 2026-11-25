import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";
import { loadProject } from "@openautomation/core";
import {
  buildCrossReferences,
  buildHardwareList,
  buildIoList,
  generateDocs,
  ioColumns,
  parseIoAddress,
  toCsv,
} from "./index.js";

const fixture = fileURLToPath(new URL("../../../corpus/synthetic/v18/basic", import.meta.url));

describe("parseIoAddress", () => {
  it("reads bit, byte, word and double word addresses", () => {
    expect(parseIoAddress("%I0.3")).toEqual({ area: "Input", byte: 0, bit: 3, size: 1 });
    expect(parseIoAddress("%QW64")).toEqual({ area: "Output", byte: 64, bit: -1, size: 2 });
    expect(parseIoAddress("%ID100")).toEqual({ area: "Input", byte: 100, bit: -1, size: 4 });
    expect(parseIoAddress("%IW64:P")).toEqual({ area: "Input", byte: 64, bit: -1, size: 2 });
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

describe("module matching", () => {
  it("names the module that provides each channel", async () => {
    const project = await loadProject(fixture);
    const rows = new Map(buildIoList(project.plcs[0]!, project.hardware).map((r) => [r.name, r]));

    expect(rows.get("Start")!.module).toBe("PLC_1 / DI 16x24VDC_1");
    expect(rows.get("MotorRun")!.module).toBe("PLC_1 / DQ 16x24VDC_1");
    // A word at %IW64 sits inside the analog input module that starts at byte 64.
    expect(rows.get("AnalogIn")!.module).toBe("PLC_1 / AI 4xU/I_1");
    expect(rows.get("AnalogOut")!.module).toBe("PLC_1 / AQ 2xU/I_1");
  });

  it("leaves the module empty without hardware, or when nothing covers the address", async () => {
    const project = await loadProject(fixture);
    expect(buildIoList(project.plcs[0]!).every((r) => r.module === "")).toBe(true);

    const plc = structuredClone(project.plcs[0]!);
    plc.tagTables[0]!.tags[0]!.address = "%I500.0";
    expect(buildIoList(plc, project.hardware).find((r) => r.address === "%I500.0")!.module).toBe("");
  });

  it("does not guess when two modules of the PLC cover the same address", async () => {
    const project = await loadProject(fixture);
    const doubled = structuredClone(project.hardware);
    const plc = doubled.find((d) => d.plc === "PLC_1")!;
    plc.items.push(structuredClone(plc.items[1]!));

    const row = buildIoList(project.plcs[0]!, doubled).find((r) => r.name === "Start")!;
    expect(row.module).toBe("");
  });

  it("only uses a module of another station when it is the single match", async () => {
    const project = await loadProject(fixture);
    const plc = structuredClone(project.plcs[0]!);
    plc.tagTables[0]!.tags[0]!.address = "%I10.3";

    const row = buildIoList(plc, project.hardware).find((r) => r.address === "%I10.3")!;
    expect(row.module).toBe("IO_Device_1 / IO_Device_1 / DI 8x24VDC_1");
  });
});

describe("hardware list", () => {
  it("lists every rack item in rack order, with address ranges", async () => {
    const { hardware } = await loadProject(fixture);
    const rows = buildHardwareList(hardware);

    expect(rows.map((r) => r.module)).toEqual([
      "PLC_1",
      "PLC_1 / PROFINET interface_1",
      "DI 16x24VDC_1",
      "DQ 16x24VDC_1",
      "AI 4xU/I_1",
      "AQ 2xU/I_1",
      "IO_Device_1",
      "IO_Device_1 / PROFINET interface_1",
      "IO_Device_1 / DI 8x24VDC_1",
    ]);

    const di = rows.find((r) => r.module === "DI 16x24VDC_1")!;
    expect(di).toMatchObject({ device: "PLC_1", slot: 2, inputs: "0..1 (16 bit)", outputs: "" });
    expect(rows.find((r) => r.module === "AQ 2xU/I_1")!.outputs).toBe("64..67 (32 bit)");
    expect(rows.find((r) => r.module === "PLC_1 / PROFINET interface_1")!.networkAddress).toBe("192.168.0.1");
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
      "alarm-list.csv",
      "alarm-list.xlsx",
      "hardware-list.csv",
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
    expect(book.worksheets.map((s) => s.name)).toEqual(["IO list", "Alarms", "Cross references", "Hardware"]);
    expect(book.getWorksheet("IO list")!.rowCount).toBe(9);
    expect(book.getWorksheet("IO list")!.getRow(2).getCell(3).value).toBe("Start");
  });
});
