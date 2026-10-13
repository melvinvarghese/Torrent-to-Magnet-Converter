import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('page metadata describes the private torrent-to-magnet converter', () => {
  const title = page.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
  const description = page.match(/<meta\s+name="description"\s+content="([^"]+)"\s*>/i)?.[1] ?? '';

  assert.match(title, /free torrent to magnet converter/i);
  assert.match(description, /torrent to magnet converter/i);
  assert.match(description, /BitTorrent v1, v2, and hybrid/i);
  assert.match(description, /no uploads/i);
  assert.ok(description.length <= 160, 'search description should fit a typical snippet');
});

test('footer credits Melvin with a link to his website', () => {
  const footer = page.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? '';

  assert.match(footer, /<a\b[^>]*href="https:\/\/melvinvarghese\.in"[^>]*>[\s\S]*?Melvin Varghese[\s\S]*?<\/a>/i);
});

test('README introduces the search topic and the project accurately', () => {
  assert.match(readme, /^# Free Torrent to Magnet Converter/m);
  assert.match(readme, /convert `?\.torrent`? files to magnet links/i);
  assert.match(readme, /BitTorrent v1, v2, and hybrid/i);
  assert.match(readme, /stay on your device/i);
  assert.match(readme, /melvinvarghese\.in/i);
  assert.match(readme, /npm test/i);
});
