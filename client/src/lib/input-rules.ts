/*
 * Shared text rules for form fields.
 * Emoji are not allowed in any stored text (names, notes, labels); the server
 * rejects them too (server/src/common/pipes/no-emoji.pipe.ts).
 */

// Pictographs and flag letters. (c), (R) and TM are pictographic in Unicode
// but ordinary in business names, so they stay allowed.
const EMOJI = /(?![©®™])[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const EMOJI_ALL = /(?![©®™])[\p{Extended_Pictographic}\p{Regional_Indicator}]|[‍️⃣]/gu;

export const hasEmoji = (text: string) => EMOJI.test(text);

/** Remove emoji and the joiner / variation marks that glue them together. */
export const stripEmoji = (text: string) => (hasEmoji(text) ? text.replace(EMOJI_ALL, "") : text);

/** characters a phone field accepts */
export const PHONE_CHARS = /^[0-9+\-() ]*$/;
export const stripNonPhone = (text: string) => text.replace(/[^0-9+\-() ]/g, "");

/** characters a type="number" field accepts while typing */
export const NUMBER_CHARS = /^[0-9.]*$/;
