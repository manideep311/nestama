import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The default link preview: the intro film's opening frame (kitten and yarn on cream) with the logo
// in its empty space. Product pages use their own photo instead.
export const alt = "NESTAMA — Your True Friend. Premium dog and cat essentials.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [poster, logo] = await Promise.all([
  readFile(join(process.cwd(), "public/media/intro-poster.jpg"), "base64"),
  readFile(join(process.cwd(), "public/brand/nestama-logo.png"), "base64"),
]);

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#FFF8EF" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
      <img src={`data:image/jpeg;base64,${poster}`} alt="" width={1200} height={675} style={{ position: "absolute", top: -22, left: 0 }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 860,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={`data:image/png;base64,${logo}`} alt="" width={625} height={386} />
      </div>
    </div>,
    size,
  );
}
