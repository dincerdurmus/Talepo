/**
 * PNG ÖLÇÜMÜ — KANIT KARESİNİ SAYIYA ÇEVİRİR (2026-09-25).
 *
 * NEDEN VAR. "Maira'nın yüzü küçük kutuda seçilmiyor" bir görüş değil,
 * ölçülebilir bir iddiadır: tuvalde mürekkebin kutunun neresinde ve ne
 * kadarını kapladığı sayılabilir. Ekran görüntüsüne bakıp "iyi görünüyor"
 * demek kanıt değildir; bu modül kareden mürekkep sınırlarını çıkarır ve
 * kadraj kararını sayıya bağlar.
 *
 * YENİ BAĞIMLILIK YOK. Node'un kendi `zlib`i ile PNG çözülür (8 bit, renk
 * tipi 2/6 — Chrome'un ürettiği kareler bu ikisidir). Tam bir PNG çözücü
 * değildir ve öyle olmaya çalışmaz: tanımadığı bir biçimde sessizce doğru
 * sonuç uydurmak yerine hata atar.
 */
const zlib = require("zlib");

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced png not supported");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png: depth=${bitDepth} color=${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      const v = line[x];
      let value;
      if (filter === 0) value = v;
      else if (filter === 1) value = v + a;
      else if (filter === 2) value = v + b;
      else if (filter === 3) value = v + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`unknown png filter ${filter}`);
      cur[x] = value & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/**
 * Beyaz zeminde MÜREKKEBİN sınırları. Eşik, beyazdan uzaklıktır: sahnenin
 * teal çizgileri ve yer tutucu halkaları yakalanır, arkadaki çok soluk ışık
 * alanı yakalanmaz.
 */
function inkBounds(img, threshold = 34) {
  const { width, height, channels, data } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width * channels + x * channels;
      const alpha = channels === 4 ? data[i + 3] : 255;
      if (alpha < 128) continue;
      const distance =
        255 - Math.min(data[i], Math.min(data[i + 1], data[i + 2]));
      if (distance < threshold) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    return { empty: true, width, height, coverage: 0 };
  }
  return {
    empty: false,
    width,
    height,
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    /** Kutunun yüksekliğinin ne kadarını kaplıyor (0–1). */
    heightRatio: (maxY - minY + 1) / height,
    /** Mürekkep kütlesinin dikey merkezi (0 üst, 1 alt). */
    centerY: (minY + maxY) / 2 / height,
    /** Eşiği geçen piksel oranı. */
    coverage: count / (width * height),
  };
}

module.exports = { decodePng, inkBounds };
