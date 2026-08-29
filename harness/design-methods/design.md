# Design — shaping an interface

Assumes the [glossary](glossary.md). This is what "design it twice" is choosing _between_, and
what [discipline.md](discipline.md) checks the result against.

## What complexity is, so you can aim at it

Complexity has two roots:

- **Dependencies** — a change here forces a change there.
- **Obscurity** — you can't tell what the code needs or does without reading its insides.

You'll feel it as one of three symptoms:

- **Change amplification** — one conceptual change needs edits in many places.
- **Cognitive load** — how much a developer must hold in their head to make a change safely.
- **Unknown-unknowns** — it isn't even obvious _which_ code a change must touch, or what you'd
  have to know to get it right. The worst kind: you can't see it coming. A good interface turns
  unknown-unknowns into known-knowns.

Every principle below is a move against one of these.

## Deep vs shallow

**Deep** = small interface, lots of implementation:

```
┌─────────────────────┐
│   Small Interface   │  ← few methods, simple params
├─────────────────────┤
│  Deep Implementation│  ← complex logic hidden
└─────────────────────┘
```

**Shallow** = large interface, little implementation (avoid):

```
┌─────────────────────────────────┐
│         Large Interface         │  ← many methods, complex params
├─────────────────────────────────┤
│      Thin Implementation        │  ← just passes through
└─────────────────────────────────┘
```

When designing an interface, ask: can I reduce the number of methods? Simplify the parameters?
Hide more behind it? **Depth is a property of the interface, not the implementation** — a deep
module can be internally composed of small, swappable parts; they just aren't in the interface.

## Pull complexity downward

Given a piece of complexity that won't disappear, the module should absorb it rather than expose
it. It is better to have a complex implementation than a complex interface: the module is written
once, the interface is learned by every caller.

The tell is a **configuration parameter that offloads a decision** — a buffer size, a retry
count, a flag — that the caller almost never has grounds to set. Each one is a question the
module is refusing to answer. Ask: can the module pick a good default itself, or compute the
answer from what it already has? Expose the knob only when a real caller demonstrably needs it.

## Different layer, different abstraction

Each layer should restate the problem in different terms than the layers above and below it. If
two adjacent layers talk about the same things, one of them probably isn't earning its place.
Red flags:

- **Pass-through method** — does nothing but call another method, one layer down, with roughly
  the same signature. It adds interface without adding behaviour.
- **Pass-through variable** — threaded through a long chain of signatures only so the bottom can
  use it. Every layer in the chain now names something it doesn't care about.
- **A wrapper that barely changes its wrappee** — a decorator or adapter whose interface is the
  same shape and whose implementation adds a line or two.

## Information hiding, and leakage

A deep module **hides a design decision** — a file format, a retry policy, an eviction
strategy — that its interface never mentions. Callers can't depend on what they can't see, so
the decision stays cheap to change.

**Leakage** is the opposite: the same decision is known to two or more modules, so changing it
means editing all of them in lockstep. A frequent cause is **temporal decomposition** —
structuring code by the order things happen (read the file, then transform, then write it back)
so that the read side and the write side _both_ encode the format. Structure around
**knowledge** instead: one module owns the format, and reading and writing both go through it.

## Design for testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them.** `processOrder(order, paymentGateway)`, not a
   `new StripeGateway()` buried in the body.
2. **Return results, don't mutate.** `calculateDiscount(cart): Discount`, not
   `applyDiscount(cart): void`.
3. **Small surface area.** Fewer methods, fewer params — fewer tests, simpler setup.

## Define errors out of existence

Exception handling is complexity that spreads: every `throw` is a branch every caller may have
to reason about. Prefer an interface where the error case simply doesn't arise:

- **Clamp instead of throwing** — a substring past the end returns what's there; a delete of a
  missing key is a no-op.
- **Return an empty result, not an exception** — a lookup that finds nothing returns `[]`.
- **Handle it low and once**, not high and everywhere — catch at the layer that can actually do
  something, and let the ones above stay ignorant.

Reserve exceptions for what a caller genuinely must act on. The goal is fewer places where an
exception has to be handled, not more places where one is thrown.

## General-purpose beats special-purpose, slightly

An interface shaped for exactly today's one caller tends to be shallow and to leak that caller's
assumptions. Aim for "somewhat general-purpose": implement what today needs, but give the
interface a shape that a second plausible caller could use without widening it.
