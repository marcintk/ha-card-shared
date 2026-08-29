# Glossary

Use these terms exactly — don't substitute "component," "service," "API," or "boundary."
Consistent language is the whole point. The playbooks in [processes.md](processes.md) and the
checks in [discipline.md](discipline.md) all lean on these definitions.

## The module vocabulary

**Module** — anything with an interface and an implementation. Deliberately scale-agnostic: a function, class, package, or tier-spanning slice. _Avoid_: unit, component, service.

**Interface** — everything a caller must know to use the module correctly: the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics. _Avoid_: API, signature (too narrow — they refer only to the type-level surface).

**Implementation** — what's inside a module, its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake). Reach for "adapter" when the seam is the topic; "implementation" otherwise.

**Depth** — leverage at the interface: the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation.

**Seam** _(Michael Feathers)_ — a place where you can alter behaviour without editing in that place; the _location_ at which a module's interface lives. Where to put the seam is its own design decision, distinct from what goes behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter** — a concrete thing that satisfies an interface at a seam. Describes _role_ (what slot it fills), not substance (what's inside).

**Leverage** — what callers get from depth: more capability per unit of interface they learn. One implementation pays back across N call sites and M tests.

**Locality** — what maintainers get from depth: change, bugs, knowledge, and verification concentrate in one place rather than spreading across callers. Fix once, fixed everywhere.

## The complexity vocabulary

**Complexity** — anything about the structure of the system that makes it hard to understand or change. Not a function of size; a 200-line module can be simpler than a 20-line one. It has two roots — dependencies and obscurity — and shows up as three symptoms (see [design.md](design.md)).

**Dependency** — code that can't be understood or changed on its own because its behaviour is tied to other code. Unavoidable in the large; the job is to keep them few and make the ones that remain obvious.

**Obscurity** — important information that isn't apparent from the code in front of you: a vague name, an ordering constraint you only learn by reading the implementation, an inconsistency that defeats pattern-matching.

## How the terms relate

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.
- **Complexity** accumulates from **Dependencies** and **Obscurity**; depth reduces both.

## Rejected framings

- **Depth as the ratio of implementation lines to interface lines** (Ousterhout's own metric): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword, or a class's public methods**: too narrow — interface here includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.
