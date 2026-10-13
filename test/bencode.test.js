import test from 'node:test';
import assert from 'node:assert/strict';
import { makeV1Torrent, utf8 } from './fixtures.js';

let parseTorrent;
try {
  ({ parseTorrent } = await import('../src/bencode.js'));
} catch {
  // Keep the red run focused on the missing parser behavior.
}

function parsed(input) {
  assert.equal(typeof parseTorrent, 'function', 'parseTorrent should be exported');
  return parseTorrent(input);
}

test('parses a canonical torrent and preserves the original info dictionary bytes', () => {
  const fixture = makeV1Torrent();
  const result = parsed(fixture.bytes);
  assert.deepEqual(result.infoBytes, fixture.infoBytes);
  assert.equal(result.metainfo.get('announce').length > 0, true);
  assert.equal(result.metainfo.get('info').get('length'), 42n);
});

test('preserves large integers and arbitrary binary strings', () => {
  const fixture = makeV1Torrent({ length: 900719925474099312345n, pieces: new Uint8Array([0, 255, 1]) });
  const result = parsed(fixture.bytes);
  const info = result.metainfo.get('info');
  assert.equal(info.get('length'), 900719925474099312345n);
  assert.deepEqual(info.get('pieces'), new Uint8Array([0, 255, 1]));
});

test('rejects malformed bencode before returning a torrent', () => {
  const cases = [
    ['truncated string', utf8('d4:info5:ab')],
    ['invalid integer', utf8('d4:infoi03ee')],
    ['unsorted keys', utf8('d4:infode1:bi1e1:ai2eee')],
    ['duplicate keys', utf8('d4:infode1:ai1e1:ai2eee')],
    ['trailing bytes', utf8('d4:infodee!')],
    ['missing info dictionary', utf8('d1:ai1ee')],
    ['non-dictionary info', utf8('d4:infoi1ee')],
  ];
  for (const [label, input] of cases) {
    assert.throws(() => parsed(input), { name: 'BencodeError' }, label);
  }
});
