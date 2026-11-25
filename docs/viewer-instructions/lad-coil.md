# Render one LAD output coil

Suggested label: `good first issue`.

Input: pending a real, anonymized LAD network XML snippet with an ordinary output coil, operand
binding and incoming wire. Record Portal version/update. Include any output port only if the
native format establishes it; do not assume contact-shaped ports.

Expected SVG presentation (illustrative only):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">
  <title>Output coil: Running</title>
  <text x="65" y="20">Running</text>
  <path d="M 10 45 H 75 M 85 25 Q 65 45 85 65 M 105 25 Q 125 45 105 65 M 115 45 H 190"
        fill="none" stroke="currentColor"/>
</svg>
```

Implement the verified ordinary coil mapping and renderer separately from set/reset coils.
Test the actual native snippet, operand escaping, wire endpoints and stable SVG bytes.
