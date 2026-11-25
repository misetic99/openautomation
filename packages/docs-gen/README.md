# @openautomation/docs-gen

Generate CSV and Excel documentation from the core project model. Requires Node.js 20+.

```js
import { loadProject } from "@openautomation/core";
import { generateDocs } from "@openautomation/docs-gen";

const files = await generateDocs(await loadProject("./export"), "./documentation");
console.log(files);
```

Outputs I/O lists, tag cross references, hardware lists and optional multilingual alarm lists.
Unverified write directions are explicitly reported. CSV uses UTF-8 with BOM and LF; workbook
document and ZIP dates are fixed. No engineering installation is required.

MIT licensed. See the [documentation](https://github.com/misetic99/openautomation/tree/main/docs).
