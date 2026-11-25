import type { AddressRange, HardwareDevice, HardwareItem } from "./model.js";
import { compare } from "./xml.js";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value: unknown, what: string): string {
  if (typeof value !== "string") throw new Error(`${what} must be a string`);
  return value;
}

function optionalString(value: unknown, what: string): string | undefined {
  return value === undefined || value === null ? undefined : string(value, what);
}

function integer(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${what} must be a number`);
  return value;
}

function array(value: unknown, what: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${what} must be a list`);
  return value;
}

function object(value: unknown, what: string): Json {
  if (!isObject(value)) throw new Error(`${what} must be an object`);
  return value;
}

function parseAddress(value: unknown, where: string): AddressRange {
  const a = object(value, `${where}.addresses[]`);
  return {
    ioType: string(a["ioType"], `${where}.ioType`),
    start: integer(a["start"], `${where}.start`),
    length: integer(a["length"], `${where}.length`),
  };
}

function parseItem(value: unknown, where: string): HardwareItem {
  const i = object(value, where);
  const name = string(i["name"], `${where}.name`);
  const here = `${where}(${name})`;

  const item: HardwareItem = {
    name,
    typeIdentifier: string(i["typeIdentifier"], `${here}.typeIdentifier`),
    addresses: array(i["addresses"], `${here}.addresses`).map((a) => parseAddress(a, here)),
    items: array(i["items"], `${here}.items`).map((c) => parseItem(c, `${here}.items`)),
  };
  if (i["position"] !== undefined) item.position = integer(i["position"], `${here}.position`);
  const networkAddress = optionalString(i["networkAddress"], `${here}.networkAddress`);
  if (networkAddress !== undefined) item.networkAddress = networkAddress;
  return item;
}

/**
 * Parses `hardware/devices.json` as the bridge writes it. Devices come back sorted by
 * folder and name; items keep the order of the file (rack order).
 */
export function parseHardware(json: string): HardwareDevice[] {
  const root = object(JSON.parse(json), "devices.json");
  if (root["format"] !== 1) throw new Error(`unsupported format ${String(root["format"])}`);

  const devices = array(root["devices"], "devices").map((value): HardwareDevice => {
    const d = object(value, "device");
    const name = string(d["name"], "device.name");
    const device: HardwareDevice = {
      name,
      typeIdentifier: string(d["typeIdentifier"], `device(${name}).typeIdentifier`),
      group: array(d["group"], `device(${name}).group`).map((g) => string(g, "group")),
      items: array(d["items"], `device(${name}).items`).map((i) => parseItem(i, `device(${name})`)),
    };
    const software = optionalString(d["software"], `device(${name}).software`);
    if (software !== undefined) device.software = software;
    const plc = optionalString(d["plc"], `device(${name}).plc`);
    if (plc !== undefined) device.plc = plc;
    return device;
  });

  return devices.sort(
    (a, b) => compare(a.group.join("/"), b.group.join("/")) || compare(a.name, b.name),
  );
}
