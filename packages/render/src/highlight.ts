import { escapeHtml } from "./html.js";

const scl = new Set(("FUNCTION FUNCTION_BLOCK ORGANIZATION_BLOCK DATA_BLOCK TYPE END_TYPE " +
  "END_FUNCTION END_FUNCTION_BLOCK END_ORGANIZATION_BLOCK END_DATA_BLOCK VAR VAR_INPUT VAR_OUTPUT " +
  "VAR_IN_OUT VAR_TEMP VAR_CONSTANT END_VAR BEGIN END IF THEN ELSE ELSIF END_IF CASE OF END_CASE " +
  "FOR TO BY DO END_FOR WHILE END_WHILE REPEAT UNTIL END_REPEAT RETURN EXIT CONTINUE AND OR XOR " +
  "NOT MOD TRUE FALSE BOOL BYTE WORD DWORD LWORD INT DINT LINT UINT UDINT REAL LREAL STRING TIME").split(" "));
const stl = new Set(("A AN O ON X XN U UN AUF L T LC LAR1 LAR2 TAR1 TAR2 TAK PUSH POP " +
  "SET CLR NOT SAVE S R FP FN NOP CALL UC CC BE BEU BEC SPA SPB SPBN SPBB SPBNB SPBI SPBIN " +
  "JU JC JCN JCB JNB JBI JNBI LOOP NETWORK TITLE FUNCTION FUNCTION_BLOCK END_FUNCTION " +
  "END_FUNCTION_BLOCK VAR_INPUT VAR_OUTPUT VAR_IN_OUT VAR_TEMP END_VAR BEGIN").split(" "));

/** Lexical highlighting only; this does not compile or validate a PLC program. */
export function highlightSource(source: string, language: "SCL" | "STL"): string {
  const keywords = language === "SCL" ? scl : stl;
  const tokens = source.match(/\/\/[^\r\n]*|\(\*[\s\S]*?(?:\*\)|$)|'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|\b\d+#[\da-fA-F_]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b[A-Za-z_][A-Za-z_\d]*\b|[:=<>+*/-]+|[\s\S]/g) ?? [];
  return tokens.map((token) => {
    const kind = token.startsWith("//") || token.startsWith("(*") ? "comment"
      : token.startsWith("'") ? "string" : token.startsWith('"') ? "symbol"
      : /^\d/.test(token) ? "number" : keywords.has(token.toUpperCase()) ? "keyword"
      : /^[:=<>+*/-]+$/.test(token) ? "operator" : undefined;
    const safe = escapeHtml(token);
    return kind ? `<span class="${kind}">${safe}</span>` : safe;
  }).join("");
}
