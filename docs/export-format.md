# Export format

The bridge writes a directory; all TypeScript packages consume its files without TIA Portal.
Paths stored in the model are relative to that directory and use forward slashes on every OS.

```text
project.json
<plc>/blocks/<groups...>/<Name>.xml
<plc>/blocks/<groups...>/<Name>.scl   (or .awl)
<plc>/types/<groups...>/<Name>.xml
<plc>/tags/<groups...>/<Table>.xml
hardware/devices.json
hardware/hardware.aml
hmi/<device>/alarms.json            (optional interchange, not exported by the bridge yet)
```

`project.json` identifies `tiaVersion` and the `plcs` array of folder names. Without readable
metadata the loader warns and discovers PLC folders, excluding `hardware` and `hmi`.
Keep folder names portable and unique. The bridge sanitizes names and refuses PLC collisions.

Block XML supplies identity, language and global references. Adjacent `.scl`/`.awl` files supply
readable source. DBs and UDTs contain nested members; tag tables contain tag names, data types,
addresses and comments. These parsers implement the tested subset of SimaticML, not every
version-specific variant. Unknown or malformed supported objects produce relative-path warnings.

`hardware/devices.json` uses `format: 1` and a `devices` array. Stations include `name`,
`typeIdentifier`, `group`, optional `software` and `plc`, and nested `items`. Items contain their
identity, optional `position` and `networkAddress`, address ranges (`ioType`, byte `start`, bit
`length`) and nested items. Hardware is optional for older exports. AML is retained for later
round trips; the core model reads JSON rather than reverse-engineering AML.

The optional alarm envelope, validation and ordering rules are specified in
[the bridge contract](../bridge/README.md#normalized-alarm-interchange). `ProjectModel.alarms`
is absent without alarm files, and may be empty when files exist. `Alarm.source` identifies PLC
or HMI origin; device and ID together identify an alarm. Texts remain per-language. The loader
does not interpret native alarm XML or resolve HMI connection aliases.

The model has `schemaVersion: 1`. Add optional fields for compatible extensions; breaking model
changes require an explicit schema/version decision and migration notes. Check `warnings` before
treating a report as complete. Global references currently lack read/write direction; only
producers with verified evidence may set `Reference.access`.

## Stable output

Use core's `compare` for code-point ordering, never locale-sensitive comparison. Builders fix
property order and sort collections that have no semantic order; preserve PLC member order where
it conveys structure. No generated export contains wall-clock, user or machine metadata. JSON
uses two-space indentation and a final LF; XML is normalized by the bridge. CSV has UTF-8 BOM
and LF. XLSX document and ZIP entry dates are fixed.

Every new generated file needs a test comparing bytes across runs in different output locations
and with different clocks. Synthetic tests establish software behavior; they cannot establish
that the real exporter removes every volatile engineering field. Run
[`scripts/check-determinism.ps1`](../scripts/check-determinism.ps1) on a licensed Windows machine
with a real, unchanged project and inspect any changed XML paths. Retain the project unchanged
between runs. Normalize only fields shown to be volatile; identifiers and engineering values
must survive.
