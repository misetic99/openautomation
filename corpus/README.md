# Corpus

Anonymized exports from TIA Portal V17 to V21, used as test data. SimaticML differs between
versions, so every parser change is tested against exports from each of them.

Layout: `corpus/<version>/<case>/` (for example `corpus/v18/lad-motor-start/`).

## Rules for contributions

- Never commit a real customer project. Anonymize first (tag names, comments, project and
  device names) with the anonymizer tool once it exists, and check the result by hand.
- Keep each case small and focused on one feature.
- Files are stored byte-for-byte (see `.gitattributes`); do not reformat them.
