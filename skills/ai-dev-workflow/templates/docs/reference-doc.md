# <package> — binding reference

`<package>` is the core of <feature> (ADR-NNNN). This file records every mechanism, setting and caveat of the package
as studied **in its source**, plus how we use it. Code that touches it follows this file; the reviewer checks against
it. Update it whenever the version or our usage changes.

- Package: <registry link> · source <repo link> · <licence>
- Studied: **<version>** (published <date>, commit `<sha>`). Pin the exact version; upgrade only after reading the
  diff and re-running our tests.
- Size and quality at study time: <lines>, dependencies, <n> tests passing on our toolchain, analyzer state, I/O it does.
- Maintenance: <how we handle gaps — cover in our adapter, or patch it ourselves under its licence>.

## 1. What it does, and what it does not
## 2. Integration contract (interfaces we implement, items, factory)
## 3. Mechanisms (all automatic)
## 4. Configuration (each knob · our value · why)
## 5. Devices, memory and lifecycle
## 6. Changing data (refresh, paging)
## 7. Observing (events, metrics)
## 8. Lessons from its example app / issues
## 9. Rules for our code
1. Only <our coordinator> talks to it.
2. …
## 10. To verify on devices before building on it
- …
