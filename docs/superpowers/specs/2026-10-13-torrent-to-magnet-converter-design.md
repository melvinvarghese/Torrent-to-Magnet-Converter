
# Torrent to Magnet Converter — Design Specification

## Goal

Create an original, polished, GitHub-ready web project that converts one or more `.torrent` files into magnet URIs. It should be easy to publish as a static GitHub Pages site and approachable as a portfolio project.

## Confirmed direction

- A no-dependency static website; no framework, server, account, or upload service.
- Process files in the browser and never transmit them.
- Support BitTorrent v1, v2, and hybrid torrents, with standards-correct info hashes and magnet topics.
- Use the approved cool-mist, porcelain, deep-teal, coral, lagoon, and citron visual direction.
- Name the project “Torrent to Magnet Converter.”
- Prepare the project in a new local folder; do not create a remote GitHub repository or publish it.

## User experience

The landing view opens directly on the converter. A custom magnet-and-field-lines illustration introduces the subject without stock imagery. A large keyboard-accessible drop zone also opens the file picker. It accepts multiple `.torrent` files and creates a result row for each valid file, showing its name, protocol type, and formatted size. Each row has a copy button and a selectable magnet URI. Clear/remove controls let users discard files and results. Invalid files receive concise, actionable errors without blocking other files in the batch.

The page includes a short privacy note that conversion happens in the browser and a small “How it works” section explaining that the app reads torrent metadata and computes its info hash. The layout is responsive, has visible focus states, supports reduced motion, and maintains readable contrast.

### Visual system

- Project name: Torrent to Magnet Converter.
- Palette: cool mist `#E9F1F4`, porcelain `#F9FBFA`, deep teal `#162B34`, coral `#F36B56`, lagoon `#49B7A5`, citron `#D9E46E`.
- Use a distinctive editorial display face paired with a highly legible sans-serif; load locally or use system fallbacks so the page remains functional offline.
- The signature element is an original inline vector magnet with restrained field lines. Keep the file controls and results calm and precise; avoid generic gradient cards.
- Use a single-column conversion flow on mobile and a compact two-column intro/workspace on wide screens.

## Technical design

Use semantic HTML, authored CSS, and native ES modules. Keep the byte-oriented bencode parser, hash/URI conversion logic, and DOM interactions in separate small files. Use the Web Crypto API for SHA-1 and SHA-256, which is available in modern browsers and on secure GitHub Pages origins. No network requests, analytics, external fonts, or third-party runtime dependencies.

The parser operates on the original byte buffer and records the exact byte span of the top-level `info` dictionary. It validates the bencoded structure, sorted dictionary keys, integer/string boundaries, and complete-file consumption before hashing. Hashing the original `info` bytes avoids changing a torrent’s identity through decode/re-encode normalization.

- v1: SHA-1 of the original bencoded `info` dictionary; emit `xt=urn:btih:<40-character-hex>`.
- v2: SHA-256 of that exact dictionary; emit `xt=urn:btmh:1220<64-character-hex>` (the multihash prefix for SHA-256).
- hybrid: emit both `btih` and `btmh` exact-topic parameters.
- Include a UTF-8 display name when present and deduplicated tracker URLs from `announce` and `announce-list`, percent-encoded as URI parameters. All optional magnet fields are omitted when absent.

Reported payload size excludes BEP 47 padding files; hybrid size comparison uses payload totals from both formats. For v1, the number of SHA-1 hashes must match the declared piece-space size, including padding files. V1 piece length must be positive; v2 and hybrid piece length must be a power of two of at least 16 KiB. The converter does not fully validate hybrid file order/piece alignment or verify file content hashes.

The browser reads and converts each selected file sequentially so a batch does not keep every torrent buffer in memory at once. The app treats filenames and metadata as untrusted input and writes them with text APIs, never HTML injection. It parses and validates bencoding and metadata shape instead of trusting the extension or MIME type. Errors distinguish unreadable files, malformed bencoding, missing/invalid `info`, unsupported metadata versions, invalid piece counts/lengths, and unavailable hashing support. It calculates info hashes but does not verify downloaded piece contents or contact peers.

## Project structure and delivery

Create a self-contained `torrent-to-magnet-converter/` project with `index.html`, `styles.css`, focused JavaScript modules, native Node test files and tiny test fixtures, `README.md`, a standard MIT `LICENSE` selected by the user, `.gitignore`, and a minimal `package.json` only for the `node --test` command. Tests require Node.js 20 or newer. Include GitHub Pages setup steps in the README. The code and visual design will be written independently rather than copied from the reference project.

## Tests and acceptance criteria

Tests cover bencode boundaries and malformed input; preserving the raw `info` byte span; known v1, v2, and hybrid info hashes; tracker/name escaping and deduplication; invalid and unsupported torrents; and handling multiple files independently. A small browser check verifies keyboard-accessible file selection, per-file result/error rendering, copy feedback, responsive layout, and no external network requests.

The project is ready when `npm test` passes, a static preview works without a build step, all conversions stay local, and the README explains both use and GitHub Pages deployment. It is a converter only; it does not download torrent content or connect to peers.

## Standards references

- BEP 3: https://www.bittorrent.org/beps/bep_0003.html
- BEP 52: https://www.bittorrent.org/beps/bep_0052.html
- BEP 9 magnet URI format: https://www.bittorrent.org/beps/bep_0009.html
