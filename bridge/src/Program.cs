using System;

namespace OpenAutomation.Bridge
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
#if TIA_OPENNESS
            // Export / import implementation lands here; it needs Siemens.Engineering.
            Console.Error.WriteLine("openautomation-bridge: not implemented yet");
            return 1;
#else
            Console.Error.WriteLine(
                "openautomation-bridge was built without the TIA Openness reference. " +
                "See bridge/README.md for how to build it against your TIA Portal installation.");
            return 1;
#endif
        }
    }
}
