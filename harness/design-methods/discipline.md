# Discipline — the checks

Fast checks that catch a bad shape before it ships. Run them against a proposed design in Step 6
and against each candidate in the [scan](processes.md#scanning-for-candidates). They assume the
[glossary](glossary.md) and the principles in [design.md](design.md).

## The deletion test

Imagine deleting the module. If complexity vanishes, it was a pass-through and shouldn't exist.
If complexity _reappears_, spread across N callers, it was earning its keep — and the more
concentrated the reappearance, the deeper the module.

## One adapter is a hypothetical seam; two is a real one

Don't introduce a port or an interface-with-one-implementation on the argument that something
_might_ vary. A single-adapter seam is just indirection. Wait until a second adapter is actually
justified — typically a production one plus a test one.

## The interface is the test surface

Callers and tests cross the same seam. If a test needs to reach _past_ the interface — poke
private state, stub an internal call — the module is the wrong shape, or the test is testing the
implementation instead of the behaviour.

## Internal seams vs external seams

A deep module can have **internal seams** — private to its implementation, used by its own
tests — as well as the **external seam** at its interface. That's fine. What's not fine is
exposing an internal seam through the interface just because a test finds it convenient; that
widens the interface for everyone to serve one test.

## Replace, don't layer

When a module is deepened, its old shallow-unit tests become waste — delete them, don't keep
them running alongside the new ones. Write the new tests at the deepened interface. They assert
on observable outcomes through that interface, so they survive an internal refactor; a test that
has to change every time the implementation changes is testing past the interface.

## Red flags

A design note or a diff that shows any of these needs a second look before it proceeds:

- **Shallow module** — the interface is nearly as much to learn as the implementation.
- **Information leakage** — the same design decision (a format, a policy) is encoded in two+ modules.
- **Temporal decomposition** — modules split by order-of-operations, so each step re-knows a shared fact.
- **Pass-through method or variable** — an element that adds interface without adding behaviour.
- **Offloaded decision** — a config parameter that exists only because the module declined to choose.
- **Change amplification** — one conceptual change in the note touches many unrelated-looking places.
- **Unnameable** — you can't pick a crisp name for the module, or can't state what it does in one sentence. Usually means it does more than one thing.
