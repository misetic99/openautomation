# Adding a parser

1. Establish the source format from official version-specific documentation and a minimal,
   anonymized native export. Record the version and origin in the fixture README. If only a
   synthetic format exists, label it as synthetic and limit the support claim accordingly.
2. Put a pure parser in `packages/core/src/parse-<kind>.ts`. Take text and relative location
   information as arguments; return a typed model object. Keep file access in `load.ts`.
3. Reuse helpers in `xml.ts`, handle singular and repeated XML elements, and validate required
   structures. Throw an English error for malformed/unsupported input. Do not silently drop
   unreadable objects; let the loader turn errors into relative-path warnings.
4. Extend `model.ts` with documented fields, avoiding absolute paths and volatile metadata.
   Export the parser from `index.ts`, and wire optional loading into `loadProject` while keeping
   older exports readable. Reserve any new top-level directory from fallback PLC discovery.
5. Sort unordered collections with `compare` from core. Build objects in fixed field order.
   Preserve meaningful source order such as DB members. Never use `localeCompare`.
6. Add adjacent Vitest tests for valid, malformed, absent and version-specific data. Exercise
   the loader with a copied fixture and assert warnings. Compare stable JSON for reordered
   equivalent inputs and different root paths. For each new generated output, compare full bytes
   under different clocks and paths, including container metadata such as ZIP dates.
7. Run `pnpm build` and `pnpm test`. For bridge changes, also run
   `dotnet test bridge/OpenAutomation.Bridge.sln`. Add a changeset for public package behavior
   with `pnpm changeset` and update the format documentation.

All packages use strict TypeScript and ESM imports with `.js` suffixes. Parsers and tests must
run on any supported OS without a bridge or engineering installation. Avoid exposing the internal
XML helper representation as a public package subpath.

An API stub establishes internal consistency only. New Openness calls require documentation for
the exact target version and validation with installed assemblies. Keep them behind
`#if TIA_OPENNESS`, and record anything still unverified in `bridge/README.md`.
