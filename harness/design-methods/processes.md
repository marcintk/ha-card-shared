# Processes — the playbooks

Three procedures `design-it` runs. Each assumes the [glossary](glossary.md), the principles in
[design.md](design.md), and the checks in [discipline.md](discipline.md).

## Scanning for candidates

`design-it` with no issue number runs this: find a deepening opportunity worth filing, file it,
then design it. Surface architectural friction — shallow modules whose interface is nearly as
complex as their implementation. Changes nothing until the issue is filed.

### 1. Scope before you scan (YAGNI)

Deepening pays off where change is frequent. Decide _where_ to look first:

- User named a module / subsystem / pain point → take it, skip the inference.
- Otherwise walk `git log --oneline` back a good stretch for the hot spots — files and areas
  that keep recurring — and let those pull your attention. Scattered, no hot spot → widen.

### 2. Find the shallow modules

Explore organically (an `explorer` subagent is fine). Note where you feel friction:

- Understanding one concept means bouncing between many small modules.
- Interface ≈ implementation in complexity.
- Pure functions extracted only for testability, while the real bugs hide in how they're
  called (no locality).
- Tightly-coupled modules leaking across their seam.
- Parts untested, or hard to test through the current interface.

Run each suspect through the [deletion test](discipline.md#the-deletion-test) and the
[red flags](discipline.md#red-flags). "Complexity concentrates when I delete it" is the signal
to keep it on the list.

### 3. Ranked report

Plain markdown (no HTML, no CDN). For each candidate:

- **Files** — what's involved.
- **Problem** — why the current shape causes friction, in the vocabulary of
  [design.md](design.md) (leakage, pass-through, offloaded decision…).
- **Solution** — plain English: what changes.
- **Benefit** — in terms of locality, leverage, and how tests improve.
- **Strength** — `Strong` | `Worth exploring` | `Speculative`.

End with a **Tackle first** pick and why. Don't design interfaces yet — the human picks one,
`design-it` files the issue (`gh issue create`, title + body from the pick) and takes over from
its Step 2.

## Deepening a cluster given its dependencies

How to deepen a cluster of shallow modules safely. The dependency category decides how the
deepened module is tested across its seam.

### Dependency categories

**1. In-process** — pure computation, in-memory state, no I/O. Always deepenable — merge the modules and test through the new interface directly. No adapter needed.

**2. Local-substitutable** — dependencies with local test stand-ins (PGLite for Postgres, an in-memory filesystem). Deepenable if the stand-in exists. Test with the stand-in running in the suite. The seam is internal; no port at the external interface.

**3. Remote but owned (ports & adapters)** — your own services across a network boundary. Define a **port** at the seam. The deep module owns the logic; the transport is an injected **adapter** — in-memory for tests, HTTP/gRPC/queue in production. Recommendation shape: _"Define a port at the seam, an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."_

**4. True external (mock)** — third-party services you don't control (Stripe, Twilio). The deepened module takes the dependency as an injected port; tests provide a mock adapter.

### Seam discipline

The rules in [discipline.md](discipline.md) apply directly here — especially
[one-adapter-vs-two](discipline.md#one-adapter-is-a-hypothetical-seam-two-is-a-real-one) (don't
define a port until a second adapter is real) and
[replace-don't-layer](discipline.md#replace-dont-layer) (delete the old shallow-unit tests once
the interface-level tests exist).

## Design it twice

When exploring alternative interfaces for a chosen change, use this parallel sub-agent pattern.
Your first idea is rarely the best one.

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation:

- The constraints any new interface must satisfy.
- The dependencies it relies on, and which category (above) each falls into.
- A rough code sketch to ground the constraints — not a proposal, just a way to make them
  concrete.

Show this to the user, then proceed straight to Step 2. The user reads and thinks while the
sub-agents work.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel (the Agent tool). Each produces a **radically different**
interface. Give each a separate technical brief — file paths, coupling details, dependency
category, what sits behind the seam — plus one distinct constraint:

- Agent 1: "Minimize the interface — 1–3 entry points. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility — support many use cases and extension."
- Agent 3: "Optimise for the most common caller — make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for the cross-seam dependencies."

Include this repo's [glossary](glossary.md) and the project's domain vocabulary in every brief,
so the designs are comparable. Each sub-agent outputs:

1. Interface — types, methods, params, plus invariants, ordering, error modes.
2. A usage example showing how callers use it.
3. What the implementation hides behind the seam.
4. Dependency strategy and adapters.
5. Trade-offs — where leverage is high, where it's thin.

### 3. Present and compare

Present the designs one at a time so the user can absorb each, then compare in prose. Contrast
by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam
placement**. Give your own recommendation and why. If elements combine well, propose a hybrid.
Be opinionated — the user wants a strong read, not a menu.
