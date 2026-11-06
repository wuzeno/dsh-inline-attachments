# Changelog

## 0.1.3 — First public experimental preview

### Interaction and rendering

- Preserve native user-message prelude chains with recursively mirrored child-slot aliases.
- Retain source selectors, injection, locale and store semantics instead of re-declaring native child slots.
- Restore sent-message compact image labels and corresponding authorized hover previews.
- Render valid reference markers as readable filename labels in native fallback text surfaces.
- Handle pending-image preview URLs in addition to durable image references.

### Release preparation

- Chinese and English project documentation, owner-supplied demonstration screenshots, editable vector architecture and HCI figures.
- MIT license text, source/package verification and Node.js 22/24 CI configuration.
- Clearly documented experimental limits; no npm-registry publication and no claimed benchmark results.

### Evidence

The owner confirmed the image flow in a Windows DSH desktop session. The local suite contains 28 tests. Full browser E2E coverage and sent-document preview remain out of scope for this preview.

## 0.1.2 — Input selector compatibility

- Pass an explicit selector to the host's `useInput` Hook.
- Strengthen the input-state test double to require the real selector calling contract.

## 0.1.1 — Composer slot priority

- Give the plugin's composer attachment entry priority over the native zero-priority entry.
- Add a regression test for the native default-priority competition.

## 0.1.0 — Local prototype

- Native chip insertion and attachment serialization.
- Draft image/text preview, same-message marker codec and initial sent-message adapter.
- Guarded insertion, failure restoration tests and explicit lifecycle limits.
