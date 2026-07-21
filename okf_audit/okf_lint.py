#!/usr/bin/env python3
"""okf_lint.py — a small, dependency-free linter for OKF v0.1 bundles.

Checks the OKF conformance surface (errors) and the recommended-but-optional
conventions the LLM-wiki quality bar cares about (warnings). Pure stdlib: a
minimal frontmatter/YAML-subset parser, no pip installs.

Usage:
    python okf_lint.py docs/
    python okf_lint.py docs/ --json
    python okf_lint.py docs/ --strict   # exit non-zero on warnings too

Exit codes: 0 = clean (no errors), 1 = errors found, 2 = bad invocation.

Scope note: this validates the *format*. It cannot judge whether a `type` is
meaningful, whether content is stale, or whether two docs duplicate a concept —
those are for the human/agent reading pass, not the linter.
"""

import argparse
import json
import os
import re
import sys

RESERVED = {"index.md", "log.md"}
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$")
DATE_HEADING_RE = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})\b")
MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


class Finding:
    def __init__(self, path, level, code, msg):
        self.path, self.level, self.code, self.msg = path, level, code, msg

    def as_dict(self):
        return {"path": self.path, "level": self.level, "code": self.code, "message": self.msg}


def split_frontmatter(text):
    """Return (frontmatter_str_or_None, body_str). Frontmatter must open on line 1."""
    if not text.startswith("---"):
        return None, text
    lines = text.splitlines(keepends=True)
    if lines[0].strip() != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "".join(lines[1:i]), "".join(lines[i + 1:])
    return None, text  # opened but never closed


def parse_frontmatter(fm):
    """Parse the tiny YAML subset used in OKF frontmatter.

    Supports: `key: scalar`, `key: [a, b]` inline lists, and block lists via
    subsequent `  - item` lines. Enough to validate structure; not a full YAML
    engine. Returns (dict, errors[]). Values are strings or lists.
    """
    data, errors = {}, []
    lines = fm.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        if not raw.strip() or raw.strip().startswith("#"):
            i += 1
            continue
        if raw.startswith((" ", "\t")) and ":" not in raw:
            i += 1  # continuation/list item handled by its key
            continue
        m = re.match(r"^([A-Za-z0-9_\-]+):\s*(.*)$", raw)
        if not m:
            errors.append(f"unparseable frontmatter line: {raw.strip()!r}")
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val == "":
            # possible block list
            items = []
            j = i + 1
            while j < len(lines) and re.match(r"^\s*-\s+", lines[j]):
                items.append(re.sub(r"^\s*-\s+", "", lines[j]).strip().strip("'\""))
                j += 1
            data[key] = items if items else ""
            i = j
        elif val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            data[key] = [x.strip().strip("'\"") for x in inner.split(",") if x.strip()] if inner else []
            i += 1
        else:
            data[key] = val.strip().strip("'\"")
            i += 1
    return data, errors


def lint_concept(relpath, text, findings):
    fm, body = split_frontmatter(text)
    if fm is None:
        if text.startswith("---"):
            findings.append(Finding(relpath, "error", "FM_UNCLOSED",
                                    "frontmatter block opens with '---' but is never closed"))
        else:
            findings.append(Finding(relpath, "error", "FM_MISSING",
                                    "concept document has no YAML frontmatter block"))
        return
    data, perrs = parse_frontmatter(fm)
    for e in perrs:
        findings.append(Finding(relpath, "error", "FM_PARSE", e))

    # ERROR: type required and non-empty (the one hard OKF rule for concepts)
    t = data.get("type")
    if t is None:
        findings.append(Finding(relpath, "error", "TYPE_MISSING", "required field 'type' is absent"))
    elif isinstance(t, list) or not str(t).strip():
        findings.append(Finding(relpath, "error", "TYPE_EMPTY", "field 'type' is empty"))
    else:
        if str(t) != str(t).lower():
            findings.append(Finding(relpath, "warn", "TYPE_CASE",
                                    f"'type: {t}' is not lowercase (house convention favors lowercase types)"))

    # WARNINGS: recommended fields + hygiene
    if "title" not in data:
        findings.append(Finding(relpath, "warn", "NO_TITLE", "recommended field 'title' missing"))
    if "description" not in data or (isinstance(data.get("description"), str) and not data["description"].strip()):
        findings.append(Finding(relpath, "warn", "NO_DESC", "recommended field 'description' missing/empty"))

    if "tags" in data and not isinstance(data["tags"], list):
        findings.append(Finding(relpath, "warn", "TAGS_SCALAR", "'tags' should be a YAML list, not a scalar"))

    for tkey in ("timestamp", "updated"):
        if tkey in data and isinstance(data[tkey], str) and data[tkey]:
            if not ISO_RE.match(data[tkey]):
                findings.append(Finding(relpath, "warn", "BAD_TIMESTAMP",
                                        f"'{tkey}: {data[tkey]}' is not ISO-8601"))

    return data


