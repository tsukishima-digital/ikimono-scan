import externalLinks from "./external-links.json";

export interface SpecimenPhoto {
  commonName: string;
  scientificName: string;
  photoUrl: string;
  photoId: number;
  sourcePhotoUrl: string;
  observationId: number;
  attribution: string;
  license: string;
  licenseUrl: string;
  designation?: "特定外来生物";
}

export const featuredSpecimenPhoto: SpecimenPhoto = {
  commonName: "クビアカツヤカミキリ",
  scientificName: "Aromia bungii",
  photoUrl: "/specimens/aromia-bungii-712990656.jpg",
  photoId: 712990656,
  sourcePhotoUrl: externalLinks.specimenAromiaPhoto,
  observationId: 389254258,
  attribution: "renshuchu",
  license: "CC0",
  licenseUrl: externalLinks.licenseCc0,
  designation: "特定外来生物",
};

export const specimenPhotos: SpecimenPhoto[] = [
  featuredSpecimenPhoto,
  {
    commonName: "ナミテントウ",
    scientificName: "Harmonia axyridis",
    photoUrl: "/specimens/harmonia-axyridis-711179139.jpg",
    photoId: 711179139,
    sourcePhotoUrl: externalLinks.specimenHarmoniaPhoto,
    observationId: 388316828,
    attribution: "りなべる",
    license: "CC BY",
    licenseUrl: externalLinks.licenseCcBy,
  },
  {
    commonName: "ルリボシカミキリ",
    scientificName: "Rosalia batesi",
    photoUrl: "/specimens/rosalia-batesi-691864486.jpg",
    photoId: 691864486,
    sourcePhotoUrl: externalLinks.specimenRosaliaPhoto,
    observationId: 378294423,
    attribution: "Jie-Hao Ou",
    license: "CC BY",
    licenseUrl: externalLinks.licenseCcBy,
  },
];
