/**
 * Turns the raw generated renders in assets/source-renders into transparent,
 * uniformly-framed icons in public/brand/icons.
 *
 * Three problems to solve per image:
 *
 *  1. The generator stamps a sparkle watermark in a fixed 48x48 box at the
 *     bottom right. In 51 of 52 renders that box is pure background, so it is
 *     erased outright. In the one render where artwork reaches the corner
 *     (the compass plate) we key on "bright AND desaturated" instead, which
 *     hits the grey sparkle and leaves the dark plate and orange artwork.
 *
 *  2. The background must go. A luminance key would also eat the graphite
 *     parts of the objects, which are legitimately dark, so instead we flood
 *     fill inwards from the border: only background actually connected to the
 *     edge is removed, and dark pixels enclosed by the object survive.
 *
 *  3. The objects sit at different scales in frame. Each is trimmed to its
 *     content box and re-padded to a square with a constant margin, so a row
 *     of them reads as one set.
 */
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const SRC = "assets/source-renders";
const OUT = "public/brand/icons";

const WATERMARK = { x0: 890, y0: 890, x1: 953, y1: 953 };
/**
 * Render whose artwork reaches into the watermark box. Keying by colour
 * gouged the plate, so this one is repaired by mirroring the intact
 * bottom-left corner of the same plate into the damaged corner instead.
 */
const MIRROR_REPAIR = /^Compass_rose/i;

/**
 * Flood fill treats <= this as background. Set above the soft glow the
 * renderer puts around each object (roughly 23-45) so the halo is removed
 * rather than left as an opaque blob, but below the darkest real artwork
 * (the graphite plate reads 56-64).
 */
const BG_MAX_LUM = 48;
/**
  * Rendered at 320 and served as WebP. The largest on-screen use is 88px, so
  * 320 still covers a 3x display, and WebP with alpha is roughly a tenth the
  * size of the equivalent PNG for photographic content like these.
  */
const OUT_SIZE = 320;
const MARGIN = 0.06; // share of the output edge left empty

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/_?\d{12,}$/, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

/** Rough content bounds from a luminance scan, ignoring the watermark box. */
function roughBounds(data, W, H, C) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inWatermark =
        x >= WATERMARK.x0 - 12 && x <= WATERMARK.x1 + 12 &&
        y >= WATERMARK.y0 - 12 && y <= WATERMARK.y1 + 12;
      if (inWatermark) continue;
      const i = (y * W + x) * C;
      if (Math.max(data[i], data[i + 1], data[i + 2]) > BG_MAX_LUM) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * Erase the watermark in place on a raw RGB buffer.
 *
 * Default is a hard erase, which is exact because the box is pure background
 * in all but one render. For that one, the box is rebuilt from the mirror of
 * the object's intact opposite corner, which restores the rounded plate edge
 * the sparkle was sitting on.
 */
function eraseWatermark(data, W, H, C, mirrorRepair) {
  const b = mirrorRepair ? roughBounds(data, W, H, C) : null;

  for (let y = WATERMARK.y0; y <= WATERMARK.y1; y++) {
    for (let x = WATERMARK.x0; x <= WATERMARK.x1; x++) {
      const i = (y * W + x) * C;

      if (mirrorRepair) {
        const sx = Math.min(W - 1, Math.max(0, b.x0 + b.x1 - x));
        const si = (y * W + sx) * C;
        data[i] = data[si];
        data[i + 1] = data[si + 1];
        data[i + 2] = data[si + 2];
      } else {
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
}

/** Alpha mask: 0 for background reachable from the border, 255 elsewhere. */
function buildAlpha(data, W, H, C) {
  const alpha = new Uint8Array(W * H).fill(255);
  const seen = new Uint8Array(W * H);
  const stack = [];

  const lum = (idx) => {
    const i = idx * C;
    return Math.max(data[i], data[i + 1], data[i + 2]);
  };

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const idx = y * W + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    if (lum(idx) <= BG_MAX_LUM) {
      alpha[idx] = 0;
      stack.push(idx);
    }
  };

  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % W;
    const y = (idx - x) / W;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    push(x + 1, y + 1); push(x - 1, y - 1); push(x + 1, y - 1); push(x - 1, y + 1);
  }

  return alpha;
}

/**
 * Drops specks: opaque components too small to be real artwork. JPEG ringing
 * and stray highlights survive the flood fill as isolated dots, which read as
 * dirt once the background is transparent. Multi-part objects (two grips, a
 * cluster of pebbles) are safe because every real part is far larger than the
 * threshold.
 */
function removeSpecks(alpha, W, H, minPixels) {
  const seen = new Uint8Array(W * H);

  for (let start = 0; start < W * H; start++) {
    if (seen[start] || alpha[start] === 0) continue;

    const component = [];
    const stack = [start];
    seen[start] = 1;

    while (stack.length) {
      const idx = stack.pop();
      component.push(idx);
      const x = idx % W;
      const y = (idx - x) / W;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (seen[n] || alpha[n] === 0) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
    }

    if (component.length < minPixels) {
      for (const idx of component) alpha[idx] = 0;
    }
  }
}

function contentBox(alpha, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] > 8) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

async function processOne(file) {
  const src = path.join(SRC, file);
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;

  eraseWatermark(data, W, H, C, MIRROR_REPAIR.test(file));
  const alpha = buildAlpha(data, W, H, C);
  removeSpecks(alpha, W, H, Math.round(W * H * 0.0008));

  // Interleave into RGBA
  const rgba = Buffer.alloc(W * H * 4);
  for (let idx = 0; idx < W * H; idx++) {
    const i = idx * C;
    rgba[idx * 4] = data[i];
    rgba[idx * 4 + 1] = data[i + 1];
    rgba[idx * 4 + 2] = data[i + 2];
    rgba[idx * 4 + 3] = alpha[idx];
  }

  const box = contentBox(alpha, W, H);
  if (!box) throw new Error(`no content found in ${file}`);

  // Square crop around the content so nothing is distorted on resize
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const side = Math.max(bw, bh);
  const cx = box.x0 + bw / 2;
  const cy = box.y0 + bh / 2;
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);

  const inner = Math.round(OUT_SIZE * (1 - MARGIN * 2));
  const pad = Math.round((OUT_SIZE - inner) / 2);

  const cropped = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.min(side, W - Math.max(0, left)),
      height: Math.min(side, H - Math.max(0, top)),
    })
    // Soften the flood-fill's hard alpha edge back to something anti-aliased
    .blur(0.4)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    // raw input needs an explicit output format before buffering
    .png()
    .toBuffer();

  const slug = slugify(file);
  await sharp({
    create: {
      width: OUT_SIZE,
      height: OUT_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left: pad, top: pad }])
    .webp({ quality: 88, effort: 6, alphaQuality: 90 })
    .toFile(path.join(OUT, `${slug}.webp`));

  return slug;
}

const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png)$/i.test(f));
fs.mkdirSync(OUT, { recursive: true });

const slugs = [];
for (const f of files) slugs.push(await processOne(f));

console.log(`processed ${slugs.length} icons into ${OUT}`);
console.log(slugs.sort().join("\n"));
