using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace OpenAutomation.Bridge
{
    /// <summary>An I/O address range of a module, as TIA Portal reports it.</summary>
    public sealed class HwAddress
    {
        /// <summary>Input, Output or whatever TIA Portal names the type.</summary>
        public string IoType = "";
        /// <summary>Start address in bytes.</summary>
        public long Start;
        /// <summary>Length in bits.</summary>
        public long Length;
    }

    public sealed class HwItem
    {
        public string Name = "";
        public string TypeIdentifier = "";
        public int? Position;
        public string? NetworkAddress;
        public List<HwAddress> Addresses = new List<HwAddress>();
        public List<HwItem> Items = new List<HwItem>();
    }

    public sealed class HwDevice
    {
        public string Name = "";
        public string TypeIdentifier = "";
        /// <summary>Project tree folders the station sits in, outermost first.</summary>
        public List<string> Group = new List<string>();
        /// <summary>Software type hosted by the station, for example PlcSoftware or HmiTarget.</summary>
        public string? Software;
        /// <summary>Folder name of the PLC export, when the station hosts a PLC.</summary>
        public string? Plc;
        public List<HwItem> Items = new List<HwItem>();
    }

    /// <summary>
    /// Writes hardware/devices.json. Everything is sorted and nothing depends on time or
    /// machine, so an unchanged project gives a byte-identical file.
    /// </summary>
    public static class HardwareJson
    {
        public static string Write(IEnumerable<HwDevice> devices)
        {
            var sorted = devices
                .OrderBy(d => string.Join("/", d.Group), StringComparer.Ordinal)
                .ThenBy(d => d.Name, StringComparer.Ordinal)
                .ToList();

            var sb = new StringBuilder();
            sb.Append("{\n  \"format\": 1,\n  \"devices\": [");
            for (int i = 0; i < sorted.Count; i++)
            {
                sb.Append(i == 0 ? "\n" : ",\n");
                WriteDevice(sb, sorted[i]);
            }
            sb.Append(sorted.Count == 0 ? "]\n}\n" : "\n  ]\n}\n");
            return sb.ToString();
        }

        private static void WriteDevice(StringBuilder sb, HwDevice d)
        {
            sb.Append("    {\n");
            sb.Append("      \"name\": ").Append(ExportLayout.JsonString(d.Name)).Append(",\n");
            sb.Append("      \"typeIdentifier\": ").Append(ExportLayout.JsonString(d.TypeIdentifier)).Append(",\n");
            sb.Append("      \"group\": [").Append(string.Join(", ", d.Group.Select(ExportLayout.JsonString))).Append("],\n");
            if (d.Software != null)
                sb.Append("      \"software\": ").Append(ExportLayout.JsonString(d.Software)).Append(",\n");
            if (d.Plc != null)
                sb.Append("      \"plc\": ").Append(ExportLayout.JsonString(d.Plc)).Append(",\n");
            sb.Append("      \"items\": ");
            WriteItems(sb, d.Items, "      ");
            sb.Append("\n    }");
        }

        private static void WriteItems(StringBuilder sb, List<HwItem> items, string indent)
        {
            // Position first, so the order follows the rack; the name settles ties.
            var sorted = items
                .OrderBy(i => i.Position ?? int.MaxValue)
                .ThenBy(i => i.Name, StringComparer.Ordinal)
                .ToList();

            if (sorted.Count == 0) { sb.Append("[]"); return; }

            sb.Append("[\n");
            for (int i = 0; i < sorted.Count; i++)
            {
                HwItem item = sorted[i];
                string inner = indent + "    ";
                sb.Append(indent).Append("  {\n");
                sb.Append(inner).Append("\"name\": ").Append(ExportLayout.JsonString(item.Name)).Append(",\n");
                sb.Append(inner).Append("\"typeIdentifier\": ").Append(ExportLayout.JsonString(item.TypeIdentifier));
                if (item.Position.HasValue)
                    sb.Append(",\n").Append(inner).Append("\"position\": ").Append(item.Position.Value);
                if (item.NetworkAddress != null)
                    sb.Append(",\n").Append(inner).Append("\"networkAddress\": ").Append(ExportLayout.JsonString(item.NetworkAddress));

                sb.Append(",\n").Append(inner).Append("\"addresses\": ");
                var addresses = item.Addresses
                    .OrderBy(a => a.IoType, StringComparer.Ordinal)
                    .ThenBy(a => a.Start)
                    .ToList();
                if (addresses.Count == 0)
                {
                    sb.Append("[]");
                }
                else
                {
                    sb.Append("[\n");
                    sb.Append(string.Join(",\n", addresses.Select(a =>
                        inner + "  { \"ioType\": " + ExportLayout.JsonString(a.IoType) +
                        ", \"start\": " + a.Start + ", \"length\": " + a.Length + " }")));
                    sb.Append("\n").Append(inner).Append("]");
                }

                sb.Append(",\n").Append(inner).Append("\"items\": ");
                WriteItems(sb, item.Items, inner);
                sb.Append("\n").Append(indent).Append("  }").Append(i < sorted.Count - 1 ? ",\n" : "");
            }
            sb.Append("\n").Append(indent).Append("]");
        }
    }
}
