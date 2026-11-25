# Preparing v0.0.1

This is a preparation workflow. It does not publish packages, create a tag, commit or push.
Public candidates are `@openautomation/core`, `@openautomation/docs-gen` and `openautomation`.
`render`, `diff` and `lint` remain private. The CLI must not depend on any private placeholder.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
dotnet test bridge/OpenAutomation.Bridge.sln
node scripts/check-packages.mjs
```

The package checker copies packages and pending changesets to a temporary directory, versions
that copy to `0.0.1`, and runs `pnpm -r publish --dry-run --no-git-checks`. Git checks are disabled
only because the copy is not a Git checkout; the command is always a dry run. It then resolves
workspace dependency ranges in the disposable copy, runs `npm pack` on each public package,
installs all three tarballs together into an empty folder, and runs the installed
`openautomation docs` binary on the synthetic corpus. It checks that all expected reports exist.
The temporary copy, tarballs and output are retained for inspection. The source checkout keeps
its pending changesets and versions. Run a build first so the copied `dist` directories reflect
the sources.

Inspect the dry-run file lists: only built ESM/declarations/maps, README, LICENSE, package metadata
and any release changelog should be included. No test fixtures, customer projects or source-only
workspace dependencies belong in a tarball. Repository, issues and homepage links use the current
repository owner. Confirm ownership and availability of the npm scope/package names separately
before any eventual publication; a successful dry run does not establish publishing rights.

Before declaring the bridge ready, compile against real Openness assemblies and check two
consecutive exports of an unchanged real project with the determinism script. Synthetic checks
and the external API stub do not replace that verification. Native HMI/PLC alarm export is still
pending evidence; document that limitation in release notes. Publication remains a separate
maintainer action after review.
