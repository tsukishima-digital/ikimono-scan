import {
  photosRequiringAttribution,
  type SpecimenPhoto,
} from "./specimen-gallery";
import { speciesPhotos, type SpeciesPhoto } from "./species-photos";
import type { ModelClass } from "../inference/types";

const japaneseNameCollator = new Intl.Collator("ja", {
  sensitivity: "base",
  usage: "sort",
});

interface PhotoCredit {
  commonName: string;
  sortName?: string;
  photo: Pick<
    SpeciesPhoto | SpecimenPhoto,
    "attribution" | "license" | "licenseUrl" | "photoId" | "sourcePhotoUrl"
  >;
}

export function buildPhotoCredits(speciesClasses: ModelClass[]) {
  const creditsByPhotoId = new Map<number, PhotoCredit>();
  for (const specimen of photosRequiringAttribution) {
    creditsByPhotoId.set(specimen.photoId, {
      commonName: specimen.commonName,
      sortName: specimen.commonName,
      photo: specimen,
    });
  }
  for (const species of speciesClasses) {
    const photo = speciesPhotos[species.id];
    if (
      !photo ||
      photo.license === "CC0" ||
      creditsByPhotoId.has(photo.photoId)
    ) {
      continue;
    }
    creditsByPhotoId.set(photo.photoId, {
      commonName: species.commonName || species.scientificName,
      sortName: species.commonName,
      photo,
    });
  }
  return [...creditsByPhotoId.values()].sort((first, second) => {
    if (!first.sortName) {
      return second.sortName
        ? 1
        : first.commonName.localeCompare(second.commonName);
    }
    if (!second.sortName) return -1;
    return (
      japaneseNameCollator.compare(first.sortName, second.sortName) ||
      first.photo.photoId - second.photo.photoId
    );
  });
}
