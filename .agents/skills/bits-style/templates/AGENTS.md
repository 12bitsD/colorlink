# Bits’s Coding Style

Version: v0.3.5.

Canonical documents: `STYLE.md` and `PROTOCOL.md` from https://github.com/12bitsD/bits-style.

## Workflow

1. Run `bits style report .` and classify violations, warnings, unsupported files and external contracts.
2. Fix high-confidence semantic issues first: dependency cycles, unreachable code, empty catch, real parameter reassignment, nested ternaries, real nesting and cyclomatic complexity.
3. Run the project’s formatter, type checks and real tests after every fix.
4. Use `bits style fix --diff --commit origin/main` for incremental formatting changes. It is restricted to deterministic whitespace changes.
5. Re-run the same scan and tests. Report remaining warnings and unsupported files explicitly.

## Guardrails

- Do not perform whole-repository mechanical rewrites to reach zero violations.
- Do not change external JSON, Pydantic, FFI, ABI or framework callback contracts to satisfy a rule.
- Do not split cohesive logic just to satisfy a line or variable threshold. `bits:explain(BCS003)` is a last resort, not the default fix.
- Use `bits:allow(rule): reason` only for real contracts or low-confidence cases, with a specific reason. No blanket suppressions.
- `unsupported` is not passed. `warning` is not a hard failure. Compile errors, formatter errors and real test failures remain hard failures.
- A task is complete only when the same scanner reports no new high-confidence violation, all project checks pass, and remaining warnings/unsupported items are reported honestly.
