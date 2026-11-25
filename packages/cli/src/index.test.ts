import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { run, type Io } from "./index.js";

const fixture = fileURLToPath(new URL("../../../corpus/synthetic/v18/basic", import.meta.url));

function capture(): { io: Io; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (t) => out.push(t), err: (t) => err.push(t) }, out, err };
}

describe("cli", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  it("prints help with no arguments", async () => {
    const c = capture();
    expect(await run([], c.io)).toBe(0);
    expect(c.out.join("\n")).toContain("openautomation <command>");
  });

  it("rejects unknown commands", async () => {
    const c = capture();
    expect(await run(["nope"], c.io)).toBe(2);
  });

  it("says planned commands are not implemented", async () => {
    const c = capture();
    expect(await run(["lint"], c.io)).toBe(1);
    expect(c.err.join("\n")).toContain("not implemented yet");
  });

  it("prints the model as JSON", async () => {
    const c = capture();
    expect(await run(["model", fixture], c.io)).toBe(0);
    const model = JSON.parse(c.out.join("\n"));
    expect(model.plcs[0].name).toBe("PLC_1");
  });

  it("writes the docs for an export", async () => {
    const out = await mkdtemp(join(tmpdir(), "oa-cli-"));
    dirs.push(out);
    const c = capture();

    expect(await run(["docs", fixture, "--out", out], c.io)).toBe(0);
    expect(await readFile(join(out, "PLC_1", "io-list.csv"), "utf8")).toContain("%I0.0,Input,Start");
  });

  it("fails clearly on a folder that does not exist", async () => {
    const c = capture();
    expect(await run(["docs", join(tmpdir(), "oa-does-not-exist")], c.io)).toBe(1);
    expect(c.err.join("\n")).toContain("Not a folder");
  });

  it("needs a value for an option", async () => {
    const c = capture();
    expect(await run(["docs", fixture, "--out"], c.io)).toBe(1);
    expect(c.err.join("\n")).toContain("needs a value");
  });
});
