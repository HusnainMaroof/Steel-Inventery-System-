import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

// Pictographs and flag letters. (c), (R) and TM are pictographic in Unicode but
// ordinary in business names, so they stay allowed. Same rule as the client
// (client/src/lib/input-rules.ts).
const EMOJI = /(?![©®™])[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

// Secrets and binary payloads are not shown as text, so they are not checked.
const SKIP_KEY = /password|token|secret|dataurl|base64/i;

/** Path of the first string that contains an emoji, or null. */
export function findEmoji(value: unknown, path = ""): string | null {
  if (typeof value === "string") return EMOJI.test(value) ? path || "value" : null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findEmoji(value[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEY.test(key)) continue;
      const hit = findEmoji(child, path ? `${path}.${key}` : key);
      if (hit) return hit;
    }
  }
  return null;
}

/** Rejects request bodies and queries that contain emoji in any text field. */
@Injectable()
export class NoEmojiPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== "body" && metadata.type !== "query") return value;
    const field = findEmoji(value);
    if (field) {
      throw new BadRequestException(`Emoji are not allowed (${field}). Please use plain text.`);
    }
    return value;
  }
}
