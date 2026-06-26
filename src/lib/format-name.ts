// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Name formatting helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Defensive title-casing for customer / staff names — used at every site
// that embeds a person's name into user-facing copy (notification bodies,
// toasts, activity feeds, etc.) so a name typed in as "sophia lee" still
// renders as "Sophia Lee" without the admin having to manually fix it.
//
// Why: customer create / edit forms only `.trim()` the inputs — they don't
// title-case. Future-proofing here means we don't have to backfill every
// existing record if/when we tighten input validation later.

/** Title-case a single word, preserving in-word punctuation:
 *    "sophia"      → "Sophia"
 *    "MARIA"       → "Maria"
 *    "o'brien"     → "O'Brien"
 *    "al-sayed"    → "Al-Sayed"
 *    "mary-jane"   → "Mary-Jane"
 *
 *  Empty / falsy inputs round-trip unchanged. */
function titleCaseWord(word: string): string {
    if (!word) return word;
    // Capitalize letters that follow word-start, an apostrophe, or a hyphen.
    // Letters elsewhere lowercase. Numbers / other punctuation pass through.
    return word
        .toLowerCase()
        .replace(/(^|['-])([a-z])/g, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

/** Title-case a full name string. Splits on any whitespace, normalises
 *  runs of spaces, then title-cases each token individually so multi-part
 *  names ("mary-jane o'brien al-sayed") read correctly.
 *
 *  Pass-through cases:
 *   • Empty / whitespace-only input → returns the input as-is (caller may
 *     want to render an empty string verbatim).
 *   • Names that already mix case (e.g. "McDonald") → re-titlecased per
 *     this helper's rules; consumers that need to preserve unusual
 *     capitalisations should skip this helper for that record. */
export function capitalizeName(name: string | undefined | null): string {
    if (!name) return name ?? "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed
        .split(/\s+/)
        .map(titleCaseWord)
        .join(" ");
}
