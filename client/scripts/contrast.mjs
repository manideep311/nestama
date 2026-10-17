// WCAG 2.x contrast check for the NESTAMA palette.
// Usage: node scripts/contrast.mjs   (exits 1 if any text pair fails its threshold)

const palette = {
  forest: "#123D2F",
  orange: "#FF571F",
  cream: "#FFF8EF",
  white: "#FFFFFF",
  charcoal: "#202522",
  sage: "#E5EFE4",
  peach: "#FFE3D2",
  muted: "#5B625E", // secondary text
  orangeInk: "#B4380C", // orange used for text on light surfaces
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [foreground, background, minimum] — 4.5 normal text, 3 large text / UI glyphs
const pairs = [
  ["charcoal", "cream", 4.5],
  ["charcoal", "white", 4.5],
  ["charcoal", "sage", 4.5],
  ["charcoal", "peach", 4.5],
  ["charcoal", "orange", 4.5],
  ["muted", "cream", 4.5],
  ["muted", "white", 4.5],
  ["cream", "forest", 4.5],
  ["white", "forest", 4.5],
  ["forest", "sage", 4.5],
  ["forest", "peach", 4.5],
  ["forest", "cream", 4.5],
  ["orangeInk", "white", 4.5],
  ["orangeInk", "cream", 4.5],
  ["orangeInk", "peach", 4.5],
  ["white", "orangeInk", 4.5],
  ["orange", "forest", 3],
  ["white", "orange", 3],
];

let failed = 0;
for (const [fg, bg, min] of pairs) {
  const r = ratio(palette[fg], palette[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${fg.padEnd(10)} on ${bg.padEnd(10)} ${r.toFixed(2)}:1 (min ${min})`);
}
process.exit(failed ? 1 : 0);
