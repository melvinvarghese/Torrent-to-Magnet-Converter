import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeHybridTorrent,
  makeMultiFileV1Torrent,
  makeTorrent,
  makeV1Torrent,
  makeV2Torrent,
  utf8,
} from './fixtures.js';

let parseTorrent;
let buildMagnet;
try {
  ({ parseTorrent } = await import('../src/bencode.js'));
  ({ buildMagnet } = await import('../src/magnet.js'));
} catch {
  // Keep the red run focused on the missing conversion behavior.
}

async function convert(fixture) {
  assert.equal(typeof parseTorrent, 'function', 'parseTorrent should be exported');
  assert.equal(typeof buildMagnet, 'function', 'buildMagnet should be exported');
  return buildMagnet(parseTorrent(fixture.bytes));
}

test('converts v1 using the SHA-1 of the original info bytes', async () => {
  const result = await convert(makeV1Torrent());
  assert.equal(result.protocol, 'v1');
  assert.equal(result.size, 42n);
  assert.equal(result.name, 'sample.bin');
  assert.match(result.uri, /(?:\?|&)xt=urn:btih:00273958d87cbd0cb354ab0433bf312a70ab1de8/);
  assert.equal(new URL(result.uri).searchParams.get('xt'), 'urn:btih:00273958d87cbd0cb354ab0433bf312a70ab1de8');
});

test('rejects v1 pieces fields whose hash count does not match size and piece length', async () => {
  await assert.rejects(convert(makeV1Torrent({ pieces: new Uint8Array() })), /pieces|hash/i);
  await assert.rejects(convert(makeV1Torrent({ pieces: new Uint8Array(40) })), /pieces|hash/i);
  await assert.rejects(convert(makeV1Torrent({ length: 32768n, pieces: new Uint8Array(20) })), /pieces|hash/i);
  await assert.rejects(convert(makeV1Torrent({ 'piece length': 0n })), /piece length/i);
});

test('converts v2 using the SHA-256 multihash topic', async () => {
  const result = await convert(makeV2Torrent());
  assert.equal(result.protocol, 'v2');
  assert.equal(result.size, 42n);
  assert.match(result.uri, /(?:\?|&)xt=urn:btmh:12204e58fdb092b140ae8731975ba07003b5e328377d23c9734ece9f0c6e0191b3e5/);
  assert.equal(new URL(result.uri).searchParams.get('xt'), 'urn:btmh:12204e58fdb092b140ae8731975ba07003b5e328377d23c9734ece9f0c6e0191b3e5');
});

test('rejects v2 piece lengths below 16 KiB or not powers of two', async () => {
  for (const pieceLength of [0n, 8192n, 20000n]) {
    const fixture = makeTorrent({
      'file tree': {
        'sample.bin': { '': { length: 42n, 'pieces root': new Uint8Array(32).fill(3) } },
      },
      'meta version': 2n,
      name: 'sample.bin',
      'piece length': pieceLength,
    });
    await assert.rejects(convert(fixture), /piece length/i);
  }
});

test('hybrid torrents include the exact v1 and v2 topics', async () => {
  const result = await convert(makeHybridTorrent());
  assert.equal(result.protocol, 'hybrid');
  assert.match(result.uri, /(?:\?|&)xt=urn:btih:/);
  assert.match(result.uri, /&xt=urn:btmh:/);
  assert.deepEqual(new URL(result.uri).searchParams.getAll('xt'), [
    'urn:btih:49b609a98211bee41914b17aadcad602779a9e32',
    'urn:btmh:1220340a7c9884713b3ffdce2bf5f6753c72fb08bb23b9f13c9c672f398d300c2095',
  ]);
});

test('deduplicates trackers and safely encodes Unicode names and tracker URLs', async () => {
  const tracker = 'https://track.example/announce?pass=a&b=c';
  const fixture = makeTorrent({
    length: 1n,
    'name.utf-8': 'café & sample.bin',
    name: 'fallback.bin',
    'piece length': 16384n,
    pieces: new Uint8Array(20),
  }, tracker, [[tracker, 'https://other.example/announce']]);
  const result = await convert(fixture);
  const params = new URL(result.uri).searchParams;
  assert.equal(params.get('dn'), 'café & sample.bin');
  assert.deepEqual(params.getAll('tr'), [tracker, 'https://other.example/announce']);
  assert.equal(params.getAll('xt').length, 1);
  assert.equal(result.name, 'café & sample.bin');
});

test('omits absent optional trackers and names', async () => {
  const fixture = makeTorrent({
    length: 0n,
    'piece length': 16384n,
    pieces: new Uint8Array(),
  }, '');
  const result = await convert(fixture);
  const params = new URL(result.uri).searchParams;
  assert.equal(params.has('dn'), false);
  assert.equal(params.has('tr'), false);
});

test('sums v1 multi-file torrent lengths without number truncation', async () => {
  const fixture = makeMultiFileV1Torrent();
  const parsed = parseTorrent(fixture.bytes);
  const result = await buildMagnet(parsed);
  assert.equal(result.size, 42n);
});

test('excludes BEP 47 padding files from the reported v1 content size', async () => {
  const fixture = makeTorrent({
    files: [
      { length: 10n, path: ['a.bin'] },
      { attr: 'p', length: 16374n, path: ['.pad', '16374'] },
      { length: 42n, path: ['b.bin'] },
    ],
    name: 'bundle',
    'piece length': 16384n,
    pieces: new Uint8Array(40),
  });
  const result = await convert(fixture);
  assert.equal(result.size, 52n);
});

test('accepts hybrid torrents whose v1 and v2 payload sizes match after padding', async () => {
  const fixture = makeTorrent({
    files: [
      { length: 10n, path: ['a.bin'] },
      { attr: 'p', length: 16374n, path: ['.pad', '16374'] },
      { length: 42n, path: ['b.bin'] },
    ],
    'file tree': {
      'a.bin': { '': { length: 10n, 'pieces root': new Uint8Array(32).fill(1) } },
      'b.bin': { '': { length: 42n, 'pieces root': new Uint8Array(32).fill(2) } },
    },
    'meta version': 2n,
    name: 'bundle',
    'piece length': 16384n,
    pieces: new Uint8Array(40),
  });
  const result = await convert(fixture);
  assert.equal(result.protocol, 'hybrid');
  assert.equal(result.size, 52n);
});

test('rejects unsupported metadata versions and inconsistent v1/v2 fields', async () => {
  const unsupported = makeTorrent({
    'file tree': {},
    'meta version': 3n,
    name: 'bad',
    'piece length': 16384n,
  });
  await assert.rejects(convert(unsupported), /unsupported|invalid|version/i);

  const incompleteV2 = makeTorrent({
    'meta version': 2n,
    name: 'bad',
    'piece length': 16384n,
  });
  await assert.rejects(convert(incompleteV2), /file tree|invalid|metadata/i);

  const inconsistentHybrid = makeTorrent({
    length: 1n,
    'meta version': 2n,
    name: 'bad',
    'piece length': 16384n,
    pieces: utf8('too short'),
  });
  await assert.rejects(convert(inconsistentHybrid), /file tree|invalid|metadata/i);
});
