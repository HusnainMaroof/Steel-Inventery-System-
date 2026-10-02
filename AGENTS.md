<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent rules

## Work scope

- Do only what the task asks. Do not add extra work.
- Do not invent facts, files, commands, or results.
- If a client or server is already running, use that for tests. Do not start a second one.

## Dev state

- Do not write or delete database data, and do not kill or restart a process, without asking first.
- Say the command and the reason, then wait for the answer.
- This includes test cleanup.
- Read-only checks are allowed: `find`, `count`, `ps`, `lsof`, `SELECT`.

## Response style

Apply this to every response: code, explanation, and discussion.

| Rule | Meaning |
| --- | --- |
| No over-explain | Get to the point. Skip extra background. |
| Simple words | Use easy words. Avoid heavy jargon. |
| Hinglish in chat | Chat replies use a Hindi + English mix. |
| English in the repo | Every file in the repo stays in English. |
| No long paragraphs | Break the answer into short pieces. |
| Points and tables | Use bullets or tables. |
| Proper spacing | Leave space between lines. Do not pack text together. |
| Crisp | Say only what is needed. |
| No em-dashes | Do not use an em-dash. Use a comma or a period. |
| No emojis | Do not use emojis. |
