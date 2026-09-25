/**
 * Minimal ZIP writer (STORE / no compression) used for multi-file exports.
 * Implemented locally to avoid adding a dependency.
 */

export interface ZipEntry {
  /** Path inside the archive, e.g. "packages/PKG_TIQUETES.sql" */
  path: string;
  content: string;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: dosDate & 0xffff };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number) {
    const b = new Uint8Array(2);
    b[0] = value & 0xff;
    b[1] = (value >>> 8) & 0xff;
    this.push(b);
  }

  u32(value: number) {
    const b = new Uint8Array(4);
    b[0] = value & 0xff;
    b[1] = (value >>> 8) & 0xff;
    b[2] = (value >>> 16) & 0xff;
    b[3] = (value >>> 24) & 0xff;
    this.push(b);
  }

  concat() {
    const output = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }
}

export function createZip(entries: ZipEntry[], date: Date = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date: dosDate } = dosDateTime(date);
  const writer = new ByteWriter();
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);
    const offset = writer.length;

    // Local file header
    writer.u32(0x04034b50);
    writer.u16(20); // version needed
    writer.u16(0x0800); // UTF-8 flag
    writer.u16(0); // method: store
    writer.u16(time);
    writer.u16(dosDate);
    writer.u32(crc);
    writer.u32(dataBytes.length);
    writer.u32(dataBytes.length);
    writer.u16(nameBytes.length);
    writer.u16(0); // extra length
    writer.push(nameBytes);
    writer.push(dataBytes);

    central.push({ name: nameBytes, crc, size: dataBytes.length, offset });
  }

  const centralStart = writer.length;

  for (const item of central) {
    writer.u32(0x02014b50);
    writer.u16(20); // version made by
    writer.u16(20); // version needed
    writer.u16(0x0800);
    writer.u16(0);
    writer.u16(time);
    writer.u16(dosDate);
    writer.u32(item.crc);
    writer.u32(item.size);
    writer.u32(item.size);
    writer.u16(item.name.length);
    writer.u16(0); // extra
    writer.u16(0); // comment
    writer.u16(0); // disk start
    writer.u16(0); // internal attrs
    writer.u32(0); // external attrs
    writer.u32(item.offset);
    writer.push(item.name);
  }

  const centralSize = writer.length - centralStart;

  // End of central directory
  writer.u32(0x06054b50);
  writer.u16(0);
  writer.u16(0);
  writer.u16(central.length);
  writer.u16(central.length);
  writer.u32(centralSize);
  writer.u32(centralStart);
  writer.u16(0);

  return new Blob([writer.concat()], { type: "application/zip" });
}
