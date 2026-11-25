#if TIA_OPENNESS
#nullable disable
using System;
using System.IO;
using System.Reflection;
using Microsoft.Win32;

namespace OpenAutomation.Bridge
{
    /// <summary>
    /// Finds Siemens.Engineering* through the registry entry written by the TIA Portal
    /// Openness installer. Register() must run before any method that mentions an
    /// Openness type is entered, because the JIT loads the assembly on method entry.
    /// </summary>
    internal static class OpennessResolver
    {
        /// <summary>Portal major version: "17.0", "18.0", "19.0", "20.0".</summary>
        public static string Version { get; set; } = "18.0";

        private static string RegistryPath =>
            $@"SOFTWARE\Siemens\Automation\Openness\{Version}\PublicAPI\{Version}.0.0";

        public static void Register()
        {
            AppDomain.CurrentDomain.AssemblyResolve += Resolve;
        }

        private static Assembly Resolve(object sender, ResolveEventArgs args)
        {
            int comma = args.Name.IndexOf(',');
            string simpleName = comma == -1 ? args.Name : args.Name.Substring(0, comma);

            if (!simpleName.StartsWith("Siemens.Engineering", StringComparison.Ordinal))
                return null;

            using (RegistryKey baseKey = RegistryKey.OpenBaseKey(
                       RegistryHive.LocalMachine, RegistryView.Registry64))
            using (RegistryKey key = baseKey.OpenSubKey(RegistryPath))
            {
                if (key == null)
                    throw new InvalidOperationException(
                        $"TIA Portal Openness V{Version} is not installed " +
                        $"(missing registry key HKLM\\{RegistryPath}). " +
                        "Check the installed Portal version and pass --tia <major>.");

                string path = key.GetValue(simpleName) as string;
                if (string.IsNullOrEmpty(path) || !File.Exists(path))
                    return null;

                return Assembly.LoadFrom(path);
            }
        }
    }
}
#endif
