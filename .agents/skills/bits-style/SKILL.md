---
name: bits-style
description: Apply Bits’s Coding Style safely in any repository. Use when adopting the style, reviewing or refactoring changed code, creating a baseline, enabling diff-only or CI checks, or using bits:allow/bits:explain without turning the checker into a full-repo mechanical rewrite.
---

# Bits’s Coding Style

Use Bits to find complex logic, not to manufacture more functions and state wrappers.

Canonical references:

- `STYLE.md` — rules and language profiles.
- `PROTOCOL.md` — scan, warning, violation, unsupported and output contracts.
- `docs/rust-support.md` — Rust’s current partial coverage.

## Non-goals

- Do not make Bits the only correctness gate. Keep the project’s compiler, formatter, linter and real tests.
- Do not rewrite the whole repository to reach zero violations.
- Do not treat `unsupported` as passed, or `warning` as a hard failure.
- Do not change public JSON, Pydantic, FFI, ABI, framework callback or other external naming contracts to satisfy a rule.

## Required inputs

Resolve these before acting:

- `bits` executable and its version. The current integration version is `v0.3.5`.
- Repository root and the Git revision used for comparisons, normally `origin/main`.
- Whether this is first adoption, incremental work, or CI hard-gate adoption.
- Existing language formatters and tests. Bits supplements them.

## Workflow

### 1. Establish the baseline safely

If `bits.toml` does not exist, copy `templates/bits.toml` and adjust only project-specific exclusions.

If `bits-baseline.json` does not exist, generate it once:

```bash
bits style report . --output bits-baseline.json
```

The baseline is a snapshot of existing diagnostics, not a blanket exemption. Update it deliberately after reviewing changes. New files never inherit baseline violations.

If the repository provides `AGENTS.md`, append the short integration section from `templates/AGENTS.md`; otherwise copy that file. Do not replace existing project instructions.

### 2. Inspect before changing code

```bash
bits style report . --format json --output bits-report.json
```

Group results in this order:

1. Parse errors and unsupported files.
2. High-confidence violations: dependency cycles, unreachable code, empty catch, real parameter reassignment, nested ternaries, real nesting and cyclomatic complexity.
3. Warnings: function size, parameter count, naming, comments, format and ambiguous semantics.
4. False-positive candidates and external contracts.

Do not treat every result as a refactoring instruction. If a result is uncertain, preserve behavior and record the uncertainty instead of “fixing” it.

### 3. Apply the smallest safe fix

For incremental work, use:

```bash
bits style fix --diff --commit <base-revision>
```

`fix` is restricted to deterministic whitespace and indentation changes. It does not perform structural refactoring and does not touch unchanged lines in diff mode.

For semantic violations, prefer the smallest change that removes the actual problem:

- Delete dead code and dependency cycles instead of adding abstraction.
- Replace nested control flow with a clearer sequence or data structure when that is simpler.
- Preserve resource lifetimes and ownership boundaries when splitting logic.
- Keep related stages together when moving them would add context objects or hidden state.

For `BCS003`, prefer splitting by responsibility only when that reduces cognitive load. Use `bits:explain(BCS003)` only when the function must remain cohesive:

```text
bits:explain(BCS003): <responsibility>; <why cohesion is required>; <splitting risk>
```

Use `bits:allow(<rule>): <reason>` only for a real contract or low-confidence case, with the rule id and a concrete reason. Do not add blanket suppressions.

### 4. Verify behavior and coverage

Run the same scan again, then the project’s tests, formatter and type checks. Confirm:

- No new high-confidence violation was introduced.
- No external contract was broken.
- No unsupported file was silently counted as covered.
- `coverage` and `unsupported` still mean what they say.
- The fix is idempotent: a second `bits style fix --diff --commit <base-revision>` produces no new diff.

Report violations and warnings separately. A clean `bits style check` does not prove the whole repository is simple or correct.

## Adoption modes

### Agent-only review

Use `bits style report` as input to focused review. Do not make it a hard gate yet.

### Incremental gate

```bash
bits style check --diff --commit <base-revision>
```

Existing code uses the baseline; new and changed lines must satisfy the high-confidence rules. Keep warnings as review input.

### Full gate

Enable only after the project has verified its fixtures and false-positive rate:

```bash
bits style check .
```

Start with high-confidence violations. Do not require the entire repository to be warning-free.

## Agent completion contract

A change is complete only when all are true:

- The requested fix is implemented without changing external contracts.
- The same scanner reports no new high-confidence violation.
- Project tests, formatter and type checks pass.
- The report identifies remaining warnings, unsupported files and low-confidence items explicitly.
- No exemption or explanation was added merely to avoid a useful refactor.

If any of these is not true, the task is not complete; report the remaining blocker instead of declaring success.

## Command reference

```bash
bits style report . --format json --output bits-report.json
bits style check --diff --commit origin/main
bits style fix --diff --commit origin/main
bits style check --baseline bits-baseline.json
bits style report src --format sarif
```

`--commit` accepts a SHA, branch, tag or `HEAD~n`. `check` returns 1 for violations, 2 for scan/unsupported errors, and 0 for no violations or warnings. `report` returns 0 after producing a report, including reports containing violations or unsupported files.
