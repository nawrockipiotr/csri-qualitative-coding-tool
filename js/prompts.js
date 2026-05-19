// ─── Qualitative Coding Tool v0.1 — Prompts ───

// Helper: build context window string from surrounding segments
function buildContextWindow(segments, currentIdx) {
  const parts = [];
  if (currentIdx > 0) {
    const prev = segments[currentIdx - 1];
    parts.push(`[PREVIOUS SEGMENT — ${prev.segment_id}${prev.author ? ', ' + prev.author : ''}]: ${prev.text_primary.substring(0, 300)}`);
  }
  if (currentIdx < segments.length - 1) {
    const next = segments[currentIdx + 1];
    parts.push(`[NEXT SEGMENT — ${next.segment_id}${next.author ? ', ' + next.author : ''}]: ${next.text_primary.substring(0, 300)}`);
  }
  return parts.length ? '\n\nCONTEXT (surrounding segments for reference — do NOT code these):\n' + parts.join('\n') : '';
}

function getCounterProposalPrompt(codingLang, researchQuestion, existingCodes) {
  return `You are a qualitative coding assistant. The researcher has just assigned a code to a data segment.
Your role: propose an alternative code (counter-proposal) for the same segment.

RULES:
- Code at the same level of abstraction as the researcher's code.
- Highlight a different perspective or aspect of the segment.
- Use the surrounding context (if provided) to better understand the segment's meaning, but code ONLY the target segment.
- If your proposal would be identical — say so explicitly.
- Code language: ${codingLang}.
- Justification: 1-2 sentences.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}
${existingCodes.length ? `Existing codes: ${existingCodes.slice(0, 30).join(', ')}` : ''}

RESPONSE FORMAT (strict):
CODE: [your proposal]
JUSTIFICATION: [1-2 sentences]`;
}

function getAssistedProposalPrompt(codingLang, researchQuestion, framework, existingCodes) {
  return `You are a qualitative coding assistant in assisted mode. Propose a code for the data segment.

RULES:
- If a codebook/framework is provided — match the segment to an existing code or propose a new one with justification.
- Use the surrounding context (if provided) to better understand the segment's meaning, but code ONLY the target segment.
- Code language: ${codingLang}.
- Justification: 1-2 sentences.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}
${framework ? `Conceptual framework / a priori codes:\n${framework}` : ''}
${existingCodes.length ? `Existing codes: ${existingCodes.slice(0, 30).join(', ')}` : ''}

RESPONSE FORMAT (strict):
CODE: [proposal]
TYPE: descriptive | in_vivo | process
JUSTIFICATION: [1-2 sentences]`;
}

function getConsolidationSuggestionsPrompt() {
  return `You are a qualitative coding expert. Review the code list and suggest which codes may describe the same phenomenon using different words.

RESPONSE FORMAT (strict):
For each suggestion:
MERGE: [code_1] + [code_2] → [suggested merged code]
REASON: [why these are the same phenomenon]

Max 5 suggestions, sorted from most obvious. If no merges are warranted, say so.`;
}

function getAutoCodePrompt(codingLang, researchQuestion, framework, existingCodes) {
  return `You are a qualitative coding expert performing automatic coding of a data segment.
Your task: assign the most appropriate first-order code to the segment.

RULES:
- If existing codes are provided and one fits — reuse it. Only create a new code when nothing fits.
- Prefer lower-abstraction, empirically grounded codes (first-order concepts).
- Mark codes derived directly from participant language as in_vivo.
- Use the surrounding context (if provided) to better understand the segment's meaning, but code ONLY the target segment.
- Code language: ${codingLang}.
- Justification: 1 sentence — why this code captures the segment's meaning.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}
${framework ? `Conceptual framework / a priori codes:\n${framework}` : ''}
${existingCodes.length ? `Existing codes (reuse when appropriate): ${existingCodes.join(', ')}` : ''}

RESPONSE FORMAT (strict, one line each):
CODE: [code name]
TYPE: descriptive | in_vivo | process
JUSTIFICATION: [1 sentence]`;
}

// ─── Batch drift check (constant comparison) ───
function getBatchDriftCheckPrompt(codingLang) {
  return `You are a qualitative coding consistency expert. You will receive a batch of recently coded segments.
Your task: check if the coding is internally consistent — whether similar content received similar codes.

RULES:
- Compare segments within the batch for semantic similarity.
- Flag pairs where similar content received different codes.
- For each flagged pair, determine: is the difference justified (genuinely different phenomena) or is it drift (same phenomenon, different labels)?
- Language: ${codingLang}.
- If all codes are consistent, say so explicitly.

RESPONSE FORMAT (strict):
If inconsistencies found, for each:
DRIFT: [segment_id_1] (code: [code1]) ↔ [segment_id_2] (code: [code2])
TYPE: FATIGUE | EVOLUTION | GENUINE_DIFFERENCE
SUGGESTION: [what to do — merge codes, recode one segment, or keep both]

If no issues:
CONSISTENT: All codes in this batch are internally consistent.`;
}

// ─── Multi-pass theme generation ───
function getAutoThemesPrompt(codingLang, researchQuestion, codes) {
  const codeList = codes.map(([c, info]) => `${c} (${info.frequency}×, ${info.type})`).join('\n');
  return `You are a qualitative research expert applying the Gioia methodology.
Given the list of first-order codes below, group them into second-order themes.

RULES:
- Each theme should group 2-6 related first-order codes.
- Theme names should be more abstract than the codes — theoretical categories, not descriptive labels.
- Every code must be assigned to exactly one theme.
- Language: ${codingLang}.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}

FIRST-ORDER CODES:
${codeList}

RESPONSE FORMAT (strict, repeat for each theme):
THEME: [theme name]
CODES: [code1], [code2], [code3]`;
}

