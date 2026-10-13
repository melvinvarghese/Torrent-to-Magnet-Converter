const MAX_DEPTH = 256;
const ASCII = new TextEncoder();

export class BencodeError extends Error {
  constructor(message, offset) {
    super(`${message} at byte ${offset}`);
    this.name = 'BencodeError';
    this.offset = offset;
  }
}

export class BencodeDictionary {
  constructor(entries) {
    this.entries = entries;
  }

  get(key) {
    const wanted = ASCII.encode(key);
    const entry = this.entries.find(([bytes]) => equalBytes(bytes, wanted));
    return entry?.[1];
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  [Symbol.iterator]() {
    return this.entries[Symbol.iterator]();
  }
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function compareBytes(left, right) {
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

export function parseTorrent(input) {
  if (!(input instanceof Uint8Array)) {
    throw new TypeError('Torrent input must be a Uint8Array');
  }

  let offset = 0;

  function fail(message) {
    throw new BencodeError(message, offset);
  }

  function parseString() {
    const start = offset;
    while (offset < input.length && input[offset] >= 48 && input[offset] <= 57) {
      offset += 1;
    }
    if (offset === start || input[offset] !== 58) fail('Expected byte-string length');

    const digits = input.subarray(start, offset);
    if (digits.length > 1 && digits[0] === 48) fail('Byte-string length has a leading zero');
    const length = Number(new TextDecoder().decode(digits));
    if (!Number.isSafeInteger(length)) fail('Byte-string length is too large');

    offset += 1;
    const end = offset + length;
    if (end > input.length) fail('Byte string is truncated');
    const value = input.subarray(offset, end);
    offset = end;
    return value;
  }

  function parseValue(depth = 0) {
    if (depth > MAX_DEPTH) fail(`Nesting exceeds the ${MAX_DEPTH}-level limit`);
    if (offset >= input.length) fail('Unexpected end of input');

    const token = input[offset];
    if (token >= 48 && token <= 57) return parseString();

    if (token === 105) {
      const start = offset + 1;
      const end = input.indexOf(101, start);
      if (end < 0) fail('Integer is missing its terminator');
      const digits = new TextDecoder().decode(input.subarray(start, end));
      if (!/^(0|-[1-9]\d*|[1-9]\d*)$/.test(digits)) fail('Invalid integer encoding');
      offset = end + 1;
      return BigInt(digits);
    }

    if (token === 108) {
      offset += 1;
      const values = [];
      while (true) {
        if (offset >= input.length) fail('List is missing its terminator');
        if (input[offset] === 101) {
          offset += 1;
          return values;
        }
        values.push(parseValue(depth + 1));
      }
    }

    if (token === 100) {
      offset += 1;
      const entries = [];
      let previousKey = null;
      while (true) {
        if (offset >= input.length) fail('Dictionary is missing its terminator');
        if (input[offset] === 101) {
          offset += 1;
          return new BencodeDictionary(entries);
        }
        if (input[offset] < 48 || input[offset] > 57) fail('Dictionary key must be a byte string');
        const key = parseString();
        if (previousKey && compareBytes(previousKey, key) >= 0) {
          fail(compareBytes(previousKey, key) === 0 ? 'Duplicate dictionary key' : 'Dictionary keys are not sorted');
        }
        previousKey = key;
        entries.push([key, parseValue(depth + 1)]);
      }
    }

    fail('Unexpected bencode token');
  }

  const metainfo = parseValue();
  if (!(metainfo instanceof BencodeDictionary)) fail('Top-level value must be a dictionary');
  if (offset !== input.length) fail('Trailing bytes after torrent metainfo');

  const info = metainfo.get('info');
  if (!(info instanceof BencodeDictionary)) fail('Torrent is missing an info dictionary');

  let infoBytes = null;
  offset = 0;
  // Locate the top-level info value again to preserve its exact encoded bytes.
  function skipValue(depth = 0) {
    if (depth > MAX_DEPTH) fail(`Nesting exceeds the ${MAX_DEPTH}-level limit`);
    const token = input[offset];
    if (token >= 48 && token <= 57) {
      parseString();
      return;
    }
    if (token === 105) {
      const end = input.indexOf(101, offset + 1);
      if (end < 0) fail('Integer is missing its terminator');
      offset = end + 1;
      return;
    }
    if (token === 108 || token === 100) {
      const isDictionary = token === 100;
      offset += 1;
      while (offset < input.length && input[offset] !== 101) {
        if (isDictionary) parseString();
        skipValue(depth + 1);
      }
      if (offset >= input.length) fail(isDictionary ? 'Dictionary is missing its terminator' : 'List is missing its terminator');
      offset += 1;
      return;
    }
    fail('Unexpected bencode token');
  }

  offset += 1; // top-level dictionary opener
  while (offset < input.length && input[offset] !== 101) {
    const key = parseString();
    const valueStart = offset;
    skipValue(1);
    if (equalBytes(key, ASCII.encode('info'))) infoBytes = input.slice(valueStart, offset);
  }
  if (infoBytes === null) fail('Torrent is missing an info dictionary');

  return { metainfo, infoBytes };
}
