# OpenAutomation

Open tooling that turns a whole TIA Portal project into readable text files and builds review,
diff, quality checks and documentation on top of them, without needing a TIA Portal licence.

It covers blocks in every language (LAD, FBD, SCL, STL, GRAPH), DBs, UDTs, tags, hardware and HMI.

> **Status:** early development. The first tool works: from an export folder it generates the
> I/O list, tag cross references and hardware list, plus optional normalized alarm reports.
> A private offline viewer covers SCL/STL, DBs and tag tables. Native alarm export and LAD/FBD
> instruction rendering still need verified exports. See the [roadmap](#roadmap).

## Why

- **Runs locally**, on your own GitHub or GitLab, so PLC code never leaves your company.
- **Checks the links between PLC program, HMI and hardware**, not only the code.
- **Open rules**: anyone can add a check or a renderer for another instruction.
- **Free**: MIT licensed.

For system integrators, machine builders, factory maintenance teams and anyone who wants to keep
PLC projects in Git. The project and its tools are in English for an international audience.

## How it fits together

```
TIA Portal project
   │  (Windows + TIA Portal only)
   ▼
bridge/  ── C# + Openness: export and import of the whole project
   │
   ▼
Git repository of exported text files (SimaticML, SCL/STL sources, tag tables, AML)
   │  (runs anywhere, including CI)
   ▼
@openautomation/core  ── model of the whole project
   ├─ render     SVG for LAD, FBD, GRAPH; highlighting for SCL and STL
   ├─ diff       semantic diff of blocks, networks, tags and hardware
   ├─ lint       quality rules and PLC ↔ HMI ↔ hardware checks
   ├─ docs-gen   I/O list, alarm list, cross-references, call tree
   └─ cli        npx openautomation <command>
```

Only the bridge needs TIA Portal. Everything else works on the exported files. Export is
deterministic: two consecutive exports of the same project give zero differences in `git diff`.

## Repository layout

| Path | What |
| --- | --- |
| `bridge/` | C# .NET exporter and importer (Windows + TIA Portal) |
| `packages/core` | `@openautomation/core`: parser and project model |
| `packages/render` | `@openautomation/render` |
| `packages/diff` | `@openautomation/diff` |
| `packages/lint` | `@openautomation/lint` |
| `packages/docs-gen` | `@openautomation/docs-gen` |
| `packages/cli` | `openautomation` command line |
| `integrations/` | GitHub Action, GitLab CI, VS Code extension |
| `corpus/` | Anonymized exports from V17 to V21, used as test data |
| `examples/` | Small demo projects |
| `docs/` | Web documentation |

## Roadmap

There are no fixed dates. Every step ends with a release that is useful on its own.

| Release | Content |
| --- | --- |
| v0.0.1 | Bridge export of blocks, UDTs and tag tables; project model; I/O list and cross references (CSV, Excel) |
| v0.1 | Deterministic export of the whole project including hardware (AML); hardware list; I/O list with module; alarm list |
| v0.2 | Viewer: SCL, STL, DBs, tag tables, then LAD and FBD as SVG; web demo |
| v0.3 | Semantic diff and pull request review; GitHub Action and GitLab CI |
| v0.4 | 20 lint rules, 5 of them across PLC, HMI and hardware; VS Code extension |
| v0.5 | Generator (standard blocks and tags from YAML or Excel), HMI screens, MCP server |
| v1.0 | Stable API |

## Development

Requires Node.js 20+ and [pnpm](https://pnpm.io). The bridge additionally needs Windows, the
.NET SDK and TIA Portal (see [bridge/README.md](bridge/README.md)).

```sh
pnpm install
pnpm build
pnpm test
```

Try it on the synthetic example:

```sh
node packages/cli/dist/bin.js docs corpus/synthetic/v18/basic --out openautomation-docs
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to help.

Preview the private viewer after building:

```sh
node scripts/render-project.mjs corpus/synthetic/v18/basic openautomation-viewer
```

Open `openautomation-viewer/index.html`. See the [viewer guide](docs/viewer.md),
[export format](docs/export-format.md) and [release preparation](docs/releasing.md).

## Not affiliated with Siemens

OpenAutomation is an independent project and is not affiliated with, endorsed by or sponsored by
Siemens. Siemens, SIMATIC, TIA Portal and WinCC are trademarks of their respective owners and are
used here only to describe compatibility.

## Licence

[MIT](LICENSE)
