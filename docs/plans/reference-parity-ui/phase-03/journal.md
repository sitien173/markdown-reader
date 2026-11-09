<!-- refract-shared-version: 3.0.0 -->

# Phase 3 Journal: Configurable render pipeline and Plugins tab

<!-- Created by the worker per worker-contract.md. Append every block; keep earlier sections. -->

## META

- Plan: docs/plans/reference-parity-ui/PLAN.md
- Implementation Profile: balanced
- Consultation Profile: n/a
- Review Profile: balanced
- Implementation Job: c301d160
- Review Job: be7e386b PASS_WITH_DEBT
- Started: 2026-11-09
- Finished: 2026-11-09T20:00:00+07:00

## Implementation Response

```text
# EXTERNAL RESPONSE
## META
- Phase 3 / Started 2026-11-09 / Finished 2026-11-09T20:00:00+07:00 / Plan dir docs/plans/reference-parity-ui
## SUMMARY
Phase 3 delivered the configurable render pipeline, local TOC and front matter rules, the ins and multi-markdown table plugins, plugin-keyed block caching, and the Plugins tab with a derived All plugins switch.
## FILES MODIFIED
| Action | Path | Change |
| Modified | package.json, pnpm-lock.yaml | Added markdown-it-ins and markdown-it-multimd-table |
| Modified | src/store/settings-store.ts | Echo guard, load and reset stale-state guards |
| Modified | src/ui/settings/general-tab.tsx | Language label and reset error display |
| Modified | src/i18n/en-US.ts | Strings for general and plugin rows |
| Modified | src/render/pipeline.ts | Config-driven parser LRU, pluginKey, config parameters |
| Created | src/render/local-rules.ts | TOC placeholder and front matter block rules |
| Modified | src/render/plugins.d.ts | Declarations for the two new plugins |
| Modified | src/render/sanitize.ts | Allow ins, colspan, rowspan |
| Modified | src/ui/markdown-view.tsx | pluginKey prop, key prefix, TOC fill |
| Modified | src/entrypoints/reader/App.tsx | Pass plugin config and key |
| Modified | src/ui/settings/plugins-tab.tsx | Plugin rows with derived All plugins |
| Created | tests/unit/local-rules.test.ts, tests/unit/pipeline-config.test.ts | New unit tests |
| Modified | tests/unit/reader-render.test.tsx, sanitize.test.ts, settings-panel.test.tsx, settings-store.test.ts | New cases |
| Created | tests/e2e/plugins.spec.ts | Plugins popup and reader e2e |
| Modified | tests/e2e/perf.spec.ts | S3 and S4 all-plugins tests |
| Created | tests/fixtures/large-100kb-toc.md, tests/fixtures/markdown/toc-plugins.md | Fixtures |
| Modified | docs/plans/reference-parity-ui/phase-03/notes.md, journal.md | Phase records |
## NOTES
- phase-03/notes.md  (## Task 0, ## Task 1, ## Task 2, ## Task 3, ## Task 4)
- Fresh checks: typecheck exit 0; lint exit 0 with 186 warnings; vitest 390/390; plugins.spec 3 passed and perf.spec 6 passed; test:e2e 107 passed.
## SPEC COMPLIANCE
- Meets Spec? WITH_DEBT: all Done When checks pass; the task 4 RED failure text was not retained, and one documented deviation patches markdown-it-multimd-table for markdown-it 15.
## CLARIFICATIONS NEEDED
None
## NEXT
TASK_COMPLETE
```

## Spec Review

Coordinator: PASS. Validation at fd625ec: typecheck 0, lint 0 (186 warnings), vitest 390/390, e2e 107 passed; S3 all-plugins TOC median 20.5 ms; S4 all-plugins first content 118 ms. multimd-table utils.assign shim accepted.

## Quality Review

# CODE QUALITY REVIEW
- Status: PASS_WITH_DEBT
- Findings:
  - non-blocking, src/store/settings-store.ts, 40, Chrome sends no onChanged event when a write leaves the stored value unchanged, so that write's pending entry stays for up to 2 s. If local state changes to Y in that window and another context writes back the earlier value X, the listener treats X as an echo and drops it. The store then shows Y while storage holds X. Fix: before calling `write`, compare `next` with the last value seen from storage or `readSettings`. If they are equal, skip the pending entry or skip the write.
  - non-blocking, src/ui/settings/plugins-tab.tsx, 33, `.catch(() => undefined)` hides storage-write failures. `update()` rolls the state back, so the switch reverts without any message. Fix: send the error to a `role="alert"` line, as general-tab now does for Reset. The same applies to line 16.
  - non-blocking, src/render/pipeline.ts, 251, Block keys get the config prefix twice: once in `planBlocks` and again as `keyPrefix` in `markdown-view.tsx:131`. The view also clears its cache whenever the plugin key changes, so one of the two is redundant. Fix: keep the `planBlocks` prefix so the cache cannot collide for any caller, and drop `keyPrefix` in the view. Or the reverse, but record which one owns the key.
  - non-blocking, tests/e2e/perf.spec.ts, 97, The logged value covers parser build plus the full render after the toggle, so parser build time is not reported on its own. Fix: wrap `createMarkdownIt` in `performance.mark`/`measure`, for example `md-parser-build`, and log that entry next to the paint time.
  - non-blocking, src/render/pipeline.ts, 61, The `utils.assign` shim for markdown-it-multimd-table 4.2.3 is undocumented outside notes.md and has no guard against an upstream change. Fix: add a unit test that builds a parser with `multimdTable` on and checks a colspan table renders, which pipeline-config.test.ts may already do. Add a `TODO` naming the package version, so the shim is removed when markdown-it-multimd-table supports markdown-it 15.
