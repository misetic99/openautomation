# @openautomation/render

Private development package for the project viewer. Excluded from the initial npm release.
The initial viewer highlights SCL/STL source and displays DB, UDT and tag tables in standalone
offline HTML. LAD/FBD instruction rendering requires verified anonymized native XML examples;
unsupported languages remain visible as notices. No native instruction renderers are registered.

From the repository root after `pnpm build`:

```sh
node scripts/render-project.mjs corpus/synthetic/v18/basic openautomation-viewer
```

Open `openautomation-viewer/index.html` locally. No server or network access is required.
The package exports `generateViewer`, `renderProject`, `renderBlock`, table renderers,
`highlightSource` and the normalized `renderNetwork` infrastructure. See the
[viewer guide](../../docs/viewer.md). The public CLI's reserved `render` command remains separate
from this private package.

Requires Node.js 20+. MIT licensed.
