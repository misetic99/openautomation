# Render one FBD OR instruction

Suggested label: `good first issue`.

Input: pending a native, anonymized FBD XML snippet with one OR instruction, two Boolean inputs,
one output, operand access records and wires. Record Portal version/update. Confirm the native
instruction identifier independently from AND; do not derive it by changing a remembered name.

Expected SVG presentation (illustrative two-input frame):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <title>Boolean OR</title>
  <rect x="60" y="15" width="80" height="70" fill="none" stroke="currentColor"/>
  <text x="88" y="55">≥1</text>
  <path d="M 10 35 H 60 M 10 65 H 60 M 140 50 H 190" fill="none" stroke="currentColor"/>
</svg>
```

Implement only the evidenced variant. Test the native snippet, port mapping, escaped labels,
unknown variants and byte-identical output. Require separate fixtures for inversion or extra
inputs before extending support.
