# Free Torrent to Magnet Converter

[Open the online converter](https://melvinvarghese.github.io/Torrent-to-Magnet-Converter/).

Convert `.torrent` files to magnet links for BitTorrent v1, v2, and hybrid torrents. Files are processed in your browser and stay on your device.

## What it supports

- Calculates v1 SHA-1 and v2 SHA-256 info hashes from the original bencoded `info` dictionary.
- Adds the torrent name and tracker URLs when available. Duplicate trackers are removed, and URI values are encoded safely.
- Shows payload sizes for single-file and multi-file torrents, excluding BEP 47 padding files.
- Processes multiple files in one batch. An invalid or unreadable file does not stop the others.
- Runs as a static site. No account, installation, or build step is needed.

## How to use it

1. Open the [converter](https://melvinvarghese.github.io/Torrent-to-Magnet-Converter/).
2. Drop in one or more `.torrent` files, or choose them with **Browse files**.
3. Copy a generated magnet link into your BitTorrent client.

The converter reads files in browser memory. It does not upload them, save them, or send them to analytics.

## Tests

Run the test suite with Node.js 20 or newer:

```sh
npm test
```


## Frequently asked questions

### What does a torrent-to-magnet converter do?

It reads the metadata inside a `.torrent` file and creates a magnet link that identifies the torrent. You can paste that link into a compatible BitTorrent client.

### How do I convert a `.torrent` file into a magnet link?

Open the converter, select or drop your `.torrent` file, and copy the magnet link it generates.

### Are my torrent files uploaded to a server?

No. The converter processes the selected files locally in your browser. It does not upload or save them, and it does not send them to analytics.

### Does it support BitTorrent v1, v2, and hybrid torrents?

Yes. It calculates v1 SHA-1 and v2 SHA-256 info hashes from the torrent metadata, including hybrid torrents.

### Can I convert multiple torrent files at once?

Yes. You can select or drop multiple `.torrent` files in one batch. If one file is invalid or unreadable, the others can still be processed.

### Does the converter download the torrent or connect to peers?

No. It only creates magnet links from torrent metadata. It does not download files, connect to peers, or verify downloaded content.

## Limits

The converter reads torrent metadata to create a magnet link. It does not download torrent content, connect to peers, or verify piece contents. For hybrid torrents, it compares the v1 and v2 payload totals but does not fully validate file order or piece alignment. Use a BitTorrent client to verify the full metainfo and content.

## License

MIT. See [`LICENSE`](LICENSE) for the terms.

## Author

[Melvin Varghese](https://melvinvarghese.in).
