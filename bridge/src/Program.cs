using System;
using System.IO;
using System.Runtime.CompilerServices;

namespace OpenAutomation.Bridge
{
    internal static class Program
    {
        private const string Usage =
            "Usage:\n" +
            "  openautomation-bridge export <project-file> <output-dir> [--tia <major>] [--upgrade]\n" +
            "  openautomation-bridge normalize <xml-file>\n" +
            "\n" +
            "export     Export every PLC of a TIA Portal project to text files.\n" +
            "           --tia <major>  TIA Portal version, for example 18 (default 18)\n" +
            "           --upgrade      Open older projects with OpenWithUpgrade. This migrates\n" +
            "                          the project file in place, so work on a copy.\n" +
            "normalize  Rewrite one SimaticML file in the stable form the export produces.\n";

        private static int Main(string[] args)
        {
            if (args.Length == 0 || args[0] == "--help" || args[0] == "-h")
            {
                Console.WriteLine(Usage);
                return args.Length == 0 ? 2 : 0;
            }

            try
            {
                switch (args[0])
                {
                    case "normalize":
                        return Normalize(args);
                    case "export":
                        return Export(args);
                    default:
                        Console.Error.WriteLine("Unknown command: " + args[0] + "\n\n" + Usage);
                        return 2;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"FAILED: {ex.GetType().Name}: {ex.Message}");
                // V18+ checks product licences explicitly; code that ran on V17 can fail
                // here because a licence was always required but never enforced.
                if (ex.GetType().Name == "LicenseNotFoundException")
                    Console.Error.WriteLine("A TIA Portal licence for the feature being used is missing.");
                return 1;
            }
        }

        private static int Normalize(string[] args)
        {
            if (args.Length != 2)
            {
                Console.Error.WriteLine(Usage);
                return 2;
            }
            string path = Path.GetFullPath(args[1]);
            XmlNormalizer.NormalizeFile(path, path);
            Console.WriteLine("Normalized " + path);
            return 0;
        }

        private static int Export(string[] args)
        {
            string? project = null, output = null;
            string tia = "18";
            bool upgrade = false;

            for (int i = 1; i < args.Length; i++)
            {
                switch (args[i])
                {
                    case "--tia":
                        if (++i >= args.Length) { Console.Error.WriteLine(Usage); return 2; }
                        tia = args[i];
                        break;
                    case "--upgrade":
                        upgrade = true;
                        break;
                    default:
                        if (project == null) project = args[i];
                        else if (output == null) output = args[i];
                        else { Console.Error.WriteLine(Usage); return 2; }
                        break;
                }
            }

            if (project == null || output == null)
            {
                Console.Error.WriteLine(Usage);
                return 2;
            }

            var projectFile = new FileInfo(project);
            if (!projectFile.Exists)
            {
                Console.Error.WriteLine("Project not found: " + projectFile.FullName);
                return 2;
            }

#if TIA_OPENNESS
            OpennessResolver.Version = tia + ".0";
            OpennessResolver.Register();
            return RunExport(projectFile, new DirectoryInfo(output), "V" + tia, upgrade);
#else
            _ = (tia, upgrade);
            Console.Error.WriteLine(
                "This build has no TIA Openness reference, so it cannot export. " +
                "See bridge/README.md for how to build it against your TIA Portal installation.");
            return 1;
#endif
        }

#if TIA_OPENNESS
        // Openness types stay out of Main/Export: the JIT would try to load
        // Siemens.Engineering before the resolver is registered.
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int RunExport(FileInfo project, DirectoryInfo output, string tiaVersion, bool upgrade) =>
            new Exporter(output, tiaVersion, upgrade).Run(project);
#endif
    }
}
