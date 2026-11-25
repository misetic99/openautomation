import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadProject, parseAlarms, toStableJson } from "./index.js";

const fixture = fileURLToPath(new URL("../../../corpus/synthetic/v18/basic", import.meta.url));
const alarm = { id: "1", name: "Example", texts: { "en-US": "Example" }, source: "HMI" };
const json = (alarms: unknown[], format = 1) => JSON.stringify({ format, alarms });

describe("alarms", () => {
  it("normalizes field, alarm and translation order without mutating input", () => {
    const a = { ...alarm, id: "2", texts: { "en-US": "Two", "de-DE": "Zwei" }, triggerTag: "Start", triggerBit: 0 };
    const b = { ...a, texts: { "de-DE": "Zwei", "en-US": "Two" } };
    expect(JSON.stringify(parseAlarms(json([a, alarm]), "Panel")))
      .toBe(JSON.stringify(parseAlarms(json([alarm, b]), "Panel")));
    expect(parseAlarms(json([a]), "Panel")[0]!.triggerBit).toBe(0);
  });

  it.each([
    [json([], 2)], [json([alarm, alarm])], [json([{ ...alarm, source: "Other" }])],
    [json([{ ...alarm, texts: { en: 1 } }])], [json([{ ...alarm, id: 1 }])],
    [json([{ ...alarm, triggerBit: -1 }])], [json([{ ...alarm, triggerBit: 1.5 }])],
    [json([{ ...alarm, triggerBit: 0 }])], [json([{ ...alarm, plc: null }])],
  ])("rejects malformed interchange data: %s", (input) => {
    expect(() => parseAlarms(input, "Panel")).toThrow();
  });

  it("loads optional data, excludes hmi from PLC discovery and reports bad files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oa-alarms-"));
    try {
      await cp(fixture, dir, { recursive: true });
      const first = await loadProject(dir);
      expect(first.alarms).toHaveLength(2);
      expect(toStableJson(first)).toBe(toStableJson(await loadProject(fixture)));
      await rm(join(dir, "project.json"));
      expect((await loadProject(dir)).plcs.map((p) => p.name)).toEqual(["PLC_1"]);
      await writeFile(join(dir, "hmi/Panel_1/alarms.json"), "{}");
      expect((await loadProject(dir)).warnings.some((w) => w.startsWith("hmi/Panel_1/alarms.json:"))).toBe(true);
      await rm(join(dir, "hmi"), { recursive: true });
      expect(await loadProject(dir)).not.toHaveProperty("alarms");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
