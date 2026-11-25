# Contributing

Thanks for helping. Small contributions are welcome, and a lot of the work is split into small,
independent tasks.

## Ways to help

- **Pick a `good first issue`.** Each LAD/FBD instruction in the renderer and each rule in the
  linter is its own small task.
- **Contribute test data** without writing code: anonymized exports for `corpus/`, templates of
  standard blocks, documentation translations.
- **Report bugs** with the TIA Portal version and, if possible, a minimal anonymized export.

## Never share customer code

Do not post or commit real PLC code, tag names, comments or project names from a customer. Anonymize
first and check the result by hand.

## Development setup

```sh
pnpm install
pnpm build
pnpm test
```

Node.js 20+ and pnpm are required. The C# bridge needs Windows and TIA Portal, so you only need it
when working in `bridge/`.

## Pull requests

1. Open an issue first for anything bigger than a small fix.
2. Keep a PR focused on one change, with tests.
3. Add a changeset for any user-visible change in a package: `pnpm changeset`.
4. CI must pass (`pnpm build`, `pnpm test`).

We aim to reply to every PR within 48 hours.

## Principles

- Export must stay **deterministic**: stable ordering, no timestamps or other volatile data.
- Everything outside `bridge/` must run without TIA Portal.
- No Siemens trademarks in names or logos.
- Code, docs and issues are in English.

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
