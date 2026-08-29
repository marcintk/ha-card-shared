---
name: improve-it
description: Scan the codebase for deepening opportunities — shallow modules whose interface is nearly as complex as their implementation — and present them as a ranked markdown report, then grill through the one you pick. Run from ship-it, or directly with "/improve-it".
disable-model-invocation: true
---

# Improve-It

**Invocation:** HUMAN.

Surface architectural friction and propose **deepening opportunities**: refactors that turn a
shallow module into a deep one. The aim is testability and AI-navigability. One-shot report;
applies nothing.

## Vocabulary

Use these words exactly — not "component", "service", "API", "boundary".

- **Module** — anything with an interface and an implementation: a function, class, package, or
  tier-spanning slice.
- **Interface** — everything a caller must know to use it right: signature, invariants,
  ordering, error modes, config, performance.
- **Implementation** — what's inside.
- **Depth** — behaviour per unit of interface. **Deep** = a lot of behaviour behind a small
  interface. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — a place you can change behaviour without editing there; where the interface lives.
  Where to put it is a separate decision from what goes behind it.
- **Adapter** — a concrete thing satisfying an interface at a seam (a real impl, or an
  in-memory fake).

## 1. Scope before you scan (YAGNI)

Deepening pays off where change is frequent. Decide _where_ to look first:

- User named a module / subsystem / pain point → take it, skip the inference.
- Otherwise walk `git log --oneline` back a good stretch for the hot spots — files and areas
  that keep recurring — and let those pull your attention. Scattered with no hot spot → widen.

## 2. Find the shallow modules

Explore organically (a `pipeline-explore` subagent is fine). Note where you feel friction:

- Understanding one concept means bouncing between many small modules.
- Interface ≈ implementation in complexity.
- Pure functions extracted only for testability, while the real bugs hide in how they're
  called (no locality).
- Tightly-coupled modules leaking across their seam.
- Parts untested, or hard to test through the current interface.

Apply the **deletion test** to each suspect: would deleting it _concentrate_ complexity, or
just _move_ it? "Concentrates" is the signal.

## 3. Report

Write a plain-markdown report (no HTML, no CDN). For each candidate:

- **Files** — what's involved.
- **Problem** — why the current shape causes friction.
- **Solution** — plain English: what changes.
- **Benefit** — in terms of locality, leverage, and how tests improve.
- **Strength** — `Strong` | `Worth exploring` | `Speculative`.

End with a **Tackle first** pick and why. Do not design interfaces yet.

## 4. Grill

Once the human picks a candidate, run `brainstorm-it` on it — constraints, dependencies, the
shape of the deepened module, what sits behind the seam, which tests survive. Decisions are the
human's; look up facts yourself.
