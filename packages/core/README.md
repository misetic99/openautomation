# @openautomation/core

Parse an OpenAutomation export without an engineering installation. Requires Node.js 20+.

```js
import { loadProject, toStableJson } from "@openautomation/core";

const project = await loadProject("./export");
console.log(toStableJson(project));
```

Includes block, DB, UDT, tag-table and hardware parsers and an optional normalized alarm reader.
Unsupported files produce warnings. The bundled corpus is synthetic; native export coverage
still needs verification. See the [export format](https://github.com/misetic99/openautomation/blob/main/docs/export-format.md).

MIT licensed. Source and issue links are in the package metadata.
