import { crc32 } from 'zlib';

export interface ZipFileEntry {
  name: string;
  content: string | Buffer;
}

export interface ParsedZipFile {
  name: string;
  content: Buffer;
}

/**
 * Creates a standard uncompressed (STORE method) PKZIP archive buffer in pure Node.js.
 * Perfectly compatible with standard unzip utilities and archive readers.
 */
export function createSimpleZip(files: ZipFileEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const data = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const nameBuf = Buffer.from(file.name, 'utf8');
    const checksum = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + filename)
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed (2.0)
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(0, 8); // compression: 0 (store)
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0, 12); // mod date
    lfh.writeUInt32LE(checksum, 14); // crc-32
    lfh.writeUInt32LE(size, 18); // compressed size
    lfh.writeUInt32LE(size, 22); // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26); // file name length
    lfh.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(lfh, 30);

    localHeaders.push(lfh, data);

    // Central directory header (46 bytes + filename)
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0, 8); // flags
    cdh.writeUInt16LE(0, 10); // compression method (0 = store)
    cdh.writeUInt16LE(0, 12); // mod time
    cdh.writeUInt16LE(0, 14); // mod date
    cdh.writeUInt32LE(checksum, 16); // crc-32
    cdh.writeUInt32LE(size, 20); // compressed size
    cdh.writeUInt32LE(size, 24); // uncompressed size
    cdh.writeUInt16LE(nameBuf.length, 28); // file name length
    cdh.writeUInt16LE(0, 30); // extra field length
    cdh.writeUInt16LE(0, 32); // comment length
    cdh.writeUInt16LE(0, 34); // disk start
    cdh.writeUInt16LE(0, 36); // internal file attributes
    cdh.writeUInt32LE(0, 38); // external file attributes
    cdh.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(cdh, 46);

    centralHeaders.push(cdh);
    offset += lfh.length + data.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, b) => sum + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with start of central dir
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central directory size
  eocd.writeUInt32LE(centralDirOffset, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Parses a simple uncompressed (STORE method) PKZIP archive buffer.
 */
export function parseSimpleZip(buffer: Buffer): ParsedZipFile[] {
  const files: ParsedZipFile[] = [];
  let offset = 0;

  while (offset < buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      // Reached central directory or end
      break;
    }

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const content = buffer.subarray(dataStart, dataEnd);

    files.push({ name, content });
    offset = dataEnd;
  }

  return files;
}