def lint_index(relpath, text, findings, is_root):
    fm, body = split_frontmatter(text)
    if fm is not None:
        data, _ = parse_frontmatter(fm)
        allowed = {"okf_version"} if is_root else set()
        extra = set(data.keys()) - allowed
        if extra:
            findings.append(Finding(relpath, "error", "INDEX_FRONTMATTER",
                                    f"index.md must not carry frontmatter"
                                    + (" other than okf_version" if is_root else "")
                                    + f"; found: {', '.join(sorted(extra))}"))
    else:
        body = text
    has_section = any(l.lstrip().startswith("#") for l in body.splitlines())
    has_bullet = any(re.match(r"^\s*[*\-]\s+", l) for l in body.splitlines())
    if not (has_section and has_bullet):
        findings.append(Finding(relpath, "warn", "INDEX_SHAPE",
                                "index.md should have #-headed section(s) with bullet lists of links"))


def lint_log(relpath, text, findings):
    fm, _ = split_frontmatter(text)
    if fm is not None:
        findings.append(Finding(relpath, "error", "LOG_FRONTMATTER", "log.md must not carry frontmatter"))
    dates = [DATE_HEADING_RE.match(l).group(1) for l in text.splitlines() if DATE_HEADING_RE.match(l)]
    if not dates:
        findings.append(Finding(relpath, "warn", "LOG_SHAPE",
                                "log.md should use '## YYYY-MM-DD' date headings"))
    else:
        if dates != sorted(dates, reverse=True):
            findings.append(Finding(relpath, "warn", "LOG_ORDER", "log entries should be newest-first"))


def collect_link_targets(bundle_root, relpath, text, all_files, findings):
    """Warn on broken bundle-relative / relative links to other .md concepts."""
    _, body = split_frontmatter(text)
    body = body if body else text
    curdir = os.path.dirname(relpath)
    for m in MD_LINK_RE.finditer(body):
        target = m.group(1).split("#")[0].strip()
        if not target or target.startswith(("http://", "https://", "mailto:")):
            continue
        if not target.endswith(".md"):
            continue
        if target.startswith("/"):
            resolved = target.lstrip("/")
        else:
            resolved = os.path.normpath(os.path.join(curdir, target))
        if resolved not in all_files:
            findings.append(Finding(relpath, "warn", "BROKEN_LINK",
                                    f"link target not found in bundle: {target}"))


def lint_bundle(root):
    findings = []
    md_files = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if fn.endswith(".md"):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root)
                md_files.append(rel.replace(os.sep, "/"))
    fileset = set(md_files)

    if not md_files:
        findings.append(Finding(".", "error", "EMPTY", f"no .md files found under {root}"))
        return findings, md_files

    root_index_present = "index.md" in fileset
    if not root_index_present:
        findings.append(Finding("index.md", "warn", "NO_ROOT_INDEX",
                                "no root index.md (recommended entry point for progressive disclosure)"))

    # inbound-link tracking for orphan detection
    inbound = {f: 0 for f in md_files if os.path.basename(f) not in RESERVED}

    for rel in sorted(md_files):
        with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        base = os.path.basename(rel)
        if base == "index.md":
            lint_index(rel, text, findings, is_root=(rel == "index.md"))
        elif base == "log.md":
            lint_log(rel, text, findings)
        else:
            lint_concept(rel, text, findings)
        collect_link_targets(root, rel, text, fileset, findings)

        # tally inbound links
        _, body = split_frontmatter(text)
        body = body if body else text
        curdir = os.path.dirname(rel)
        for m in MD_LINK_RE.finditer(body):
            tgt = m.group(1).split("#")[0].strip()
            if not tgt or tgt.startswith(("http", "mailto:")) or not tgt.endswith(".md"):
                continue
            resolved = tgt.lstrip("/") if tgt.startswith("/") else os.path.normpath(os.path.join(curdir, tgt)).replace(os.sep, "/")
            if resolved in inbound and resolved != rel:
                inbound[resolved] += 1

    for f, n in sorted(inbound.items()):
        if n == 0:
            findings.append(Finding(f, "warn", "ORPHAN",
                                    "no inbound links from other concepts (consider linking it from index or a related doc)"))
    return findings, md_files


def main():
    ap = argparse.ArgumentParser(description="Lint an OKF v0.1 bundle.")
    ap.add_argument("path", help="bundle directory (e.g. docs/)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--strict", action="store_true", help="exit non-zero on warnings too")
    args = ap.parse_args()

    if not os.path.isdir(args.path):
        print(f"error: {args.path} is not a directory", file=sys.stderr)
        sys.exit(2)

    findings, md_files = lint_bundle(args.path)
    errors = [f for f in findings if f.level == "error"]
    warns = [f for f in findings if f.level == "warn"]

    if args.json:
        print(json.dumps({
            "bundle": args.path,
            "files_checked": len(md_files),
            "errors": len(errors),
            "warnings": len(warns),
            "findings": [f.as_dict() for f in findings],
        }, indent=2))
    else:
        for f in sorted(findings, key=lambda x: (x.path, x.level != "error", x.code)):
            print(f"{f.level.upper():5} {f.code:16} {f.path}: {f.msg}")
        print(f"\n{len(md_files)} files · {len(errors)} error(s) · {len(warns)} warning(s)")
        if not errors:
            print("OKF v0.1 conformance: PASS" + (" (warnings present)" if warns else ""))
        else:
            print("OKF v0.1 conformance: FAIL")

    sys.exit(1 if errors or (args.strict and warns) else 0)


if __name__ == "__main__":
    main()
