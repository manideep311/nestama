# Brand assets — provenance & regeneration

Source: the NESTAMA brand film supplied by the project owner (`gemini_generated_video_b046fc68.mp4`, 10.0 s, 1280×720, H.264 + AAC).

## Intro film (`client/public/media/`)

The intro plays the **whole film, silently and full screen**, and ends on the logo end card. The frame it stops on (frame 238, t ≈ 9.92 s) is the exact frame the logo was cut from, so the player can lay the cut-out pieces over the video pixel-for-pixel and fly them into the header logo.

| File               | How it was made                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intro-1280.mp4`   | `ffmpeg -i source.mp4 -t 9.95 -an -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart intro-1280.mp4` (239 frames, ≈1.17 MB, no audio stream) |
| `intro-854.mp4`    | same, plus `-vf scale=854:-2 -crf 24`, served to screens ≤ 900 px via `<source media>` (≈0.5 MB)                                                                  |
| `intro-poster.jpg` | `ffmpeg -ss 0 -i source.mp4 -frames:v 1 -q:v 3 intro-poster.jpg`                                                                                                  |

Check after re-encoding: the last frame must match `logo-frame.png` (PSNR ≈ 42 dB is encoding noise only).

Behaviour lives in `client/src/components/loader/InitialLoadingScreen.tsx` (styles in `animations.css`):

- First visit per session only, never with `prefers-reduced-motion` or Save-Data; `?intro=1` replays it.
- Full bleed: the video box is always 16:9 and covers the viewport. On narrow or portrait screens, where that would crop the logo, the camera pulls back from 8.2 s with soft edges, so the end card fits.
- The caption hides once the logo forms (7.6 s). On `ended`, the mark, wordmark and tagline cut-outs are placed over the frame, held for a beat, then flown into the header's `[data-intro-target]` elements while the cream backdrop clears. The header logo stays hidden (`html[data-intro-logo="hold"]`) until they land.
- Skip button or Escape fades it out instead. So do blocked autoplay and no progress for 3 s of _visible_ time; a background tab pauses the film rather than ending it.
- The site is `inert` while the intro is up. If the player script never runs, CSS removes the overlay after 6 s.

Piece rectangles in the 1280×720 frame (from the cut-out's trim offsets):

| Piece    | x   | y   | w   | h   |
| -------- | --- | --- | --- | --- |
| mark     | 425 | 102 | 433 | 300 |
| wordmark | 254 | 405 | 781 | 144 |
| tagline  | 399 | 556 | 472 | 29  |

## Logo (`client/public/brand/`, `client/src/app/{icon,apple-icon}.png`, `favicon.ico`)

The owner chose the film frame at **t = 9.9 s** as the logo: `ffmpeg -ss 9.9 -i source.mp4 -frames:v 1 logo-frame.png`.

It was cut out of its cream background (`#f0ebd8`) with a small sharp script:

- **Wordmark / tagline** — flat green on cream, so a colour key with a soft edge band (distance 16–64) and colour decontamination (removes the cream fringe from anti-aliased edges). `*-light` variants recolour the same alpha to cream `#FFF8EF` for dark backgrounds.
- **House mark** — flood fill from the crop edges plus an explicit seed band under the roof, so the enclosed house interior turns transparent while the cat's white muzzle and paws (similar in colour to the background) are never touched.
- **App icons** — the mark on a cream rounded square (512 px `icon.png`, 180 px `apple-icon.png`, 16/32 px PNG-in-ICO `favicon.ico`).

| File                                              | Use                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `nestama-mark.webp` (433×300)                     | header/footer mark                                                           |
| `nestama-wordmark.webp` / `-light.webp` (781×144) | header / footer wordmark                                                     |
| `nestama-tagline.webp` / `-light.webp` (472×29)   | large placements (the header renders the tagline as live text for crispness) |
| `nestama-logo.webp` / `.png` (781×483)            | full stacked lockup                                                          |
