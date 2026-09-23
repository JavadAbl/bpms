// zip.js — pure Node.js, no dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const IGNORED_FOLDERS = new Set(['node_modules', '.next', 'dist', ".git"]);

const cwd = process.cwd();
const zipName = `${path.basename(cwd)}.zip`;
const zipPath = path.join(cwd, zipName);

// ---------- CRC32 (required by the zip format) ----------
const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
    return (crc ^ -1) >>> 0;
}

// ---------- minimal zip writer ----------
const chunks = [];
let offset = 0;
const centralDirectory = [];

function addChunk(buf) {
    chunks.push(buf);
    offset += buf.length;
}

function dosTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
}

function addEntry(name, data, isDir) {
    const localOffset = offset;
    const { time, date } = dosTime(new Date());
    const nameBuf = Buffer.from(name, 'utf8');

    let method = 0; // stored
    let payload = data;
    if (!isDir) {
        const deflated = zlib.deflateRawSync(data, { level: 9 });
        if (deflated.length < data.length) {
            method = 8; // deflated
            payload = deflated;
        }
    }
    const crc = isDir ? 0 : crc32(data);

    // local file header
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4);         // version needed
    lfh.writeUInt16LE(0x0800, 6);     // flag: UTF-8 filenames
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    addChunk(lfh);
    addChunk(nameBuf);
    if (payload.length) addChunk(payload);

    centralDirectory.push({ nameBuf, crc, method, cSize: payload.length, uSize: data.length, localOffset, time, date, isDir });
}

function finalize() {
    const cdStart = offset;

    for (const e of centralDirectory) {
        const cdh = Buffer.alloc(46);
        cdh.writeUInt32LE(0x02014b50, 0); // signature
        cdh.writeUInt16LE(0x031e, 4);     // made by: unix, spec 3.0
        cdh.writeUInt16LE(20, 6);
        cdh.writeUInt16LE(0x0800, 8);
        cdh.writeUInt16LE(e.method, 10);
        cdh.writeUInt16LE(e.time, 12);
        cdh.writeUInt16LE(e.date, 14);
        cdh.writeUInt32LE(e.crc, 16);
        cdh.writeUInt32LE(e.cSize, 20);
        cdh.writeUInt32LE(e.uSize, 24);
        cdh.writeUInt16LE(e.nameBuf.length, 28);
        cdh.writeUInt32LE(e.isDir ? 0x10 : 0, 38); // external attrs (directory bit)
        cdh.writeUInt32LE(e.localOffset, 42);
        addChunk(cdh);
        addChunk(e.nameBuf);
    }

    // end of central directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(centralDirectory.length, 8);
    eocd.writeUInt16LE(centralDirectory.length, 10);
    eocd.writeUInt32LE(offset - cdStart, 12);
    eocd.writeUInt32LE(cdStart, 16);
    addChunk(eocd);

    fs.writeFileSync(zipPath, Buffer.concat(chunks));
}

// ---------- walk ----------
function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && IGNORED_FOLDERS.has(entry.name)) continue;
        if (entry.isFile() && entry.name === zipName) continue;

        const full = path.join(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
            addEntry(rel + '/', Buffer.alloc(0), true);
            walk(full, rel);
        } else if (entry.isFile()) {
            addEntry(rel, fs.readFileSync(full), false);
        }
        // symlinks are skipped
    }
}

// ---------- run ----------
walk(cwd);
finalize();

const mb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
console.log(`✅ ${zipName} created — ${centralDirectory.length} entries, ${mb} MB`);