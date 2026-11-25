import { compare, type ProjectModel } from "@openautomation/core";
import { blockLabel } from "./io-list.js";

export interface AlarmRow {
  device: string;
  source: string;
  id: string;
  name: string;
  language: string;
  text: string;
  class: string;
  plc: string;
  triggerTag: string;
  triggerBit: number | "";
  address: string;
  usedIn: string[];
  writtenBy: string[];
  resolution: string;
}

/** One row per translation. References with unknown direction are never called writes. */
export function buildAlarmList(project: ProjectModel): AlarmRow[] {
  return [...(project.alarms ?? [])]
    .sort((a, b) => compare(a.device, b.device) || compare(a.id, b.id) || compare(a.name, b.name))
    .flatMap((alarm) => {
      const plc = project.plcs.find((p) => p.name === alarm.plc);
      const tags = plc?.tagTables.flatMap((t) => t.tags).filter((t) => t.name === alarm.triggerTag) ?? [];
      const uses = tags.length === 1 ? (plc?.blocks ?? []).flatMap((block) =>
        block.references.filter((r) => r.name === alarm.triggerTag).map((ref) => ({ block, ref })),
      ) : [];
      const resolution = !alarm.triggerTag ? "No trigger tag"
        : !alarm.plc ? "PLC not specified" : !plc ? "PLC not found"
        : tags.length === 0 ? "Tag not found" : tags.length > 1 ? "Ambiguous tag"
        : uses.some((u) => !u.ref.access) ? "Write direction unknown" : "Resolved";
      const languages = Object.keys(alarm.texts).sort(compare);
      return (languages.length ? languages : [""]).map((language) => ({
        device: alarm.device, source: alarm.source, id: alarm.id, name: alarm.name,
        language, text: alarm.texts[language] ?? "", class: alarm.class ?? "",
        plc: alarm.plc ?? "", triggerTag: alarm.triggerTag ?? "", triggerBit: alarm.triggerBit ?? "",
        address: tags.length === 1 ? tags[0]!.address ?? "" : "",
        usedIn: [...new Set(uses.map((u) => blockLabel(u.block)))].sort(compare),
        writtenBy: [...new Set(uses.filter((u) => u.ref.access === "write" || u.ref.access === "readwrite")
          .map((u) => blockLabel(u.block)))].sort(compare),
        resolution,
      }));
    });
}