- Plan inconsistency, not a code defect: `insert`, `toc`, `frontMatter`, and `multimdTable` default to On, as DESIGN.md:142 specifies. So the default config matches the pre-plan parser only for documents without `++x++`, `[[TOC]]`, leading `---` front matter, or multimd syntax. `tests/unit/pipeline.test.ts` is unchanged and passes, so the invariant holds as tested. The plan owner should decide whether "reproduces pre-plan parser" needs rewording.
- Checklist results, all correct:
  - **Block keys:** `pluginKey` encodes all 18 flags, so every toggle changes every key.
  - **Reset on plugin change:** `cachedPluginKey` is in the reset condition, `parseState` is recreated, the cache and DOM are cleared, and `pluginKey` is in the paint effect deps.
  - **Same config on every path:** `planBlocks`, `planPrefix`, `render`, and the fallback all use the same config.
  - **TOC fill:** `fillToc` runs after the first chunk, after each progressive chunk, and after the prefix paint (lines 251, 269, 298). It uses `textContent`, and the prefixed `#user-content-` ids match the DOM.
  - **Sanitizer:** adds only `ins`, `colspan`, and `rowspan`. `caption` was already allowed. Tests confirm `style` and `on*` are blocked.
  - **Front matter:** matches only when `start === 0`, never in `env.partial` slices, and needs a closing fence. A leading thematic break followed by text falls through to `hr`. Reparse falls back to a full parse when the front matter boundary changes. The prefix render is extended to contain the whole block. Keys and values are escaped.
  - **Core table rule:** replaced only when `multimdTable` is on.
  - **Mermaid off:** the default fence renderer is used.
  - **Render signature:** the two-argument `render` still works, with a default config.
  - **Parser cache:** a four-entry LRU keyed by the stable flag string.
  - **Dependencies and network:** only `markdown-it-ins` and `markdown-it-multimd-table` were added, both pinned, and no new network request was found.
  - **Plugins tab:** All plugins is derived with `every`. The Breaks row binds `plugins.breaks`, and the row order matches DESIGN.
  - **Task-0, settings store:** the echo entry is now removed only when its echo arrives, with a 2 s fallback. The `splice` is guarded against -1. `load()` applies the stored value only if state is unchanged. `reset()` rolls back like `update()`. Each fix has a behavioral test, including an echo delivered after `set` resolves.
  - **Task-0, general tab:** the language label uses `t()`, and a Reset error shows in the alert.
  - **Test quality:** reader-render asserts that no block DOM node survives a toggle, plus TOC links, nesting, and hrefs.
- Scope checked: package.json, pnpm-lock.yaml (stat), src/render/{pipeline,local-rules,sanitize,plugins.d}.ts, src/ui/markdown-view.tsx, src/entrypoints/reader/App.tsx, src/store/settings-store.ts, src/ui/settings/{general-tab,plugins-tab}.tsx, src/i18n/en-US.ts (stat), tests/unit/{settings-store,reader-render}.test.ts*, tests/e2e/perf.spec.ts. Spot-checked against DESIGN.md and PLAN.md Phase 3. I did not read these line by line: tests/unit/{local-rules,pipeline-config,sanitize,settings-panel}.test.ts*, tests/e2e/plugins.spec.ts, and the fixtures.

## Review Result

- Spec Status: PASS
- Quality Status: PASS_WITH_DEBT
- Debt: be7e386b findings 1-5 (unchanged-write echo entry, plugins-tab silent catch, double key prefix, parser build time not isolated in perf, shim TODO and test). Owner: Phase 4 implementer task-0. Plan wording: default config differs from pre-plan parser only for the four new syntaxes, per user-confirmed Resolution 1; pipeline.test.ts unchanged and passing.

## Final Checkpoint

- Phase base ref: refs/plans/reference-parity-ui/phase-03/base
- Phase implementation ref: refs/plans/reference-parity-ui/phase-03/impl
- Plan commit ref: pending
- State checkpoint: temporary commit
