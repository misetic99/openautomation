import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { ProjectModel } from "@openautomation/core";
import { buildAlarmList, type AlarmRow } from "./alarm-list.js";
import { buildCrossReferences, type CrossReferenceRow } from "./cross-references.js";
import { toCsv, type Column } from "./csv.js";
import { buildHardwareList, type HardwareRow } from "./hardware-list.js";
import { buildIoList, type IoRow } from "./io-list.js";

export { buildCrossReferences, type CrossReferenceRow } from "./cross-references.js";
export { buildAlarmList, type AlarmRow } from "./alarm-list.js";
export { toCsv, type Column } from "./csv.js";
export {
  buildIoList,
  findModule,
  parseIoAddress,
  type IoRow,
  type ParsedAddress,
} from "./io-list.js";
export { buildHardwareList, describeRange, type HardwareRow } from "./hardware-list.js";

export const ioColumns: Column<IoRow>[] = [
  { header: "Address", value: (r) => r.address },
  { header: "Area", value: (r) => r.area },
  { header: "Name", value: (r) => r.name },
  { header: "Data type", value: (r) => r.dataType },
  { header: "Comment", value: (r) => r.comment },
  { header: "Tag table", value: (r) => r.table },
  { header: "Module", value: (r) => r.module },
  { header: "Used in", value: (r) => r.usedIn.join("; ") },
];

export const alarmColumns: Column<AlarmRow>[] = [
  { header: "Device", value: (r) => r.device },
  { header: "Source", value: (r) => r.source },
  { header: "ID", value: (r) => r.id },
  { header: "Name", value: (r) => r.name },
  { header: "Language", value: (r) => r.language },
  { header: "Text", value: (r) => r.text },
  { header: "Class", value: (r) => r.class },
  { header: "PLC", value: (r) => r.plc },
  { header: "Trigger tag", value: (r) => r.triggerTag },
  { header: "Trigger bit", value: (r) => r.triggerBit },
  { header: "Address", value: (r) => r.address },
  { header: "Used in", value: (r) => r.usedIn.join("; ") },
  { header: "Written by", value: (r) => r.writtenBy.join("; ") },
  { header: "Resolution", value: (r) => r.resolution },
];

export const hardwareColumns: Column<HardwareRow>[] = [
  { header: "Station", value: (r) => r.device },
  { header: "Folder", value: (r) => r.group },
  { header: "Module", value: (r) => r.module },
  { header: "Type identifier", value: (r) => r.typeIdentifier },
  { header: "Slot", value: (r) => r.slot },
  { header: "Network address", value: (r) => r.networkAddress },
  { header: "Inputs (bytes)", value: (r) => r.inputs },
  { header: "Outputs (bytes)", value: (r) => r.outputs },
];

export const crossReferenceColumns: Column<CrossReferenceRow>[] = [
  { header: "Tag", value: (r) => r.tag },
  { header: "Address", value: (r) => r.address },
  { header: "Data type", value: (r) => r.dataType },
  { header: "Tag table", value: (r) => r.table },
  { header: "Block", value: (r) => r.block },
  { header: "Block type", value: (r) => r.blockKind },
  { header: "Language", value: (r) => r.language },
  { header: "Accesses", value: (r) => r.count },
];

async function workbook(
  sheets: { name: string; rows: readonly unknown[]; columns: readonly Column<never>[] }[],
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "OpenAutomation";
  // Fixed dates: the workbook must not change just because it was written again.
  book.created = new Date(0);
  book.modified = new Date(0);

  for (const sheet of sheets) {
    const worksheet = book.addWorksheet(sheet.name, { views: [{ state: "frozen", ySplit: 1 }] });
    worksheet.columns = sheet.columns.map((c) => ({ header: c.header, width: 22 }));
    for (const row of sheet.rows) {
      worksheet.addRow(sheet.columns.map((c) => c.value(row as never)));
    }
    worksheet.getRow(1).font = { bold: true };
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  // XLSX is a ZIP: fixed document dates alone do not fix archive entry dates.
  const archive = await JSZip.loadAsync(await book.xlsx.writeBuffer());
  for (const entry of Object.values(archive.files)) entry.date = new Date("1980-01-01T00:00:00Z");
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "DOS" });
}

/**
 * Writes the generated documentation for a project and returns the paths it wrote,
 * relative to `outDir`.
 *
 *   <outDir>/hardware-list.csv           (when the export has hardware)
 *   <outDir>/alarm-list.csv              (when normalized alarm files exist)
 *   <outDir>/alarm-list.xlsx             (project-wide Alarms sheet)
 *   <outDir>/<plc>/io-list.csv
 *   <outDir>/<plc>/io-list.xlsx          (also cross references, hardware and PLC alarms)
 *   <outDir>/<plc>/cross-references.csv
 */
export async function generateDocs(project: ProjectModel, outDir: string): Promise<string[]> {
  const written: string[] = [];
  const hardware = buildHardwareList(project.hardware);
  const alarms = buildAlarmList(project);

  if (project.alarms !== undefined) {
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "alarm-list.csv"), toCsv(alarms, alarmColumns));
    // A project workbook also covers HMI-only projects and unbound alarms.
    await writeFile(join(outDir, "alarm-list.xlsx"), await workbook([
      { name: "Alarms", rows: alarms, columns: alarmColumns as Column<never>[] },
    ]));
    written.push("alarm-list.csv", "alarm-list.xlsx");
  }

  if (hardware.length > 0) {
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "hardware-list.csv"), toCsv(hardware, hardwareColumns));
    written.push("hardware-list.csv");
  }

  for (const plc of project.plcs) {
    const ioList = buildIoList(plc, project.hardware);
    const crossReferences = buildCrossReferences(plc);

    const files: [string, string | Buffer][] = [
      ["io-list.csv", toCsv(ioList, ioColumns)],
      ["cross-references.csv", toCsv(crossReferences, crossReferenceColumns)],
      [
        "io-list.xlsx",
        await workbook([
          { name: "IO list", rows: ioList, columns: ioColumns as Column<never>[] },
          ...(project.alarms !== undefined ? [{ name: "Alarms", rows: alarms.filter((r) => r.plc === plc.name), columns: alarmColumns as Column<never>[] }] : []),
          {
            name: "Cross references",
            rows: crossReferences,
            columns: crossReferenceColumns as Column<never>[],
          },
          ...(hardware.length > 0
            ? [{ name: "Hardware", rows: hardware, columns: hardwareColumns as Column<never>[] }]
            : []),
        ]),
      ],
    ];

    await mkdir(join(outDir, plc.name), { recursive: true });
    for (const [name, content] of files) {
      await writeFile(join(outDir, plc.name, name), content);
      written.push(`${plc.name}/${name}`);
    }
  }

  return written;
}
