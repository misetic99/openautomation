# Bridge

The only part of OpenAutomation that needs Windows and a licensed TIA Portal. It uses the
Openness API to export a project to text files and to import generated content back.

Everything else in this repository works on the exported files and runs anywhere.

## Requirements

- Windows with TIA Portal installed (V17 or newer)
- The user must be a member of the local Windows group **Siemens TIA Openness**
- .NET SDK

## Build

`Siemens.Engineering.dll` is part of TIA Portal and is not redistributed here. Point the build at
your own copy:

```powershell
dotnet build src -p:TiaOpennessDll="C:\Program Files\Siemens\Automation\Portal V18\PublicAPI\V18\Siemens.Engineering.dll"
```

Without that property the project still compiles, but the executable only prints a notice.

## Export rules

- Blocks in LAD, FBD, SCL, STL and GRAPH, plus DBs and UDTs, are exported as SimaticML.
- Hardware is exported as AML (CAx), because Openness does not export hardware as SimaticML.
- Output must be deterministic: stable element order and no volatile data such as export time.
  Two consecutive exports of the same project must produce zero differences in `git diff`.
