import { describe, expect, it } from "vitest";

import { specimenPhotos } from "./specimen-gallery";

const trackedAssets = Object.keys(
  import.meta.glob("../../public/specimens/*.jpg", { eager: true }),
).map((path) => path.replace("../../public", ""));

describe("specimen gallery", () => {
  it("serves every specimen from a tracked same-origin asset", () => {
    for (const specimen of specimenPhotos) {
      expect(specimen.photoUrl).toMatch(/^\/specimens\/[a-z0-9-]+\.jpg$/);
      expect(trackedAssets).toContain(specimen.photoUrl);
    }
  });

  it("keeps photo-level provenance for every redistributed image", () => {
    for (const specimen of specimenPhotos) {
      expect(specimen.photoId).toBeGreaterThan(0);
      expect(specimen.sourcePhotoUrl).toContain(
        `/photos/${specimen.photoId}/large.jpg`,
      );
      expect(specimen.observationId).toBeGreaterThan(0);
      expect(specimen.attribution).not.toBe("");
      expect(["CC0", "CC BY"]).toContain(specimen.license);
      expect(specimen.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
    }
  });
});
