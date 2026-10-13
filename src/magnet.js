import { BencodeDictionary } from './bencode.js';

const decoder = new TextDecoder('utf-8');

export class MagnetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MagnetError';
  }
}

function textField(dictionary, key) {
  const value = dictionary.get(key);
  return value instanceof Uint8Array ? decoder.decode(value) : null;
}

function integerField(dictionary, key) {
  const value = dictionary.get(key);
  if (typeof value !== 'bigint' || value < 0n) {
    throw new MagnetError(`Torrent metadata has an invalid ${key} value`);
  }
  return value;
}

function pieceLengthField(info, isV2) {
  const value = integerField(info, 'piece length');
  const invalidV2Length = isV2 && (value < 16384n || (value & (value - 1n)) !== 0n);
  if (value === 0n || invalidV2Length) {
    throw new MagnetError('Torrent metadata has an invalid piece length');
  }
  return value;
}

function v1Size(info, includePadding = false) {
  const singleLength = info.get('length');
  const files = info.get('files');
  if (singleLength !== undefined && files !== undefined) {
    throw new MagnetError('Torrent metadata mixes single-file and multi-file fields');
  }
  if (singleLength !== undefined) return integerField(info, 'length');
  if (!Array.isArray(files)) throw new MagnetError('Torrent metadata has no valid v1 file length');
  return files.reduce((total, file) => {
    if (!(file instanceof BencodeDictionary)) throw new MagnetError('Torrent metadata has an invalid file entry');
    const length = integerField(file, 'length');
    const attr = file.get('attr');
    if (attr !== undefined && !(attr instanceof Uint8Array)) {
      throw new MagnetError('Torrent metadata has an invalid file attribute');
    }
    return attr?.includes(0x70) && !includePadding ? total : total + length;
  }, 0n);
}

function v2TreeSize(tree) {
  if (!(tree instanceof BencodeDictionary)) throw new MagnetError('Torrent metadata has an invalid file tree');
  const leaf = tree.get('');
  if (leaf !== undefined) {
    if (tree.entries.length !== 1 || !(leaf instanceof BencodeDictionary)) {
      throw new MagnetError('Torrent metadata has an invalid v2 file-tree leaf');
    }
    return integerField(leaf, 'length');
  }
  let total = 0n;
  for (const [, child] of tree) total += v2TreeSize(child);
  return total;
}

function collectTrackers(metainfo) {
  const trackers = [];
  const seen = new Set();
  const add = (value) => {
    if (!(value instanceof Uint8Array)) return;
    const tracker = decoder.decode(value);
    if (tracker && !seen.has(tracker)) {
      seen.add(tracker);
      trackers.push(tracker);
    }
  };

  add(metainfo.get('announce'));
  const tiers = metainfo.get('announce-list');
  if (Array.isArray(tiers)) {
    for (const tier of tiers) {
      if (Array.isArray(tier)) {
        for (const tracker of tier) add(tracker);
      } else {
        add(tier);
      }
    }
  }
  return trackers;
}

async function digest(algorithm, bytes) {
  if (!globalThis.crypto?.subtle) throw new MagnetError('Web Crypto hashing is unavailable in this browser');
  try {
    return new Uint8Array(await globalThis.crypto.subtle.digest(algorithm, bytes));
  } catch {
    throw new MagnetError(`The browser could not compute the ${algorithm} info hash`);
  }
}

function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function addParam(params, key, value) {
  const encodedValue = key === 'xt' ? value : encodeURIComponent(value);
  params.push(`${encodeURIComponent(key)}=${encodedValue}`);
}

export async function buildMagnet(parsed) {
  const { metainfo, infoBytes } = parsed ?? {};
  if (!(metainfo instanceof BencodeDictionary) || !(infoBytes instanceof Uint8Array)) {
    throw new MagnetError('Torrent parser result is invalid');
  }
  const info = metainfo.get('info');
  if (!(info instanceof BencodeDictionary)) throw new MagnetError('Torrent metadata is missing its info dictionary');

  const metaVersion = info.get('meta version');
  const hasV1 = info.has('pieces');
  const hasV2Tree = info.has('file tree');
  let protocol;
  if (metaVersion === undefined && hasV1 && !hasV2Tree) {
    protocol = 'v1';
  } else if (metaVersion === 2n && hasV2Tree && hasV1) {
    protocol = 'hybrid';
  } else if (metaVersion === 2n && hasV2Tree && !hasV1) {
    protocol = 'v2';
  } else if (metaVersion !== undefined && metaVersion !== 2n) {
    throw new MagnetError(`Unsupported torrent metadata version ${String(metaVersion)}`);
  } else {
    throw new MagnetError('Torrent metadata has an invalid v1/v2 field combination');
  }

  const pieceLength = pieceLengthField(info, protocol !== 'v1');
  if (hasV1) {
    const pieces = info.get('pieces');
    if (!(pieces instanceof Uint8Array) || pieces.length % 20 !== 0) {
      throw new MagnetError('Torrent metadata has an invalid v1 pieces field');
    }
    const pieceSpaceSize = v1Size(info, true);
    const expectedPieces = pieceSpaceSize === 0n ? 0n : (pieceSpaceSize + pieceLength - 1n) / pieceLength;
    if (BigInt(pieces.length / 20) !== expectedPieces) {
      throw new MagnetError('Torrent metadata has an invalid v1 pieces hash count');
    }
  }

  let size;
  if (protocol === 'v1') {
    size = v1Size(info);
  } else {
    size = v2TreeSize(info.get('file tree'));
    if (protocol === 'hybrid' && v1Size(info) !== size) {
      throw new MagnetError('Hybrid torrent v1 and v2 file sizes do not match');
    }
  }

  const name = textField(info, 'name.utf-8') ?? textField(info, 'name');
  const params = [];
  if (protocol === 'v1' || protocol === 'hybrid') {
    addParam(params, 'xt', `urn:btih:${hex(await digest('SHA-1', infoBytes))}`);
  }
  if (protocol === 'v2' || protocol === 'hybrid') {
    addParam(params, 'xt', `urn:btmh:1220${hex(await digest('SHA-256', infoBytes))}`);
  }
  if (name) addParam(params, 'dn', name);
  for (const tracker of collectTrackers(metainfo)) addParam(params, 'tr', tracker);

  return {
    uri: `magnet:?${params.join('&')}`,
    protocol,
    name,
    size,
  };
}
