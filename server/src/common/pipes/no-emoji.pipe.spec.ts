import { BadRequestException } from "@nestjs/common";
import { findEmoji, NoEmojiPipe } from "./no-emoji.pipe";

describe("NoEmojiPipe", () => {
  const pipe = new NoEmojiPipe();
  const body = { type: "body" as const };

  it("finds emoji in nested fields and names the field", () => {
    expect(findEmoji({ name: "Ahmed Steel", lines: [{ note: "ok" }, { note: "fast \u{1F69A}" }] })).toBe("lines[1].note");
    expect(findEmoji({ city: "\u{1F1F5}\u{1F1F0} Lahore" })).toBe("city");
  });

  it("allows plain text, Urdu, (c), (R) and TM", () => {
    expect(findEmoji({ name: "سٹیل Traders™ © ®", qty: 5 })).toBeNull();
  });

  it("skips password and data-url fields", () => {
    expect(findEmoji({ password: "pass\u{1F600}word", logoDataUrl: "x\u{1F600}" })).toBeNull();
  });

  it("rejects a body with emoji and passes params through", () => {
    expect(() => pipe.transform({ name: "Cement \u{1F600}" }, body)).toThrow(BadRequestException);
    expect(pipe.transform("id\u{1F600}", { type: "param" })).toBe("id\u{1F600}");
    expect(pipe.transform({ name: "Cement" }, body)).toEqual({ name: "Cement" });
  });
});
