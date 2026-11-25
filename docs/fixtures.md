# Test fixtures

## Synthetic examples

Create focused data below `corpus/synthetic/<version>/<case>/`. Use invented names and comments,
portable paths and the [export layout](export-format.md). A small `project.json` might be:

```json
{ "tiaVersion": "V18", "plcs": ["PLC_1"] }
```

Add only the objects needed by the test. Handwritten XML must never be described as a native
export. Document which relationships are synthetic and what the case is testing. The normalized
alarm JSON can exercise translations and tag resolution without suggesting that it matches
native alarm XML. Use multiple languages, shuffled object order and malformed cases in tests
when they exercise actual parser boundaries.

Load fixture paths relative to `import.meta.url`, not the working directory. Copy a fixture to a
temporary folder before mutating it and clean that folder in `finally` or a test teardown.
Keep assertions about behavior, such as missing-object warnings or verified links, rather than
merely repeating every implementation field.

## Native examples

Native fixtures belong below `corpus/<version>/<case>/`. Before sharing, anonymize device/project
names, PLC code, tags, comments and multilingual texts; manually inspect every file. Do not
commit source project archives, customer identifiers or proprietary libraries. Record the Portal
version/update, export procedure and intended coverage in a case README. Preserve the exported
file bytes rather than formatting XML in an editor.

Native evidence wins when a synthetic shape disagrees. Add a regression test for the native case
and correct the synthetic fixture. There are currently no native LAD/FBD examples in this repo;
the handwritten LAD fixture is sufficient for reference tests, not for implementing instruction
geometry or wire semantics.
