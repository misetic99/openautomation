import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import type { ProjectModel } from "@openautomation/core";
import { buildCrossReferences, type CrossReferenceRow } from "./cross-references.js";
import { toCsv, type Column } from "./csv.js";
import { buildIoList, type IoRow } from "./io-list.js";

export { buildCrossReferences, type CrossReferenceRow } from "./cross-references.js";
export { toCsv, type Column } from "./csv.js";
export { buildIoList, parseIoAddress, type IoRow } from "./io-list.js";

export const ioColumns: Column<IoRow>[] = [
  { header: "Address", value: (r) => r.address },
  { header: "Area", value: (r) => r.area },
  { header: "Name", value: (r) => r.name },
  { header: "Data type", value: (r) => r.dataType },
  { header: "Comment", value: (r) => r.comment },
  { header: "Tag table", value: (r) => r.table },
  { header: "Used in", value: (r) => r.usedIn.join("; ") },
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

  return Buffer.from(await book.xlsx.writeBuffer());
}

/**
 * Writes the generated documentation for every PLC of a project and returns the paths
 * it wrote, relative to `outDir`.
 *
 *   <outDir>/<plc>/io-list.csv
 *   <outDir>/<plc>/io-list.xlsx          (also holds the cross references)
 *   <outDir>/<plc>/cross-references.csv
 */
export async function generateDocs(project: ProjectModel, outDir: string): Promise<string[]> {
  const written: string[] = [];

  for (const plc of project.plcs) {
    const ioList = buildIoList(plc);
    const crossReferences = buildCrossReferences(plc);

    const files: [string, string | Buffer][] = [
      ["io-list.csv", toCsv(ioList, ioColumns)],
      ["cross-references.csv", toCsv(crossReferences, crossReferenceColumns)],
      [
        "io-list.xlsx",
        await workbook([
          { name: "IO list", rows: ioList, columns: ioColumns as Column<never>[] },
          {
            name: "Cross references",
            rows: crossReferences,
            columns: crossReferenceColumns as Column<never>[],
          },
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
