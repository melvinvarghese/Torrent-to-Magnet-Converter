# Free Torrent to Magnet Converter

[Open the online converter](https://melvinvarghese.github.io/torrent-to-magnet-converter/).

Convert `.torrent` files to magnet links for BitTorrent v1, v2, and hybrid torrents. Files are processed in your browser and stay on your device.

## What it supports

- Calculates v1 SHA-1 and v2 SHA-256 info hashes from the original bencoded `info` dictionary.
- Adds the torrent name and tracker URLs when available. Duplicate trackers are removed, and URI values are encoded safely.
- Shows payload sizes for single-file and multi-file torrents, excluding BEP 47 padding files.
- Processes multiple files in one batch. An invalid or unreadable file does not stop the others.
- Runs as a static site. No account, installation, or build step is needed.

## How to use it

1. Open the [converter](https://melvinvarghese.github.io/torrent-to-magnet-converter/).
2. Drop in one or more `.torrent` files, or choose them with **Browse files**.
3. Copy a generated magnet link into your BitTorrent client.

The converter reads files in browser memory. It does not upload them, save them, or send them to analytics.


## Limits

The converter reads torrent metadata to create a magnet link. It does not download torrent content, connect to peers, or verify piece contents. For hybrid torrents, it compares the v1 and v2 payload totals but does not fully validate file order or piece alignment. Use a BitTorrent client to verify the full metainfo and content.

## License

MIT. See [`LICENSE`](LICENSE) for the terms.

## Author

[Melvin Varghese](https://melvinvarghese.in).
