#if TIA_OPENNESS
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.HW.Features;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Blocks;
using Siemens.Engineering.SW.Tags;
using Siemens.Engineering.SW.Types;

namespace OpenAutomation.Bridge
{
    /// <summary>
    /// Exports every PLC of a TIA Portal project to the layout described in
    /// <see cref="ExportLayout"/>. Read-only with respect to the project: nothing is
    /// saved, compiled or downloaded.
    /// </summary>
    internal sealed class Exporter
    {
        private readonly DirectoryInfo _output;
        private readonly string _tiaVersion;
        private readonly bool _upgrade;
        private readonly string _staging;
        private readonly List<string> _skipped = new List<string>();
        private readonly Dictionary<string, int> _counts = new Dictionary<string, int>();

        public Exporter(DirectoryInfo output, string tiaVersion, bool upgrade)
        {
            _output = output;
            _tiaVersion = tiaVersion;
            _upgrade = upgrade;
            _staging = Path.Combine(Path.GetTempPath(), "openautomation-" + Guid.NewGuid().ToString("N"));
        }

        public int Run(FileInfo projectFile)
        {
            if (_output.Exists && _output.EnumerateFileSystemInfos().Any() &&
                !File.Exists(Path.Combine(_output.FullName, ExportLayout.ProjectFile)))
            {
                Console.Error.WriteLine(
                    $"Refusing to export into {_output.FullName}: it is not empty and has no " +
                    $"{ExportLayout.ProjectFile}, so it does not look like an earlier export.");
                return 2;
            }

            Directory.CreateDirectory(_staging);
            try
            {
                var plcNames = new List<string>();

                using (var portal = new TiaPortal(TiaPortalMode.WithUserInterface))
                {
                    portal.Confirmation += OnConfirmation;
                    portal.Notification += (s, e) => Console.WriteLine($"TIA: {e.Text}");

                    Console.WriteLine($"Opening {projectFile.FullName}");
                    // Open fails on a project saved by an older Portal. OpenWithUpgrade
                    // migrates that project in place, so it is opt-in (--upgrade).
                    Project project = _upgrade
                        ? portal.Projects.OpenWithUpgrade(projectFile)
                        : portal.Projects.Open(projectFile);

                    try
                    {
                        using (ExclusiveAccess access = portal.ExclusiveAccess("OpenAutomation export"))
                        {
                            foreach (Device device in AllDevices(project))
                            {
                                if (access.IsCancellationRequested) break;

                                var plc = GetSoftware(device) as PlcSoftware;
                                if (plc == null) continue;

                                access.Text = "Exporting " + device.Name;
                                string plcName = ExportLayout.SafeName(device.Name);
                                if (plcNames.Contains(plcName))
                                    throw new InvalidOperationException(
                                        $"Two PLCs map to the folder name '{plcName}'. Rename one of them.");
                                plcNames.Add(plcName);
                                ExportPlc(plc, Path.Combine(_staging, plcName));
                            }
                        }
                    }
                    finally
                    {
                        project.Close();
                    }
                }

                if (plcNames.Count == 0)
                {
                    Console.Error.WriteLine("No PLC found in the project. Nothing exported.");
                    return 1;
                }

                Commit(plcNames);
                PrintSummary(plcNames);
                return _skipped.Count == 0 ? 0 : 3;
            }
            finally
            {
                try { Directory.Delete(_staging, true); } catch (IOException) { }
            }
        }

        // ---- per PLC -----------------------------------------------------------

        private void ExportPlc(PlcSoftware plc, string plcDir)
        {
            foreach (var item in TypesIn(plc.TypeGroup, new List<string>()))
            {
                PlcType type = item.Item;
                Export(plcDir, item.Path, ExportLayout.Types, type.Name, ".xml",
                       target => type.Export(new FileInfo(target), ExportOptions.None), "type");
            }

            foreach (var item in TablesIn(plc.TagTableGroup, new List<string>()))
            {
                PlcTagTable table = item.Item;
                Export(plcDir, item.Path, ExportLayout.Tags, table.Name, ".xml",
                       target => table.Export(new FileInfo(target), ExportOptions.None), "tag table");
            }

            foreach (var item in BlocksIn(plc.BlockGroup, new List<string>()))
            {
                PlcBlock block = item.Item;
                if (!block.IsConsistent)
                {
                    Skip(block.Name, "block is not consistent; compile the project in TIA Portal first");
                    continue;
                }

                // ExportOptions.None: leaner XML, better suited to version control.
                Export(plcDir, item.Path, ExportLayout.Blocks, block.Name, ".xml",
                       target => block.Export(new FileInfo(target), ExportOptions.None), "block");

                // Text languages also get a readable source file next to the XML.
                string sourceExtension = SourceExtension(block.ProgrammingLanguage);
                if (sourceExtension != null)
                {
                    Export(plcDir, item.Path, ExportLayout.Blocks, block.Name, sourceExtension,
                           target => plc.ExternalSourceGroup.GenerateSource(
                               new[] { block }, new FileInfo(target)),
                           "block source");
                }
            }
        }

        private static string SourceExtension(ProgrammingLanguage language)
        {
            switch (language)
            {
                case ProgrammingLanguage.SCL: return ".scl";
                case ProgrammingLanguage.STL: return ".awl";
                default: return null;
            }
        }

        private void Export(string plcDir, IList<string> groupPath, string kind, string name,
                            string extension, Action<string> write, string what)
        {
            string relative = ExportLayout.RelativePath(kind, groupPath, name, extension);
            string target = Path.Combine(plcDir, relative.Replace('/', Path.DirectorySeparatorChar));

            if (File.Exists(target))
                throw new InvalidOperationException(
                    $"Two objects map to the same file '{relative}'. Rename one of them.");

            Directory.CreateDirectory(Path.GetDirectoryName(target));
            try
            {
                write(target);   // TIA refuses to overwrite, which the check above guarantees
                Count(what);
            }
            catch (EngineeringException ex)
            {
                // Know-how protected, inconsistent or otherwise not exportable.
                Skip(string.Join("/", groupPath.Concat(new[] { name })), $"{what}: {ex.Message}");
            }
        }

