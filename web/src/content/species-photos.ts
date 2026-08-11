import catalog from "./species-photos.json";

export interface SpeciesPhoto {
  photoUrl: string;
  photoId: number;
  observationId: number;
  sourcePhotoUrl: string;
  attribution: string;
  license: "CC0" | "CC BY" | "CC BY-NC";
  licenseUrl: string;
  width: number;
  height: number;
}

export const speciesPhotos = catalog.photos as Record<string, SpeciesPhoto>;

export const speciesPhotosRequiringAttribution = Object.values(
  speciesPhotos,
).filter(({ license }) => license !== "CC0");
