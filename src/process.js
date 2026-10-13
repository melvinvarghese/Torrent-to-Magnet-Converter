import { parseTorrent } from './bencode.js';
import { buildMagnet } from './magnet.js';

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];

export function formatBytes(size) {
  if (typeof size !== 'bigint' || size < 0n) throw new TypeError('File size must be a non-negative bigint');
  if (size < 1024n) return `${size} B`;

  let unit = 0;
  let divisor = 1n;
  while (unit < UNITS.length - 1 && size >= divisor * 1024n) {
    divisor *= 1024n;
    unit += 1;
  }

  const tenths = (size * 10n + divisor / 2n) / divisor;
  const whole = tenths / 10n;
  const decimal = tenths % 10n;
  const value = decimal === 0n ? `${whole}` : `${whole}.${decimal}`;
  return `${value} ${UNITS[unit]}`;
}

export async function processTorrentFiles(files) {
  const results = [];
  for (const file of files) {
    const name = typeof file?.name === 'string' ? file.name : 'Unnamed file';
    try {
      const bytes = file?.bytes instanceof Uint8Array ? file.bytes : null;
      if (!bytes) throw new TypeError('File data is unavailable');
      const parsed = parseTorrent(bytes);
      results.push({ name, result: await buildMagnet(parsed) });
    } catch (error) {
      results.push({
        name,
        error: error instanceof Error ? error.message : 'Could not read this torrent file',
      });
    }
  }
  return results;
}
