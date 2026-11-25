# Bridge

The only part of OpenAutomation that needs Windows and a licensed TIA Portal. It uses the
Openness API to export a project to text files.

Everything else in this repository works on the exported files and runs anywhere.

## Requirements

- Windows with TIA Portal installed (V17 or newer) and the Openness option
- The user must be a member of the local Windows group **Siemens TIA Openness**. Adding someone
  to it lets them drive TIA Portal from code, so it needs an administrator, and the user must
  log off and on again afterwards.
- .NET SDK
- The first run of a new executable shows an Openness firewall dialog in TIA Portal. Approve it
  once; an unattended run cannot do that for you.

## Build

`Siemens.Engineering.dll` is part of TIA Portal and is not redistributed here. Point the build at
your own copy:

```powershell
dotnet build src -p:TiaOpennessDll="C:\Program Files\Siemens\Automation\Portal V18\PublicAPI\V18\Siemens.Engineering.dll"
```

Without that property the project still compiles and the tests run, but `export` only prints a
notice. The Openness code (`Exporter.cs`, `OpennessResolver.cs`) is compiled only when the
property is set.

```powershell
dotnet test OpenAutomation.Bridge.sln
```

## Use

```powershell
openautomation-bridge export C:\work\Plant.ap18 C:\work\plant-export --tia 18
```

- The project is opened with `Open`. For a project saved by an older TIA Portal add `--upgrade`,
  which migrates the project file in place, so run it on a copy.
- Nothing is saved, compiled or downloaded. The export only reads.
- Blocks that are not consistent or that are know-how protected are skipped and listed at the
  end, and the exit code is 3. Compile the project in TIA Portal first if blocks are missing.
- Re-exporting into an existing export replaces only `blocks/`, `types/` and `tags/` of each PLC,
  so deleted blocks disappear from Git. A folder that is not empty and has no `project.json` is
  refused.

## Output layout

```
<out>/project.json
<out>/<plc>/blocks/<group>/<Name>.xml      SimaticML (OB, FB, FC, DB)
<out>/<plc>/blocks/<group>/<Name>.scl      readable source for SCL blocks (.awl for STL)
<out>/<plc>/types/<group>/<Name>.xml       UDTs
<out>/<plc>/tags/<group>/<Table>.xml       tag tables
```

Hardware (AML) and HMI are not exported yet.

## Determinism

Two consecutive exports of the same project must give zero differences in `git diff`. Every
XML file is rewritten with fixed indentation, UTF-8 without BOM and LF line endings, and the
volatile elements listed in `XmlNormalizer.VolatileElements` (modification and compile dates)
are removed. `project.json` has no timestamps, user names or machine names.

That element list comes from the documented SimaticML attributes and must still be checked against
real exports from each supported TIA Portal version. When a real export shows another volatile
element, add it to the list and add a test. `openautomation-bridge normalize <file>` applies the
same rewrite to one file, which helps when comparing two exports by hand.

## Status of the Openness code

`ExportLayout` and `XmlNormalizer` are covered by tests. `Exporter` has not been compiled or run
against a real TIA Portal yet, because that needs Siemens' assembly and a licence. Treat the first
run on a real project as the test, and fix what it finds.
