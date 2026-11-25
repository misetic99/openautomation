import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { emptyProject, loadProject, parseBlock, parseTagTable, toStableJson } from "./index.js";

const fixture = fileURLToPath(
  new URL("../../../corpus/synthetic/v18/basic", import.meta.url),
);

describe("emptyProject", () => {
  it("creates an empty model", () => {
    expect(emptyProject()).toEqual({ schemaVersion: 1, tiaVersion: "", plcs: [], warnings: [] });
  });
});

describe("parseTagTable", () => {
  const xml = `<Document><SW.Tags.PlcTagTable ID="0"><AttributeList><Name>T</Name></AttributeList>
    <ObjectList><SW.Tags.PlcTag ID="1"><AttributeList>
      <DataTypeName>Bool</DataTypeName><LogicalAddress>%I0.0</LogicalAddress><Name>A</Name>
    </AttributeList></SW.Tags.PlcTag></ObjectList></SW.Tags.PlcTagTable></Document>`;

  it("reads a single tag even though the XML has no array", () => {
    const table = parseTagTable(xml, ["G"], "PLC/tags/G/T.xml");
    expect(table).toEqual({
      name: "T",
      group: ["G"],
      source: "PLC/tags/G/T.xml",
      tags: [{ name: "A", dataType: "Bool", address: "%I0.0" }],
    });
  });

  it("rejects files that are not tag tables", () => {
    expect(() => parseTagTable("<Document/>", [], "x")).toThrow("not a tag table");
  });
});

describe("parseBlock", () => {
  it("rejects files that are not blocks", () => {
    expect(() => parseBlock("<Document/>", { group: [], source: "x" })).toThrow("not a block");
  });
});

describe("loadProject on the synthetic fixture", () => {
  it("loads the PLC with everything in it", async () => {
    const project = await loadProject(fixture);
    expect(project.warnings).toEqual([]);
    expect(project.tiaVersion).toBe("V18");
    expect(project.plcs.map((p) => p.name)).toEqual(["PLC_1"]);

    const plc = project.plcs[0]!;
    expect(plc.tagTables.map((t) => [t.group.join("/"), t.name])).toEqual([
      ["", "Inputs"],
      ["", "Outputs"],
      ["Machine", "Markers"],
    ]);
    expect(plc.blocks.map((b) => `${b.kind}:${b.name}`)).toEqual([
      "DB:DB_Motors",
      "OB:Main",
      "FC:FC_MotorControl",
    ]);
    expect(plc.types.map((t) => t.name)).toEqual(["UDT_Motor"]);
  });

  it("reads tags with address, type and the preferred comment", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    const inputs = plc.tagTables.find((t) => t.name === "Inputs")!;
    expect(inputs.tags[0]).toEqual({
      name: "Start",
      dataType: "Bool",
      address: "%I0.0",
      comment: "Start button",
    });
    // An empty comment is not reported as a comment.
    expect(inputs.tags.find((t) => t.name === "Overload")).not.toHaveProperty("comment");
  });

  it("reads DB members, with user types unquoted and structs nested", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;
    const db = plc.blocks.find((b) => b.name === "DB_Motors")!;
    expect(db.number).toBe(10);
    expect(db.language).toBeUndefined();
    expect(db.members).toEqual([
      { name: "Motor1", dataType: "UDT_Motor" },
      { name: "Motor2", dataType: "UDT_Motor" },
      { name: "Counter", dataType: "DInt", comment: "Start counter" },
    ]);

    const udt = plc.types[0]!;
    expect(udt.members[2]).toEqual({
      name: "Limits",
      dataType: "Struct",
      children: [
        { name: "Min", dataType: "Int" },
        { name: "Max", dataType: "Int" },
      ],
    });
  });

  it("finds global references in SCL and in LAD alike, and ignores local ones", async () => {
    const plc = (await loadProject(fixture)).plcs[0]!;

    const scl = plc.blocks.find((b) => b.name === "FC_MotorControl")!;
    expect(scl.language).toBe("SCL");
    expect(scl.group).toEqual(["Motors"]);
    expect(scl.textSource).toBe("PLC_1/blocks/Motors/FC_MotorControl.scl");
    expect(scl.references).toEqual([
      { name: "DB_Motors", count: 1 },
      { name: "MotorRun", count: 2 },
      { name: "Start", count: 1 },
      { name: "Stop", count: 1 },
    ]);

    const lad = plc.blocks.find((b) => b.name === "Main")!;
    expect(lad.language).toBe("LAD");
    expect(lad.references).toEqual([
      { name: "AnalogIn", count: 1 },
      { name: "AnalogOut", count: 1 },
      { name: "Lamp", count: 1 },
      { name: "Overload", count: 1 },
      { name: "Setpoint", count: 1 },
      { name: "Start", count: 2 },
    ]);
  });
});

describe("determinism", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  it("gives identical JSON for repeated loads and for a copy of the export", async () => {
    const first = toStableJson(await loadProject(fixture));
    const second = toStableJson(await loadProject(fixture));
    expect(second).toBe(first);

    const copy = await mkdtemp(join(tmpdir(), "oa-"));
    dirs.push(copy);
    await cp(fixture, copy, { recursive: true });
    expect(toStableJson(await loadProject(copy))).toBe(first);
  });

  it("reports unreadable files as warnings instead of dropping them", async () => {
    const copy = await mkdtemp(join(tmpdir(), "oa-"));
    dirs.push(copy);
    await cp(fixture, copy, { recursive: true });
    await writeFile(join(copy, "PLC_1", "tags", "Broken.xml"), "<Document/>");

    const project = await loadProject(copy);
    expect(project.warnings).toEqual(["PLC_1/tags/Broken.xml: not a tag table: no SW.Tags.PlcTagTable element"]);
    expect(project.plcs[0]!.tagTables).toHaveLength(3);
  });
});
