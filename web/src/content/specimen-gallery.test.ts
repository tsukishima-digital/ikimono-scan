import { describe, expect, it } from "vitest";

import { redistributedPhotos } from "./specimen-gallery";

describe("specimen gallery", () => {
  it("uses a bundled same-origin image for every specimen", () => {
    for (const specimen of redistributedPhotos) {
      const photoUrl = new URL(specimen.photoUrl, window.location.origin);
      expect(photoUrl.origin).toBe(window.location.origin);
      expect(photoUrl.pathname).toMatch(/\.jpg$/);
    }
  });

  it("keeps photo-level provenance for every redistributed image", () => {
    for (const specimen of redistributedPhotos) {
      expect(specimen.photoId).toBeGreaterThan(0);
      expect(specimen.sourcePhotoUrl).toMatch(
        new RegExp(`/photos/${specimen.photoId}/large\\.jpe?g$`),
      );
      expect(specimen.observationId).toBeGreaterThan(0);
      expect(specimen.attribution).not.toBe("");
      expect(["CC0", "CC BY"]).toContain(specimen.license);
      expect(specimen.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
    }
  });
});
