import { describe, expect, it } from "vitest";
import imageLoader from "./image-loader";

describe("imageLoader", () => {
  it("resizes Unsplash photos with imgix params, keeping an existing fit", () => {
    expect(imageLoader({ src: "https://images.unsplash.com/photo-1", width: 640 })).toBe(
      "https://images.unsplash.com/photo-1?w=640&q=75&auto=format&fit=crop",
    );
    expect(imageLoader({ src: "https://images.unsplash.com/photo-1?fit=max", width: 320, quality: 60 })).toBe(
      "https://images.unsplash.com/photo-1?fit=max&w=320&q=60&auto=format",
    );
  });

  it("injects a Cloudinary transformation after /upload/", () => {
    expect(imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/v1/nestama/a.png", width: 828 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_75,w_828,c_limit/v1/nestama/a.png",
    );
  });

  it("tags local uploads with the width so next/image accepts the loader", () => {
    expect(imageLoader({ src: "/uploads/2026-10/abc.png", width: 96 })).toBe("/uploads/2026-10/abc.png?w=96");
  });

  it("leaves other assets alone", () => {
    expect(imageLoader({ src: "/brand/logo.svg", width: 256 })).toBe("/brand/logo.svg");
  });
});
