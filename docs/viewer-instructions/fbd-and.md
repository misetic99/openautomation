# Render one FBD AND instruction

Suggested label: `good first issue`.

Input: pending a native, anonymized FBD XML snippet containing one AND instruction with two
connected Boolean inputs and one output. Keep the actual port names, operand accesses and wires;
record Portal version/update. Establish how additional and negated inputs are represented before
claiming those variants.

Expected SVG presentation (illustrative two-input frame):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <title>Boolean AND</title>
  <rect x="60" y="15" width="80" height="70" fill="none" stroke="currentColor"/>
  <text x="93" y="55">&amp;</text>
  <path d="M 10 35 H 60 M 10 65 H 60 M 140 50 H 190" fill="none" stroke="currentColor"/>
</svg>
```

Add a native-to-normalized mapping and a registry renderer using supplied geometry. Test real
port connectivity, stable SVG, unknown variants and escaped operand labels. Leave negation and
variable input counts unsupported until each has native evidence.
