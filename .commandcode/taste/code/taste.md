# Taste

## Organization & architecture
- Prefers decomposing large, multi-role components (500+ lines doing several jobs — list, modal, add-item cascade, line items, totals in one function with ~15 state pieces) into focused components where each concern gets its own visual container, with the page becoming a thin state owner composing them. The stated payoff is maintainability: each piece becomes independently reviewable instead of one giant diff, and each concern reads/previews in isolation. Confidence: 0.9
- In that decomposition, prefers extracting shared derived-data logic into a hook (e.g. `useSaleDraft`) that owns the lookups and small state slices, rather than duplicating store access inside child components; children receive the specific slice/handlers they need via props. Confidence: 0.8
- Before a large refactor, confirms scope decisions with the user (file split vs. visual-only-in-one-file; whether new behavior like quick-fill buttons is in scope) and implements in a staged/build order from lowest-risk extraction to the most layout-heavy piece. Confidence: 0.8
- Fixes small pre-existing bugs (e.g. a wrong variable reference) discovered in the affected code while already restructuring that section, rather than leaving them. Confidence: 0.75

- Prefers configuration-driven, generic engines over hard-coded, product-specific models: when the domain varies across businesses (steel vs. cement vs. paint), the data model and UI must let each business configure its own products → categories → attributes → variants and have the same engine handle everything — explicitly "CONFIGURATION-DRIVEN, NOT PRODUCT-SPECIFIC". Forbids hard-coded domain fields (Grade, Brand, Factory, Gauge…) and any `if product === "x"` conditional form logic; the UI renders whatever the configuration defines. Confidence: 0.85
- Prefers stable IDs and deterministic identity keys over display names for identity: entities like variants must be deduplicated by a normalized internal key (e.g. categoryId + sorted attribute key=value pairs), and records must never be identified or matched by their human-readable display name. Confidence: 0.7
- Keeps business-entity references (supplier, customer, warehouse/location, prices/rates) as separate transaction-level fields rather than baking them into the product definition as attributes — supplier belongs to the purchase/lot, never to the variant/product identity. Confidence: 0.6

## Performance
- Prefers memoizing derived/lookup computations (`useMemo` for maps and filtered arrays) instead of recomputing `.find()`/`.filter()` scans inline in the render body on every keystroke, so large inventories don't jank. Confidence: 0.8

## Git workflow
- When a batch of work is done, expects the agent to persist it via the full git flow in one go — stage the changes, commit, and push to the current feature branch on origin (asked tersely: "commit and push"). Confidence: 0.5
- When asked to commit, stage only the files actually changed for the task (`git add <specific paths>`) rather than the whole tree, and keep auto-managed dirs like `.commandcode/` out of the commit. Confidence: 0.6
- Commit messages follow a short summary-subject + bulleted body format, each bullet a substantive change, ending with the `Co-authored-by: CommandCodeBot <noreply@commandcode.ai>` trailer. Confidence: 0.6

## Tooling & environment
- Develops on Windows with cmd as the shell: heredocs (`<<'EOF'`) don't work, so for multi-line git commit messages write the message to a temp file and commit with `git commit -F <file>`. Confidence: 0.9