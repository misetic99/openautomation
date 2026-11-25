import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import { emptyProject, loadProject } from "@openautomation/core";
import { buildAlarmList, generateDocs } from "./index.js";

const fixture = fileURLToPath(new URL("../../../corpus/synthetic/v18/basic", import.meta.url));

describe("alarm list", () => {
  it("links translations to tags and references without inventing write directions", async () => {
    const project = await loadProject(fixture);
    const rows = buildAlarmList(project);
    expect(rows.map((r) => [r.id, r.language])).toEqual([["100", "de-DE"], ["100", "en-US"], ["200", "en-US"]]);
    expect(rows[0]).toMatchObject({ triggerBit: 0, address: "%I0.2", usedIn: ["Main"], writtenBy: [], resolution: "Write direction unknown" });
    const plc = project.plcs[0]!;
    plc.blocks.find((b) => b.name === "Main")!.references.find((r) => r.name === "Overload")!.access = "write";
    expect(buildAlarmList(project)[0]).toMatchObject({ writtenBy: ["Main"], resolution: "Resolved" });
    project.alarms![0]!.plc = "Missing";
    expect(buildAlarmList(project)[0]).toMatchObject({ usedIn: [], writtenBy: [], resolution: "PLC not found" });
    project.alarms![0]!.plc = "PLC_1";
    plc.tagTables[0]!.tags.push({ name: "Overload", dataType: "Bool" });
    expect(buildAlarmList(project)[0]).toMatchObject({ usedIn: [], resolution: "Ambiguous tag" });
  });

  it("keeps unbound alarms and empty translations visible on HMI-only projects", async () => {
    const project = emptyProject();
    project.alarms = [{ id: "1", name: "Internal", source: "HMI", device: "Panel", texts: {} }];
    expect(buildAlarmList(project)[0]).toMatchObject({ language: "", text: "", resolution: "No trigger tag" });
    const dir = await mkdtemp(join(tmpdir(), "oa-hmi-"));
    try {
      expect(await generateDocs(project, dir)).toEqual(["alarm-list.csv", "alarm-list.xlsx"]);
      const book = new ExcelJS.Workbook();
      await book.xlsx.readFile(join(dir, "alarm-list.xlsx"));
      expect(book.getWorksheet("Alarms")!.rowCount).toBe(2);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("leaves alarm reports absent for exports without alarm files", async () => {
    const project = await loadProject(fixture);
    delete project.alarms;
    expect(buildAlarmList(project)).toEqual([]);
    const dir = await mkdtemp(join(tmpdir(), "oa-old-export-"));
    try {
      expect((await generateDocs(project, dir)).some((file) => file.startsWith("alarm-list"))).toBe(false);
      const book = new ExcelJS.Workbook();
      await book.xlsx.readFile(join(dir, "PLC_1/io-list.xlsx"));
      expect(book.getWorksheet("Alarms")).toBeUndefined();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("produces byte-identical files across clocks, locations and alarm ordering", async () => {
    const a = await mkdtemp(join(tmpdir(), "oa-doc-a-"));
    const b = await mkdtemp(join(tmpdir(), "oa-doc-b-"));
    try {
      const project = await loadProject(fixture);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2001-01-01T00:00:00Z"));
      const files = await generateDocs(project, a);
      vi.setSystemTime(new Date("2030-05-01T12:34:56Z"));
      project.alarms!.reverse();
      expect(await generateDocs(project, b)).toEqual(files);
      for (const file of files) expect(await readFile(join(a, file))).toEqual(await readFile(join(b, file)));
    } finally {
      vi.useRealTimers();
      await Promise.all([a, b].map((dir) => rm(dir, { recursive: true, force: true })));
    }
  });
});