        // ---- tree walking ------------------------------------------------------

        private struct Entry<T>
        {
            public IList<string> Path;
            public T Item;
        }

        // Group names are not part of the file name, so nested user groups become folders.
        // The root groups ("Program blocks", "PLC tags", ...) are not part of the path.

        private static IEnumerable<Entry<PlcBlock>> BlocksIn(PlcBlockGroup group, List<string> path)
        {
            foreach (PlcBlock item in group.Blocks)
                yield return new Entry<PlcBlock> { Path = path.ToList(), Item = item };

            foreach (PlcBlockUserGroup child in group.Groups)
                foreach (var entry in BlocksIn(child, new List<string>(path) { child.Name }))
                    yield return entry;
        }

        private static IEnumerable<Entry<PlcType>> TypesIn(PlcTypeGroup group, List<string> path)
        {
            foreach (PlcType item in group.Types)
                yield return new Entry<PlcType> { Path = path.ToList(), Item = item };

            foreach (PlcTypeUserGroup child in group.Groups)
                foreach (var entry in TypesIn(child, new List<string>(path) { child.Name }))
                    yield return entry;
        }

        private static IEnumerable<Entry<PlcTagTable>> TablesIn(PlcTagTableGroup group, List<string> path)
        {
            foreach (PlcTagTable item in group.TagTables)
                yield return new Entry<PlcTagTable> { Path = path.ToList(), Item = item };

            foreach (PlcTagTableUserGroup child in group.Groups)
                foreach (var entry in TablesIn(child, new List<string>(path) { child.Name }))
                    yield return entry;
        }

        private static IEnumerable<Device> AllDevices(Project project) =>
            project.Devices
                .Concat(project.UngroupedDevicesGroup.Devices)
                .Concat(project.DeviceGroups.SelectMany(AllDevices));

        private static IEnumerable<Device> AllDevices(DeviceUserGroup group) =>
            group.Devices.Concat(group.Groups.SelectMany(AllDevices));

        private static IEnumerable<DeviceItem> Flatten(DeviceItem item) =>
            new[] { item }.Concat(item.DeviceItems.SelectMany(Flatten));

        private static Software GetSoftware(Device device) =>
            device.DeviceItems
                .SelectMany(Flatten)
                .Select(i => i.GetService<SoftwareContainer>())
                .FirstOrDefault(c => c != null)
                ?.Software;

        // ---- output ------------------------------------------------------------

        /// <summary>
        /// Copies the staged files to the output folder, normalizing XML on the way.
        /// Only the folders this tool owns are replaced, so removed blocks disappear
        /// from the repository instead of lingering.
        /// </summary>
        private void Commit(IEnumerable<string> plcNames)
        {
            Directory.CreateDirectory(_output.FullName);

            foreach (string plcName in plcNames)
            {
                string stagedPlc = Path.Combine(_staging, plcName);
                string finalPlc = Path.Combine(_output.FullName, plcName);

                foreach (string kind in new[] { ExportLayout.Blocks, ExportLayout.Types, ExportLayout.Tags })
                {
                    string finalKind = Path.Combine(finalPlc, kind);
                    if (Directory.Exists(finalKind)) Directory.Delete(finalKind, true);

                    string stagedKind = Path.Combine(stagedPlc, kind);
                    if (!Directory.Exists(stagedKind)) continue;

                    foreach (string file in Directory.EnumerateFiles(stagedKind, "*", SearchOption.AllDirectories))
                    {
                        string target = Path.Combine(finalKind, file.Substring(stagedKind.Length).TrimStart('\\', '/'));
                        if (file.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
                        {
                            XmlNormalizer.NormalizeFile(file, target);
                        }
                        else
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(target));
                            File.WriteAllText(target, NormalizeText(File.ReadAllText(file)), new UTF8Encoding(false));
                        }
                    }
                }
            }

            File.WriteAllText(
                Path.Combine(_output.FullName, ExportLayout.ProjectFile),
                ExportLayout.ProjectJson(_tiaVersion, plcNames),
                new UTF8Encoding(false));
        }

        private static string NormalizeText(string text) =>
            text.TrimStart('﻿').Replace("\r\n", "\n").Replace('\r', '\n');

        private void Skip(string name, string reason) => _skipped.Add($"{name}: {reason}");

        private void Count(string what)
        {
            _counts.TryGetValue(what, out int n);
            _counts[what] = n + 1;
        }

        private void PrintSummary(IEnumerable<string> plcNames)
        {
            Console.WriteLine();
            Console.WriteLine($"Exported to {_output.FullName}");
            Console.WriteLine($"  PLCs: {string.Join(", ", plcNames)}");
            foreach (var pair in _counts.OrderBy(p => p.Key, StringComparer.Ordinal))
                Console.WriteLine($"  {pair.Key}: {pair.Value}");

            if (_skipped.Count > 0)
            {
                Console.WriteLine($"  NOT exported ({_skipped.Count}):");
                foreach (string s in _skipped) Console.WriteLine("    " + s);
            }
        }

        private static void OnConfirmation(object sender, ConfirmationEventArgs e)
        {
            // Not answered on purpose: an export should never need a confirmation, so
            // anything TIA asks is shown to the user instead of being accepted blindly.
            Console.WriteLine($"TIA asks: {e.Text}");
            Console.WriteLine($"   choices: {string.Join(", ", e.Choices)}");
        }
    }
}
#endif
