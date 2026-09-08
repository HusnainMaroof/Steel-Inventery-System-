# Taste

## Organization & architecture
- Prefers decomposing large, multi-role components (500+ lines doing several jobs — list, modal, add-item cascade, line items, totals in one function with ~15 state pieces) into focused components where each concern gets its own visual container, with the page becoming a thin state owner composing them. The stated payoff is maintainability: each piece becomes independently reviewable instead of one giant diff, and each concern reads/previews in isolation. Confidence: 0.9
- In that decomposition, prefers extracting shared derived-data logic into a hook (e.g. `useSaleDraft`) that owns the lookups and small state slices, rather than duplicating store access inside child components; children receive the specific slice/handlers they need via props. Confidence: 0.8
- Before a large refactor, confirms scope decisions with the user (file split vs. visual-only-in-one-file; whether new behavior like quick-fill buttons is in scope) and implements in a staged/build order from lowest-risk extraction to the most layout-heavy piece. Confidence: 0.8
- Fixes small pre-existing bugs (e.g. a wrong variable reference) discovered in the affected code while already restructuring that section, rather than leaving them. Confidence: 0.75

## Performance
- Prefers memoizing derived/lookup computations (`useMemo` for maps and filtered arrays) instead of recomputing `.find()`/`.filter()` scans inline in the render body on every keystroke, so large inventories don't jank. Confidence: 0.8