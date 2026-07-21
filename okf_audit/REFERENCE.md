# Reference: OKF v0.1 + the LLM-wiki pattern (condensed)

This is a working condensation for the audit. If anything here is ambiguous, the authoritative sources below win.

**Primary (the rules):**
- OKF spec (v0.1): https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
- LLM-wiki pattern — Karpathy gist (the workflow this format formalizes): https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

**Context & background:**
- OKF announcement (Google Cloud blog, the "why"): https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing
- OKF repo root (spec + reference agent + HTML visualizer + sample bundles): https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf

**Tooling (independent implementations, useful for comparison or reuse):**
- okf-lint — community linter (ESLint-style, conformance checks): https://github.com/thisismydesign/okf-lint
- okf-gem — Ruby toolkit: agent skill + CLI + local graph server: https://github.com/serradura/okf-gem
- awesome-llm-wiki — curated index of LLM-wiki implementations and writeups: https://github.com/gavischneider/awesome-llm-wiki

Note: the community tooling above is not required to run this audit — `okf_lint.py` in this folder is self-contained. They're listed in case you later want a second linter's opinion, a graph visualizer, or reference implementations of the ingest/maintain loop.

## Part A — What each thing is (don't conflate them)

- **OKF is a file format.** It standardizes the small set of structural conventions that make a directory of markdown self-describing and portable across tools: frontmatter fields, reserved filenames, cross-link rules, conformance criteria. It does *not* prescribe a workflow.
- **The LLM-wiki pattern is a workflow.** It's a practice for building/maintaining a knowledge base with an agent: three layers (raw sources → maintained wiki → a schema/agent file), three operations (ingest, query, lint), and two navigation files (`index.md`, `log.md`). It's deliberately loose about file specifics.
- **They compose.** OKF formalizes the file shape the pattern uses. You can follow the pattern's discipline while writing OKF-conformant files.

**Important scoping note for this repo:** these `docs/` are *authored documentation* (specs, plans, decisions), not a synthesis of an immutable external-source corpus. So apply the pattern's *structure and discipline* (index, log, cross-links, schema file, periodic lint) but NOT the ingest-from-raw-sources loop. There is no `sources/` layer to build here; do not invent one.

## Part B — OKF v0.1 rules (the conformance surface)

### Bundle = a directory of markdown files
Each non-reserved `.md` file is one **concept**. Its **concept ID** is its path minus `.md` (e.g. `plans/android-mvp.md` → `plans/android-mvp`). Directory structure is producer's choice.

### Concept documents
Two parts: a YAML **frontmatter** block delimited by `---` lines, then a markdown **body**.

Frontmatter fields:
- `type` — **REQUIRED.** Short string identifying the kind of concept (e.g. `spec`, `plan`, `estimate`, `decision-log`, `reference`). Not centrally registered; producers pick descriptive values; consumers must tolerate unknown types. This is the ONE hard requirement.
- `title` — recommended. Human-readable display name; consumers may derive from filename if absent.
- `description` — recommended. One-sentence summary; used in index listings, search snippets, previews.
- `resource` — optional. Canonical URI of the underlying asset (absent for abstract concepts).
- `tags` — optional. YAML **list** of short strings.
- `timestamp` — optional. ISO-8601 datetime of last meaningful change.
- **Extensions** — producers MAY add any other keys; consumers MUST preserve unknown keys and MUST NOT reject documents for having them. (This is what legitimizes house fields like `status` and `related`.)

Body: standard markdown. Favor structural markdown (headings, lists, tables, code blocks) over prose. No required sections. Conventional headings when applicable: `# Schema`, `# Examples`, `# Citations`.

### Reserved files (special structure, MUST NOT be used as concept names)
- **`index.md`** — directory listing for progressive disclosure. **No frontmatter**, except a *bundle-root* `index.md` MAY carry only `okf_version: "0.1"`. Body is one or more `#`-headed sections, each a bullet list of `* [Title](relative-link) - short description`. Entries should reuse the linked concept's `description`. May appear at any directory level.
- **`log.md`** — chronological change history, newest first. **No frontmatter.** `## YYYY-MM-DD` date headings (ISO form required); bullets under each; a leading bold convention word (`**Update**`, `**Creation**`, `**Deprecation**`, `**Decision**`) is conventional, not required. May appear at any level.

### Cross-linking
Standard markdown links between concepts. **Bundle-relative** links starting `/` (interpreted from bundle root) are recommended because they survive file moves; relative `./x.md` links also allowed. A link asserts an untyped relationship; the *kind* of relationship is conveyed by surrounding prose, not the link. Consumers MUST tolerate broken links (a link to a not-yet-written concept is valid).

### Conformance (v0.1)
A bundle conforms iff:
1. Every non-reserved `.md` has a parseable YAML frontmatter block.
2. Every such block has a non-empty `type`.
3. Reserved files, when present, follow the index/log structure above.

Consumers MUST NOT reject a bundle for: missing optional fields, unknown `type` values, unknown extra frontmatter keys, broken cross-links, or missing `index.md`. (So most of the audit's "improvements" are quality, not conformance — only 1–3 above are hard.)

### Versioning
A bundle MAY declare its version via `okf_version: "0.1"` in the root `index.md` frontmatter (the only place frontmatter is allowed in an index).

## Part C — LLM-wiki quality bar (what "good" looks like beyond conformance)

Conformance is the floor. A *good* knowledge base also has:

- **A real index.** The root `index.md` is the map: every concept listed once, grouped sensibly, each with a one-line hook. An agent reads it first to decide where to go, so it must be complete and current.
- **A schema/agent file** (`CLAUDE.md`/`AGENTS.md`/`SKILL.md`) that encodes the conventions and the maintenance loop — the single most load-bearing file. It's what makes an agent a disciplined maintainer instead of a generic editor. It should state the house frontmatter fields, the reserved-file rules, and the "update the doc + its timestamp in the same change; log notable events; run the linter" loop.
- **Cross-references that actually exist.** The value compounds when related concepts link to each other. Orphan pages (no inbound links) and concepts mentioned-but-not-written are the visible symptoms of a thin graph.
- **One canonical page per concept.** Duplicated/overlapping content is the main rot vector. A doc covering two distinct concepts should split; two docs covering one should merge.
- **Freshness signals that don't lie.** `timestamp`/`updated` reflects the last real change; `status` (a house field) tells readers whether a doc is current, draft, or deprecated. Staleness is best solved by *not promising currency* on docs that are really append-only history — distinguish living surface docs from historical/log content.
- **Lint as a habit, not a one-off.** Periodically re-run the linter and re-check for contradictions, orphans, stale claims, and missing cross-refs. Drift (the agent under-updating cross-references) is the #1 failure mode reported by teams running this pattern at scale; the lint pass is what contains it.

## Part D — Common issues this audit should catch

- A concept doc missing `type`, or with a `type` that's empty/placeholder/meaningless.
- Field-name drift across docs (`updated` in some, `timestamp` in others; `tag:` scalar instead of `tags:` list).
- `index.md`/`log.md` carrying full frontmatter (only root index may, and only `okf_version`).
- An index that's missing concepts, or whose descriptions have drifted from the concepts' own.
- Orphan concepts; prose that names a concept that has no page; broken links.
- Two docs that duplicate a definition, or one doc that's really two concepts.
- `status`/`timestamp` that contradict the body (doc says "planned" but describes shipped work).
- A schema/agent file that describes conventions the docs no longer follow.
