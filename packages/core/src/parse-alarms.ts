import type { Alarm } from "./model.js";
import { compare } from "./xml.js";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reads the normalized alarm interchange format, not native HMI or PLC XML. */
export function parseAlarms(json: string, device: string): Alarm[] {
  const data: unknown = JSON.parse(json);
  if (!object(data) || data.format !== 1 || !Array.isArray(data.alarms)) {
    throw new Error("expected alarm format 1 with an alarms array");
  }
  const ids = new Set<string>();
  return data.alarms.map((value: unknown, index: number): Alarm => {
    const fail = (message: string): never => { throw new Error(`alarm ${index}: ${message}`); };
    if (!object(value)) return fail("expected an object");
    if (typeof value.id !== "string" || !value.id) return fail("id must be a nonempty string");
    if (ids.has(value.id)) return fail(`duplicate id ${value.id}`);
    ids.add(value.id);
    if (typeof value.name !== "string" || !value.name) return fail("name must be a nonempty string");
    if (value.source !== "PLC" && value.source !== "HMI") return fail("source must be PLC or HMI");
    if (!object(value.texts) || Object.values(value.texts).some((v) => typeof v !== "string")) {
      return fail("texts must map languages to strings");
    }
    const alarm: Alarm = {
      id: value.id, name: value.name,
      texts: Object.fromEntries(Object.keys(value.texts).sort(compare).map((lang) => [lang, (value.texts as Record<string, string>)[lang]!])),
      source: value.source, device,
    };
    for (const key of ["plc", "class", "triggerTag"] as const) {
      if (value[key] !== undefined) {
        if (typeof value[key] !== "string" || !value[key]) return fail(`${key} must be a nonempty string`);
        alarm[key] = value[key];
      }
    }
    if (value.triggerBit !== undefined) {
      if (typeof value.triggerBit !== "number" || !Number.isSafeInteger(value.triggerBit) || value.triggerBit < 0) {
        return fail("triggerBit must be a nonnegative safe integer");
      }
      if (!alarm.triggerTag) return fail("triggerBit requires triggerTag");
      alarm.triggerBit = value.triggerBit;
    }
    return alarm;
  }).sort((a, b) => compare(a.id, b.id) || compare(a.name, b.name));
}
