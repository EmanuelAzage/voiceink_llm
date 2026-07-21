# Task: Audit and improve `docs/` as an OKF-conformant LLM-wiki knowledge base

You are auditing the knowledge base under `docs/` in this repository. Your job is to (1) bring it into conformance with the Open Knowledge Format (OKF v0.1), and (2) improve it as a living, agent-and-human-friendly knowledge base following the LLM-wiki pattern. Two reference files accompany this prompt:

- `okf-audit/REFERENCE.md` — condensed OKF spec + LLM-wiki pattern. This is your source of truth for the rules. Read it fully before doing anything else.
- `okf-audit/okf_lint.py` — a deterministic linter. Run it to find mechanical conformance issues; do not eyeball what the script can check.

Work in the repo's existing conventions. This repo already uses OKF-style frontmatter with a house schema (e.g. `type`, `title`, `description`, `status`, `tags`, `updated`/`timestamp`, `related`). **Preserve the house schema** — conform to OKF *around* it, don't flatten it to the bare spec. OKF explicitly allows producer extension fields, so `status` and `related` stay.

## Operating rules (read before editing)

1. **Audit before editing.** Do a full read-only pass first and produce the report described below. Do not change files until the report exists and (if a human is in the loop) is acknowledged.
2. **This is documentation, not a source-ingestion wiki.** These docs are authored (specs, plans, decisions), not synthesized from an immutable `sources/` corpus. Apply the LLM-wiki *structure and discipline* (index, log, cross-links, schema file, lint), not the ingest-from-raw-sources loop. Do not invent a `sources/` layer.
3. **Never fabricate.** If a doc's content is thin, ambiguous, or stale, flag it in the report — do not invent technical facts, dates, decisions, or history to fill gaps. Frontmatter you may infer (e.g. a `description` summarizing the existing body); body claims you may not.
4. **Preserve meaning.** Reorganizing, cross-linking, and fixing frontmatter must not change the technical substance of any doc. Rewording for clarity is fine; changing what a doc asserts is not.
5. **Small, reviewable commits.** One logical change per commit, conventional-commit style (`docs: …`). Never squash unrelated fixes together. If the repo uses a PR/branch flow, do the work on a branch.
6. **Respect reserved files.** `index.md` and `log.md` are reserved (see REFERENCE.md §Reserved files). They have special structure and (except a root `index.md`'s optional `okf_version`) carry no frontmatter.
7. **Ask, don't guess, on judgment calls.** Where a fix depends on intent you can't derive from the repo (is this doc deprecated or just stale? should these two docs merge?), list it as an open question rather than deciding unilaterally.

## Phase 1 — Audit (read-only)

Read `okf-audit/REFERENCE.md`, then run the linter:

```bash
python okf-audit/okf_lint.py docs/
```

Then read every file under `docs/` and assess it against both the OKF rules and the LLM-wiki quality bar. Produce a report at `okf-audit/AUDIT_REPORT.md` with these sections:

- **Summary** — doc count, how many are conformant, top 3 problems.
- **Conformance issues (mechanical)** — the linter's findings, plus anything it can't catch (e.g. a `type` that exists but is meaningless). Table: file · issue · severity · fix.
- **Structure & navigation** — Is there a root `index.md`? Does it list every concept with a one-line description? Is there a `log.md`? Are subdirectories (if any) indexed? Do the reserved files follow the required shape?
- **Cross-linking** — Which docs *should* link to each other but don't? Orphan pages (no inbound links)? Broken links? Concepts referenced in prose but lacking their own page?
- **Content quality (LLM-wiki lens)** — Stale claims, internal contradictions between docs, duplicated content that should be one canonical page, docs mixing multiple concepts that should split, missing `description`/`title`.
- **Schema consistency** — Is the house frontmatter schema applied uniformly? Field-name drift (`updated` vs `timestamp`), inconsistent `type` vocabulary, `tags` style, date formats.
- **Proposed changes** — Ordered, grouped into commits, each with a one-line rationale. Mark any that are lossy or judgment-dependent.
- **Open questions** — Anything requiring human intent. Do not proceed on these without an answer.

Stop after the report if a human is in the loop. Otherwise continue to Phase 2 for the non-judgment-dependent changes only.

## Phase 2 — Remediate (edit)

Apply changes in this order, committing after each group, re-running the linter after each group and confirming it's clean (or that remaining findings are intentional and logged):

1. **Frontmatter conformance.** Ensure every non-reserved `.md` has parseable YAML frontmatter with a non-empty, lowercase, meaningful `type`. Normalize house fields (consistent field names, ISO-8601 `timestamp`/`updated`, `tags` as a list, `related` as an array of concept paths). Refresh the `updated`/`timestamp` on any doc you change.
2. **Reserved files.** Create or fix the root `docs/index.md` (sectioned list of `* [Title](path) - description` per REFERENCE.md, only `okf_version` in frontmatter) and `docs/log.md` (`## YYYY-MM-DD` headings, newest first, bold convention words). Add `index.md` to any subdirectory that has multiple concepts. Append a log entry recording this audit.
3. **Cross-linking.** Add bundle-relative markdown links (`/path/concept.md`) where docs reference each other. Fix broken links. Leave a link to a not-yet-written concept only if you also note it in the report; don't invent the target.
4. **Schema/agent file.** Ensure `CLAUDE.md`/`AGENTS.md` (or the repo's schema file) describes the OKF conventions, the house fields, the reserved-file rules, and the maintenance loop (update the relevant doc + its timestamp in the same change; record notable events in `log.md`; run the linter). If absent, create it; if present, reconcile it with reality.
5. **Content fixes — only the safe ones.** Split a doc that clearly covers two concepts; merge exact duplicates; fix a description that misstates its own body. Anything requiring domain judgment stays in Open Questions.

## Definition of done

- `python okf-audit/okf_lint.py docs/` reports no errors (warnings may remain if deliberately accepted — note which in the log).
- Every concept doc has a meaningful `type` and a `description`; house schema applied uniformly.
- Root `index.md` lists every concept; `log.md` exists with an entry for this audit; subdirectories with multiple concepts are indexed.
- No orphan concepts except ones explicitly justified in the report.
- `AUDIT_REPORT.md` exists and its Open Questions are either resolved or clearly handed back to a human.
- No technical claim was invented; all lossy/judgment changes were surfaced, not silently made.
