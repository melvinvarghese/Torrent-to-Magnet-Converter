# Torrent to Magnet Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` for native implementation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished static website that converts `.torrent` files to standards-correct v1, v2, and hybrid magnet URIs entirely in the browser.

**Architecture:** A strict byte-oriented bencode parser extracts the exact raw `info` dictionary span. A separate async converter hashes that span and assembles magnet parameters; a browser module handles selection, display, copy, and errors. The site has no runtime dependencies or network calls.

**Tech Stack:** Semantic HTML, CSS, native ES modules, Web Crypto, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-13-torrent-to-magnet-converter-design.md`

## Global Constraints

- Keep the site static and build-free; do not add runtime or test dependencies.
- Process selected files locally; do not upload, store, or send metadata to a server.
- Hash exact raw `info` dictionary bytes, never a decode/re-encode approximation.
- Support BitTorrent v1, v2, and hybrid torrents; reject invalid or unsupported input clearly.
- Include MIT, selected by the user; do not create a remote repository or publish the project.
- Require Node.js 20 or newer for tests.

## Review Focus

- Unsorted/duplicate dictionary keys, truncated strings, invalid integers, and trailing bytes → parser rejects them in Task 1.
- Torrent identity changed by parsing/serialization → compare `infoBytes` byte-for-byte and assert fixed hash vectors in Tasks 1–2.
- URI escaping and duplicate tracker edge cases → test UTF-8 names, reserved characters, and deduplication in Task 2.
- Ambiguous metadata versions and hybrid detection → test v1/v2/hybrid and invalid combinations in Task 2.
- Mixed batches and unsafe display text → test batch isolation and text-only rendering in Task 3.

---

### Task 1: Project test setup and strict metainfo parser

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/bencode.js`
- Create: `test/bencode.test.js`
- Create: `test/fixtures.js`

**Interfaces:**
- `parseTorrent(input: Uint8Array) -> { metainfo: BencodeDictionary, infoBytes: Uint8Array }`.
- `BencodeValue` is `Uint8Array | bigint | BencodeValue[] | BencodeDictionary`.
- `BencodeDictionary` retains byte-string keys and ordered entries; `get(key: string)` looks up ASCII protocol keys.
- Parser rejects malformed structure, invalid integers/string lengths, unsorted or duplicate keys, missing/non-dictionary `info`, truncation, and trailing bytes. Preserve binary strings without text decoding.

- [x] **Step 1: Initialize a local Git repository in this project folder if needed; create `package.json` with `type: module`, `engines.node >=20`, and `test: node --test`; create a minimal `.gitignore`. Do not add packages, a remote, or a push target.**
- [x] **Step 2: Write parser tests for a valid raw-`info` slice, malformed/truncated/unsorted/duplicate/trailing input, large integers, and binary byte strings.**
- [x] **Step 3: Run `node --test test/bencode.test.js`; verify the failure points to the missing parser behavior, not test syntax.**
- [x] **Step 4: Implement the minimal recursive byte parser, strict validation, dictionary lookup, and raw `info` span capture in `src/bencode.js`.**
- [x] **Step 5: Run `node --test test/bencode.test.js`; expect all parser assertions to pass.**
- [x] **Step 6: Commit the project setup and parser tests.**

### Task 2: Hashes and magnet URI construction

**Files:**
- Create: `src/magnet.js`
- Create: `test/magnet.test.js`
- Modify: `test/fixtures.js`

**Interfaces:**
- Consumes Task 1’s parser result, named `ParsedTorrent`.
- `buildMagnet(parsed: ParsedTorrent) -> Promise<{ uri: string, protocol: 'v1' | 'v2' | 'hybrid', name: string | null, size: bigint | null }>`.
- v1-only: `pieces` exists and `meta version` is absent. v2-only: `meta version = 2`, `file tree` exists, and `pieces` is absent. Hybrid: version 2 plus both fields. Reject unsupported versions and inconsistent combinations.
- A v1 `pieces` string must contain exactly one 20-byte hash per declared piece, counting BEP 47 padding in v1 piece space; v1 piece length must be positive. V2/hybrid piece length must be a power of two of at least 16 KiB.
- Compute v1 payload size from `length` or multi-file entries, excluding entries whose `attr` includes the BEP 47 padding flag `p`; compute v2/hybrid payload size from `file tree` lengths. Prefer `name.utf-8`, then `name`.
- Hash exact `infoBytes` with SHA-1 for v1 and SHA-256 for v2. Format v1 as 40-character hex; v2 as `1220` plus 64-character hex. Hybrids emit both `xt` topics.
- Add optional `dn` and deduplicated `tr` values from `announce` and nested `announce-list`; encode values for URI use and omit absent parameters.

