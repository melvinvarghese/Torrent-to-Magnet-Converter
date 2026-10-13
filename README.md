# Free Torrent to Magnet Converter

Use this free **torrent to magnet converter** to convert `.torrent` files to magnet links (`magnet:` URIs) for BitTorrent v1, v2, and hybrid torrents. Files are processed in your browser and stay on your device—nothing is uploaded.

## Features

- Convert BitTorrent v1, v2, and hybrid torrent metadata into magnet links.
- Hash the original bencoded `info` dictionary bytes for v1 SHA-1 and v2 SHA-256 topics.
- Include a torrent's display name and tracker URLs when present; remove duplicate trackers and encode URI values safely.
- Calculate single-file and multi-file payload sizes, excluding BEP 47 padding files from the displayed total.
- Convert multiple `.torrent` files in a batch and keep processing when an individual file is invalid or unreadable.
- Run as a static site with native browser APIs—no account, upload, installation, or build step is required.

## Use the converter

1. Serve the project folder locally or open its deployed static site.
2. Drop one or more `.torrent` files into the converter, or choose them with **Browse files**.
3. Copy each generated magnet link into your BitTorrent client.

Torrent files are read locally in browser memory. The converter creates magnet links from torrent metadata; it does not download torrent content.

## Run locally

You need Node.js 20 or newer and Python 3.

```bash
npm test
python3 -m http.server 8000
```

Open <http://127.0.0.1:8000/> in a browser. No `npm install` or compilation is needed. To run the browser smoke checks, start the same server and open <http://127.0.0.1:8000/test/browser-smoke.html>.

## Privacy and limitations

The selected files are read in your browser and are not uploaded, saved by the page, or sent to analytics. The converter parses the metadata needed to calculate info hashes and build a magnet URI. It does not download torrent content, connect to peers, or verify piece contents. For hybrid torrents, it compares v1 and v2 payload totals but does not fully validate file order or piece alignment. Use a BitTorrent client if you need full metainfo and content verification.

## Publish with GitHub Pages

This static site can be published from the repository root without a build step. GitHub Free includes GitHub Pages for public repositories; see [GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-products).

1. Push the project to the repository's `main` branch.
2. Open **Settings** → **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/(root)`, then save.
5. Wait for deployment; GitHub will show the site URL in Pages settings.

Pages sites are publicly accessible on the internet. See GitHub's guide to [configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## License

MIT; see [`LICENSE`](LICENSE) for the full terms.

## Author

Built by [Melvin Varghese](https://melvinvarghese.in).
