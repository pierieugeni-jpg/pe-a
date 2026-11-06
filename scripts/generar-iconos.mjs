// Genera los íconos PNG de la PWA sin dependencias: fondo naranja con un "÷" blanco.
// Uso: npm run icons
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const NARANJA = [234, 88, 12];
const BLANCO = [255, 255, 255];

// Formas en coordenadas 0..1. Todo dentro de la "zona segura" de íconos maskable (círculo r=0.4).
function esBlanco(x, y) {
  const dot = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const barra = Math.abs(y - 0.5) <= 0.045 && Math.abs(x - 0.5) <= 0.24;
  return barra || dot(0.5, 0.33, 0.065) || dot(0.5, 0.67, 0.065);
}

function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tipo), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const ss = 4; // supersampling para bordes suaves
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let n = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) if (esBlanco((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size)) n++;
      const a = n / (ss * ss);
      const o = py * (size * 3 + 1) + 1 + px * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(NARANJA[i] * (1 - a) + BLANCO[i] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [nombre, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(new URL(`../public/${nombre}`, import.meta.url), png(size));
  console.log("ok", nombre);
}
