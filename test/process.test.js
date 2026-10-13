import test from 'node:test';
import assert from 'node:assert/strict';
import { makeV1Torrent, utf8 } from './fixtures.js';

let formatBytes;
let processTorrentFiles;
try {
  ({ formatBytes, processTorrentFiles } = await import('../src/process.js'));
} catch {
  // Keep the red run focused on the missing processing behavior.
}

test('formats file sizes clearly without losing bigint precision', () => {
  assert.equal(typeof formatBytes, 'function', 'formatBytes should be exported');
  assert.equal(formatBytes(0n), '0 B');
  assert.equal(formatBytes(1024n), '1 KiB');
  assert.equal(formatBytes(1536n), '1.5 KiB');
  assert.equal(formatBytes(9007199254740993n), '8 PiB');
});

test('returns one ordered success or error per file and continues after failures', async () => {
  assert.equal(typeof processTorrentFiles, 'function', 'processTorrentFiles should be exported');
  const goodA = makeV1Torrent();
  const goodB = makeV1Torrent({ name: 'later.bin' });
  const results = await processTorrentFiles([
    { name: 'first.torrent', bytes: goodA.bytes },
    { name: 'broken.torrent', bytes: utf8('not bencode') },
    { name: 'last.torrent', bytes: goodB.bytes },
  ]);
  assert.deepEqual(results.map(({ name }) => name), ['first.torrent', 'broken.torrent', 'last.torrent']);
  assert.equal(results[0].result.protocol, 'v1');
  assert.match(results[1].error, /invalid|torrent|bencode/i);
  assert.equal(results[2].result.name, 'later.bin');
});
