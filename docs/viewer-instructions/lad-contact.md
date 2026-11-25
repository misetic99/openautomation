# Render one LAD normally open contact

Suggested label: `good first issue`.

Input: pending a real, anonymized LAD network XML snippet containing one normally open contact,
its operand access and wires. Record the Portal version/update and preserve the native export
as a fixture. The handwritten corpus XML does not satisfy this prerequisite.

Expected SVG presentation (illustrative operand and coordinates):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">
  <title>Normally open contact: Enable</title>
  <text x="70" y="20">Enable</text>
  <path d="M 10 45 H 75 M 75 30 V 60 M 105 30 V 60 M 105 45 H 190"
        fill="none" stroke="currentColor"/>
</svg>
```

Map only the verified native contact variant into a normalized node with power input/output
ports. Keep native IDs for wiring. Use the supplied geometry and escape the operand. Add tests
for the real snippet, wire connectivity, deterministic SVG, escaped labels and an unsupported
variant. Do not infer closed, edge or negated contacts from this example.