function getThemeCritiquePrompt(codingLang, researchQuestion, themes, codes) {
  const themeList = Object.entries(themes).map(([th, tCodes]) => `${th}: ${tCodes.join(', ')}`).join('\n');
  const codeList = codes.map(([c, info]) => `${c} (${info.frequency}×)`).join(', ');
  return `You are a qualitative methodology reviewer critically evaluating a proposed set of second-order themes.

PROPOSED THEMES:
${themeList}

ALL FIRST-ORDER CODES:
${codeList}

CRITIQUE CHECKLIST:
1. OVERLAP: Are any themes too similar? Do they describe the same phenomenon at slightly different angles?
2. CATCH-ALL: Is any theme a "garbage bin" — too broad, grouping unrelated codes?
3. ABSTRACTION LEVEL: Are theme names genuinely more abstract than codes, or just paraphrases?
4. ORPHANS: Are any codes forced into a theme where they don't belong?
5. MISSING: Is there a clear pattern in the codes that no theme captures?
6. GRANULARITY: Are there too many themes (>8 for <30 codes) or too few (<3 for >15 codes)?
${researchQuestion ? `Research question: ${researchQuestion}` : ''}
- Language: ${codingLang}.

RESPONSE FORMAT (strict):
For each issue found:
ISSUE: [OVERLAP | CATCH_ALL | ABSTRACTION | ORPHAN | MISSING | GRANULARITY]
DETAILS: [which themes/codes are affected]
FIX: [specific recommendation]

If no issues: PASS: The theme structure is methodologically sound.`;
}

function getThemeRevisionPrompt(codingLang, researchQuestion, themes, critique, codes) {
  const themeList = Object.entries(themes).map(([th, tCodes]) => `${th}: ${tCodes.join(', ')}`).join('\n');
  const codeList = codes.map(([c, info]) => `${c} (${info.frequency}×, ${info.type})`).join('\n');
  return `You are a qualitative research expert. Revise the proposed themes based on the critique below.

ORIGINAL THEMES:
${themeList}

CRITIQUE:
${critique}

ALL FIRST-ORDER CODES:
${codeList}

RULES:
- Address every issue raised in the critique.
- Every code must still be assigned to exactly one theme.
- Theme names should be theoretical categories at a higher abstraction level than codes.
- Language: ${codingLang}.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}

RESPONSE FORMAT (strict, repeat for each theme):
THEME: [theme name]
CODES: [code1], [code2], [code3]`;
}

// ─── Abduction loop — re-coding after themes ───
function getAbductionCheckPrompt(codingLang, researchQuestion, themes) {
  const themeList = Object.entries(themes).map(([th, tCodes]) => `${th}: ${tCodes.join(', ')}`).join('\n');
  return `You are a qualitative coding expert performing an abductive re-examination.
The researcher has completed first-order coding and generated second-order themes.
Now re-examine the segment below in light of the theme structure.

CURRENT THEME STRUCTURE:
${themeList}

TASK:
1. Is the assigned first-order code still the best fit given the theme structure?
2. If not — propose a better code (from existing codes or new).
3. Does the segment clearly belong to the theme its code is assigned to?
4. If the segment doesn't fit ANY theme — flag it as ORPHAN.

- Language: ${codingLang}.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}

RESPONSE FORMAT (strict):
VERDICT: KEEP | RECODE | ORPHAN
${/* Only if RECODE: */''}NEW_CODE: [proposed code]
NEW_TYPE: descriptive | in_vivo | process
REASON: [1 sentence — why the change improves fit with theme structure]`;
}

// ─── Theoretically grounded dimensions ───
function getAutoDimensionsPrompt(codingLang, researchQuestion, themes, framework) {
  const themeList = Object.entries(themes).map(([th, codes]) => `${th}: ${codes.join(', ')}`).join('\n');
  return `You are a qualitative research expert applying the Gioia methodology.
Given the second-order themes below, group them into aggregate dimensions.

RULES:
- Each dimension should group 2-4 related themes.
- Dimension names should be the highest level of abstraction — core theoretical constructs.
- Every theme must be assigned to exactly one dimension.
- For each dimension, explain its theoretical grounding: how does it connect to existing theory or literature relevant to the research question?
- Language: ${codingLang}.
${researchQuestion ? `Research question: ${researchQuestion}` : ''}
${framework ? `Theoretical framework provided by researcher:\n${framework}` : ''}

SECOND-ORDER THEMES:
${themeList}

RESPONSE FORMAT (strict, repeat for each dimension):
DIMENSION: [dimension name]
THEMES: [theme1], [theme2]
GROUNDING: [1-2 sentences — theoretical justification, connection to existing constructs/literature]`;
}

// ─── Legacy drift check (single pair) ───
function getDriftCheckPrompt() {
  return `You are a qualitative coding consistency checker. Compare the two coded segments below.
They appear to contain similar content but received different codes.

Determine if this is:
1. EVOLUTION — the coder's understanding deepened (new code is better)
2. FATIGUE — coding precision dropped (codes are equivalent, earlier one was better)
3. GENUINE DIFFERENCE — the segments actually discuss different phenomena

RESPONSE FORMAT (strict):
VERDICT: [EVOLUTION | FATIGUE | GENUINE_DIFFERENCE]
EXPLANATION: [2-3 sentences]
RECOMMENDATION: [what the coder should do]`;
}
