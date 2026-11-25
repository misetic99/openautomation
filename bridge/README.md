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
<out>/hardware/devices.json                every station, module, slot, network address, I/O range
<out>/hardware/hardware.aml                CAx (AutomationML) export, for importing again later
```

`devices.json` is built from the Openness object model, so it is complete and stable. The AML file
is TIA Portal's own CAx export; its time stamp (`LastWritingDateTime`) is removed, but whether
anything else in it changes between two exports has to be checked on a real project.

HMI (screens, HMI tags, alarms) is not exported yet.

## Normalized alarm interchange

The core loader optionally reads `hmi/<device>/alarms.json`. This is an OpenAutomation
interchange format, **not** a native engineering export and not currently produced by the bridge.
Its presence, including an empty alarm array, enables alarm reports. Older exports need no changes.

```json
{
  "format": 1,
  "alarms": [
    {
      "id": "100",
      "name": "MotorOverload",
      "texts": { "de-DE": "Motorueberlast", "en-US": "Motor overload" },
      "source": "HMI",
      "plc": "PLC_1",
      "class": "Fault",
      "triggerTag": "Overload",
      "triggerBit": 0
    }
  ]
}
```

`id`, `name`, `texts` and `source` are required; IDs are nonempty strings unique within
the device file. `texts` maps language identifiers to text, preserving all translations and empty
strings. `source` is `PLC` or `HMI`; the device name comes from the parent folder. The same envelope
can carry PLC-origin alarms collected by an HMI. `plc`, `class`, `triggerTag` and `triggerBit` are
optional. A bit is a nonnegative safe integer and requires a tag; no upper bit limit is assumed
without the tag's actual type. The tag is a global **PLC** tag name, not an unresolved HMI alias.
`plc` must explicitly identify its PLC folder; no cross-PLC name matching is guessed.

Writers must emit UTF-8, LF, fixed field order as above, alarms sorted by ID then name and language
keys sorted by code point. No timestamps, user or machine metadata are allowed. The parser
normalizes ordering and reports malformed files through model warnings. Unsupported fields are
ignored. Missing files leave the optional model field absent. This format does not assert that
all project alarms have been exported.

`alarm-list.csv` contains a row per translation, with tag address, referencing blocks and verified
writers. `alarm-list.xlsx` contains an `Alarms` sheet, including for HMI-only projects; each PLC's
I/O workbook also contains its alarms. Native block parsing currently counts references without
read/write direction. Such blocks appear under `Used in`; `Written by` stays empty and `Resolution`
states `Write direction unknown`. A model producer may set `Reference.access` only with verified
evidence. An empty writer cell is not proof that the tag is never written.

### Alarm exporter TODOs

- Comfort/Advanced V18: verify the actual alarm collections, discrete/analog properties, class
  lookup and multilingual text access against the V18 manual and installed assemblies.
- Unified V18: verify its separate object model and the names introduced after V16. Do not reuse
  Comfort/Advanced classes or infer V18 signatures from newer manuals.
- PLC `Program_Alarm` and ProDiag: obtain anonymized native exports with translations and trigger
  bindings before implementing parsing or export. The synthetic JSON is not evidence of XML shape.
- Verify HMI-tag-to-PLC-tag connection mapping and access direction before claiming writer links.
- Add an exporter only after those checks, with deterministic serialization tests and a real run.

The official [older Openness manual](https://cache.industry.siemens.com/dl/files/802/109773802/att_1007204/v1/TIAPortalOpenness_en-US.pdf)
documents Unified alarm access, but does not establish V18 signatures. The
[V18 Update 3 readme](https://cache.industry.siemens.com/dl/files/218/109817218/att_1156057/v1/ReadMe_TIA_V18_UPD3_enUS.pdf)
describes Unified fixes but does not supply the required alarm API signatures. Neither is sufficient
evidence for new V18 alarm API calls here. No alarm-specific C# calls have been added.

## Determinism

Two consecutive exports of the same project must give zero differences in `git diff`. Every
XML file is rewritten with fixed indentation, UTF-8 without BOM and LF line endings, and the
volatile elements listed in `XmlNormalizer.VolatileElements` (modification and compile dates)
are removed. `project.json` has no timestamps, user names or machine names.

That element list comes from the documented SimaticML attributes and must still be checked against
real exports from each supported TIA Portal version. When a real export shows another volatile
element, add it to the list and add a test. `openautomation-bridge normalize <file>` applies the
same rewrite to one file, which helps when comparing two exports by hand.

Run the read-only project check from the repository root on Windows with TIA Portal and Git:

```powershell
.\scripts\check-determinism.ps1 -ProjectFile C:\work\Example.ap18 -BridgePath C:\tools\openautomation-bridge.exe -Tia 18
```

The script exports into two new folders below a temporary root, runs `git diff --no-index` and
checks SHA-256 hashes of every file independently of Git's text handling. Changed `.xml` and `.aml`
files also list namespace-qualified element and attribute paths, without dumping project values.
Results are retained for inspection. Use `-OutputRoot C:\work\determinism-check` to choose a new
destination; an existing destination is refused. Exit codes: `0` identical, `1` different, `2`
export/tool failure. The script never requests project migration. Review and anonymize the output
before sharing it, then add a focused normalizer test for any newly confirmed volatile element.
Its synthetic integration checks run with `powershell -File scripts/check-determinism.test.ps1`;
they validate the checker, not determinism of a real engineering export.

## Status of the Openness code

`ExportLayout`, `HardwareJson` and `XmlNormalizer` are covered by tests. `Exporter` compiles against a
stand-in for the Siemens API that mirrors only what the code assumes, but it has not been compiled
against the real `Siemens.Engineering.dll` or run, because that needs Siemens' assembly and a licence. Treat the first
run on a real project as the test, and fix what it finds.
