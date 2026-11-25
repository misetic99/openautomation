# Examples

Small demo projects used to test the bridge and as material for documentation.

## The demo project

Build it in TIA Portal V18 first, then save it again in V19, V20 and V21. Keep it small and
fully made up: nothing from a real customer.

- [ ] One PLC (S7-1500 or S7-1200)
- [ ] One block in each language: LAD, FBD, SCL, STL, GRAPH
- [ ] A global DB, an instance DB and a UDT used by the DB
- [ ] Two tag tables, one of them in a user group, with inputs, outputs and markers, some with
      comments in two languages
- [ ] One tag that no block uses
- [ ] One HMI with one screen
- [ ] Compile with no errors before exporting

## Export it

```powershell
openautomation-bridge export Demo.ap18 examples\demo-v18\export --tia 18
```

Then run the export twice more and check `git status` shows no changes after the second run.
That is the determinism test. If it shows changes, a volatile element is missing from
`XmlNormalizer.VolatileElements`.

Put each version in its own folder: `examples/demo-v18/`, `examples/demo-v19/` and so on, with the
exported files under `export/`. Files under `examples/**/export/` are stored byte for byte.
