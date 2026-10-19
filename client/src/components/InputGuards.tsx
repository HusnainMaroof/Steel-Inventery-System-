"use client";

import { useEffect } from "react";
import { hasEmoji, NUMBER_CHARS, PHONE_CHARS, stripEmoji, stripNonPhone } from "@/lib/input-rules";

const TEXT_TYPES = new Set(["text", "search", "email", "url", ""]);

type Field = HTMLInputElement | HTMLTextAreaElement;

function fieldOf(target: EventTarget | null): Field | null {
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement) return target;
  return null;
}

const isNumber = (el: Field) => el instanceof HTMLInputElement && el.type === "number";
const isPhone = (el: Field) => el instanceof HTMLInputElement && el.type === "tel";
const isText = (el: Field) => el instanceof HTMLTextAreaElement || TEXT_TYPES.has(el.type);

/** Set a value on a React-controlled field so React sees the change. */
function setFieldValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Insert text at the caret like a normal paste (React-friendly). */
function insertText(text: string) {
  if (text) document.execCommand("insertText", false, text);
}

/**
 * App-wide input rules, mounted once:
 * - no emoji in text fields (typed, picked from the emoji panel, or pasted)
 * - number fields take digits and a point only (no e, +, - or letters)
 * - phone fields take digits, spaces and + - ( ) only
 * Password fields are left alone.
 */
export function InputGuards() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = fieldOf(event.target);
      if (el && isNumber(el) && ["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
    };

    const onBeforeInput = (event: InputEvent) => {
      const el = fieldOf(event.target);
      if (!el) return;
      const data = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
      if (!data) return;
      if (isNumber(el)) {
        if (!NUMBER_CHARS.test(data)) event.preventDefault();
      } else if (isPhone(el)) {
        if (!PHONE_CHARS.test(data)) event.preventDefault();
      } else if (isText(el) && hasEmoji(data)) {
        event.preventDefault();
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      const el = fieldOf(event.target);
      const text = event.clipboardData?.getData("text/plain");
      if (!el || !text) return;
      let clean = text;
      if (isNumber(el)) clean = text.replace(/[^0-9.]/g, "");
      else if (isPhone(el)) clean = stripNonPhone(text);
      else if (isText(el)) clean = stripEmoji(text);
      if (clean === text) return;
      event.preventDefault();
      insertText(clean);
    };

    // Fallback for keyboards that skip beforeinput data (some phones, IME).
    const onInput = (event: Event) => {
      const el = fieldOf(event.target);
      if (!el) return;
      if (isPhone(el)) {
        if (!PHONE_CHARS.test(el.value)) setFieldValue(el, stripNonPhone(el.value));
      } else if (isText(el) && hasEmoji(el.value)) {
        setFieldValue(el, stripEmoji(el.value));
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("input", onInput, true);
    };
  }, []);
  return null;
}
