# Offline viewer foundation

The private `@openautomation/render` package is the start of the v0.2 viewer. It is not part of
the v0.0.1 npm candidates and the public CLI does not depend on it.

```sh
pnpm build
node scripts/render-project.mjs corpus/synthetic/v18/basic openautomation-viewer
```

Open the resulting `index.html` in a browser. The single file includes navigation, SCL and STL
lexical highlighting, nested DB/UDT member tables and tag tables. It needs neither a server nor
external assets. Source text comes from the adjacent `.scl`/`.awl` paths recorded by core.
Missing and out-of-root sources produce visible warnings. Symbol names, comments and source
content are HTML-escaped; the viewer runs no project code or JavaScript. Syntax coloring is not
compilation or semantic validation. This initial view covers PLC objects, not HMI screens.

LAD, FBD and GRAPH blocks show an explicit unavailable notice. The synthetic LAD fixture is
not used to infer instruction or wire semantics. A web demo and native instruction rendering
remain future work; no deployment is included.

## Network extension contract

`renderNetwork` accepts an explicitly normalized `Network`, with named instruction nodes,
input/output ports and wires. It validates duplicate IDs/ports and wire endpoints before
rendering. Nodes and edges are sorted by code point; the initial layout stacks instruction
frames. An injected registry maps instruction names to trusted SVG renderers. With an empty
registry it returns `status: "unsupported"` and the sorted missing instruction names. It never
silently omits unknown nodes. No native SimaticML-to-network parser or instruction mapping is
claimed yet. Registry implementations must escape all operands with `escapeHtml` and use
the supplied geometry; they are trusted code, not data loaded from an export.

Before implementing a native instruction, obtain a minimal anonymized real export with the
Portal version/update, source language, symbol mapping and expected connectivity. Include both
the instruction and its wires. Preserve those XML bytes. Test the native-to-normalized mapping
and SVG together, including unsupported instructions and dangling ports.

Starter tasks are in [the instruction backlog](viewer-instructions/README.md). They are local
issue drafts, not submitted GitHub issues. Their native XML inputs are explicitly pending;
synthetic SVG targets describe presentation only and are not evidence of a native schema.
