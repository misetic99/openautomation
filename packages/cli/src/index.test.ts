import { describe, expect, it } from "vitest";
import { run } from "./index.js";

describe("cli", () => {
  it("prints help with no arguments", () => {
    expect(run([])).toBe(0);
  });
  it("rejects unknown commands", () => {
    expect(run(["nope"])).toBe(2);
  });
});
