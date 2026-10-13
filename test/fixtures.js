const encoder = new TextEncoder();

export const utf8 = (value) => encoder.encode(value);

function join(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function bencode(value) {
  if (value instanceof Uint8Array) {
    return join([utf8(`${value.length}:`), value]);
  }
  if (typeof value === 'string') return bencode(utf8(value));
  if (typeof value === 'bigint') return utf8(`i${value}e`);
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return utf8(`i${value}e`);
  }
  if (Array.isArray(value)) {
    return join([utf8('l'), ...value.map(bencode), utf8('e')]);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => {
      const left = utf8(a);
      const right = utf8(b);
      for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
        if (left[i] !== right[i]) return left[i] - right[i];
      }
      return left.length - right.length;
    });
    const parts = [utf8('d')];
    for (const [key, item] of entries) parts.push(bencode(key), bencode(item));
    parts.push(utf8('e'));
    return join(parts);
  }
  throw new TypeError(`Unsupported fixture value: ${String(value)}`);
}

export function makeTorrent(info, announce = 'https://tracker.example/announce', announceList = null) {
  const infoBytes = bencode(info);
  const parts = [utf8('d'), bencode('announce'), bencode(announce)];
  if (announceList) parts.push(bencode('announce-list'), bencode(announceList));
  parts.push(bencode('info'), infoBytes, utf8('e'));
  const root = join(parts);
  return { bytes: root, infoBytes };
}

export function makeV1Torrent(overrides = {}) {
  return makeTorrent({
    length: 42n,
    name: 'sample.bin',
    'piece length': 16384n,
    pieces: new Uint8Array(20).fill(7),
    ...overrides,
  });
}

export function makeMultiFileV1Torrent() {
  return makeTorrent({
    files: [
      { length: 10n, path: ['a.bin'] },
      { length: 32n, path: ['b.bin'] },
    ],
    name: 'bundle',
    'piece length': 16384n,
    pieces: new Uint8Array(20).fill(7),
  });
}

function makeV2Info(includeV1Fields = false) {
  const info = {
    'file tree': {
      'sample.bin': {
        '': { length: 42n, 'pieces root': new Uint8Array(32).fill(3) },
      },
    },
    'meta version': 2n,
    name: 'sample.bin',
    'piece length': 16384n,
  };
  if (includeV1Fields) {
    info.length = 42n;
    info.pieces = new Uint8Array(20).fill(7);
  }
  return info;
}

export function makeV2Torrent() {
  return makeTorrent(makeV2Info());
}

export function makeHybridTorrent() {
  return makeTorrent(makeV2Info(true));
}
