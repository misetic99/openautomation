using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace OpenAutomation.Bridge
{
    /// <summary>
    /// Where each exported object lives on disk. This is the contract the TypeScript
    /// loader in @openautomation/core reads, so changes here are breaking changes.
    ///
    ///   &lt;out&gt;/project.json
    ///   &lt;out&gt;/&lt;plc&gt;/blocks/&lt;group...&gt;/&lt;Name&gt;.xml   (+ .scl or .awl for text blocks)
    ///   &lt;out&gt;/&lt;plc&gt;/types/&lt;group...&gt;/&lt;Name&gt;.xml
    ///   &lt;out&gt;/&lt;plc&gt;/tags/&lt;group...&gt;/&lt;Table&gt;.xml
    ///   &lt;out&gt;/hardware/devices.json, &lt;out&gt;/hardware/hardware.aml
    /// </summary>
    internal static class ExportLayout
    {
        public const string ProjectFile = "project.json";
        public const string Blocks = "blocks";
        public const string Types = "types";
        public const string Tags = "tags";
        public const string Hardware = "hardware";
        public const string DevicesFile = "hardware/devices.json";
        public const string AmlFile = "hardware/hardware.aml";

        private static readonly HashSet<string> ReservedNames = new HashSet<string>(
            new[] { "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
                    "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6",
                    "LPT7", "LPT8", "LPT9" },
            StringComparer.OrdinalIgnoreCase);

        /// <summary>Makes a TIA object or group name safe to use as a file or folder name.</summary>
        public static string SafeName(string name)
        {
            if (string.IsNullOrEmpty(name)) return "_";

            var invalid = Path.GetInvalidFileNameChars();
            var sb = new StringBuilder(name.Length);
            foreach (char c in name)
                sb.Append(Array.IndexOf(invalid, c) >= 0 ? '_' : c);

            string result = sb.ToString().TrimEnd('.', ' ');
            if (result.Length == 0) return "_";
            return ReservedNames.Contains(result) ? "_" + result : result;
        }

        /// <summary>
        /// Relative path with forward slashes, for example <c>blocks/Motors/FB_Motor.xml</c>.
        /// Forward slashes keep the layout identical on every platform.
        /// </summary>
        public static string RelativePath(
            string kind, IEnumerable<string> groupPath, string name, string extension)
        {
            var parts = new List<string> { kind };
            parts.AddRange(groupPath.Select(SafeName));
            parts.Add(SafeName(name) + extension);
            return string.Join("/", parts);
        }

        /// <summary>Plain JSON string literal.</summary>
        public static string JsonString(string value)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in value)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        /// <summary>
        /// Contents of project.json. Deliberately has no timestamps, machine names or
        /// user names, so exporting twice gives byte-identical output.
        /// </summary>
        public static string ProjectJson(string tiaVersion, IEnumerable<string> plcNames)
        {
            var plcs = plcNames.OrderBy(n => n, StringComparer.Ordinal)
                               .Select(n => "    " + JsonString(n));
            return "{\n" +
                   "  \"format\": 1,\n" +
                   "  \"tiaVersion\": " + JsonString(tiaVersion) + ",\n" +
                   "  \"plcs\": [\n" + string.Join(",\n", plcs) + "\n  ]\n" +
                   "}\n";
        }
    }
}