- [x] **Step 1: Write failing tests using fixed v1, v2, and hybrid fixtures with known SHA-1/SHA-256 vectors.**
- [x] **Step 2: Add assertions for exact `xt` topics, Unicode names, reserved tracker characters, duplicate trackers, missing optional fields, v1 hash-count and v2 piece-length validity, padding-aware multi-file sizes, unsupported versions, and invalid field combinations.**
- [x] **Step 3: Run `node --test test/magnet.test.js`; verify failures are from the missing conversion behavior.**
- [x] **Step 4: Implement `buildMagnet` with Web Crypto and Task 1’s original `infoBytes`.**
- [x] **Step 5: Run `node --test test/magnet.test.js`; expect all hash and URI assertions to pass.**
- [x] **Step 6: Commit the converter and tests.**

### Task 3: Responsive browser interface

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/process.js`
- Create: `src/app.js`
- Create: `test/process.test.js`
- Create: `test/browser-smoke.html`
- Create: `scripts/browser-smoke.js`
- Modify: `test/fixtures.js` so the fixture encoder also runs in browsers

**Interfaces:**
- `formatBytes(size: bigint) -> string` formats payload sizes without precision loss.
- `processTorrentFiles(files: Array<{ name: string, bytes: Uint8Array }>) -> Promise<Array<{ name: string, result?: MagnetResult, error?: string }>>` handles each file independently and keeps results in input order.
- `src/app.js` reads browser `File` objects with `arrayBuffer()` one at a time, calls the processor, and renders file-provided text with `textContent`. Magnet URIs remain selectable if clipboard access is unavailable.
- The full drop-zone label activates the associated keyboard-focusable file picker. On wide screens, the intro and converter share a two-column layout; on narrow screens, they stack.

- [x] **Step 1: Write failing tests for `formatBytes` at zero, common sizes, and values above `Number.MAX_SAFE_INTEGER`; test that mixed valid/invalid batches keep per-file outcomes and order.**
- [x] **Step 2: Run `node --test test/process.test.js`; verify failures are from the missing processor behavior.**
- [x] **Step 3: Implement the processor and semantic accessible UI with multi-file picker/drop zone, copy/select/clear, per-file errors, privacy note, and approved visual system.**
- [x] **Step 4: Run `node --test test/process.test.js`; expect formatting and batch-isolation assertions to pass.**
- [x] **Step 5: Add a dependency-free browser smoke page and script that exercise the clickable keyboard-accessible drop zone, safe filename rendering, v1/v2/hybrid output, result counts, clear, and copy fallback.**
- [x] **Step 6: Start a static preview with `python3 -m http.server 4173 --directory .` and open `http://localhost:4173/test/browser-smoke.html`. Check sequential file reads, keyboard selection, click/drop, mixed files, copy fallback, wide-screen side-by-side layout, narrow-screen stacking and no horizontal overflow at 375px, visible focus, reduced motion, and no external requests.**
- [x] **Step 7: Commit the interface and tests.**

### Task 4: GitHub-ready project files and final verification

**Files:**
- Create: `README.md`
- Create: `LICENSE` (standard MIT text; copyright-holder value for the user to fill)

- [x] **Step 1: Add a README with purpose, local privacy behavior, usage, `npm test`, MIT license note, and GitHub Pages setup from the `main` branch root.**
- [x] **Step 2: Add the MIT text and clearly mark the copyright-holder value for the user to replace.**
- [x] **Step 3: Run `npm test`; expect exit code 0 and all tests passing.**
- [x] **Step 4: Verify relative paths under a nested GitHub Pages URL, inspect `git status`, and confirm no external network requests or copied source files.**
- [x] **Step 5: Commit the finished project locally; do not add a remote or push.**
