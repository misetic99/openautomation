# openautomation

Generate documentation or inspect the model of an exported automation project. Node.js 20+
is required; reading exports does not need TIA Portal.

```sh
openautomation docs ./export --out ./documentation
openautomation model ./export
openautomation --help
```

`docs` writes I/O lists, cross references and hardware lists, plus alarm reports when normalized
alarm files are present. `model` prints stable JSON. `diff`, `lint` and `render` are reserved
commands and report that they are not implemented.

Exporting the original project requires the separate Windows bridge and a licensed installation.
The npm release is being prepared; see the [release checklist](https://github.com/misetic99/openautomation/blob/main/docs/releasing.md).

MIT licensed.
