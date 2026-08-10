import externalLinks from "./external-links.json";

export interface SpecimenPhoto {
  commonName: string;
  scientificName: string;
  photoUrl: string;
  observationId: number;
  attribution: string;
  license: string;
  licenseUrl: string;
  priority?: boolean;
}

export const specimenPhotos: SpecimenPhoto[] = [
  {
    commonName: "クビアカツヤカミキリ",
    scientificName: "Aromia bungii",
    photoUrl: externalLinks.specimenAromiaPhoto,
    observationId: 389254258,
    attribution: "renshuchu",
    license: "CC0",
    licenseUrl: externalLinks.licenseCc0,
    priority: true,
  },
  {
    commonName: "ナミテントウ",
    scientificName: "Harmonia axyridis",
    photoUrl: externalLinks.specimenHarmoniaPhoto,
    observationId: 388316828,
    attribution: "りなべる",
    license: "CC BY",
    licenseUrl: externalLinks.licenseCcBy,
  },
  {
    commonName: "ルリボシカミキリ",
    scientificName: "Rosalia batesi",
    photoUrl: externalLinks.specimenRosaliaPhoto,
    observationId: 378294423,
    attribution: "Jie-Hao Ou",
    license: "CC BY",
    licenseUrl: externalLinks.licenseCcBy,
  },
];
