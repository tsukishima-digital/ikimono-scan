import aromiaBungiiPhoto from "../assets/specimens/aromia-bungii-712990656.jpg";
import chlorophorusQuinquefasciatusPhoto from "../assets/specimens/chlorophorus-quinquefasciatus-129999042.jpg";
import harmoniaAxyridisPhoto from "../assets/specimens/harmonia-axyridis-711179139.jpg";
import rosaliaBatesiPhoto from "../assets/specimens/rosalia-batesi-691864486.jpg";
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

const featuredSpecimenPhoto: SpecimenPhoto = {
  commonName: "クビアカツヤカミキリ",
  scientificName: "Aromia bungii",
  photoUrl: aromiaBungiiPhoto,
  photoId: 712990656,
  sourcePhotoUrl: externalLinks.specimenAromiaPhoto,
  observationId: 389254258,
  attribution: "renshuchu",
  license: "CC0",
  licenseUrl: externalLinks.licenseCc0,
  designation: "特定外来生物",
};

export const photoGuideExample: SpecimenPhoto = {
  commonName: "ヨツスジトラカミキリ",
  scientificName: "Chlorophorus quinquefasciatus",
  photoUrl: chlorophorusQuinquefasciatusPhoto,
  photoId: 129999042,
  sourcePhotoUrl: externalLinks.photoGuidePhoto,
  observationId: 79369950,
  attribution: "no rights reserved",
  license: "CC0",
  licenseUrl: externalLinks.licenseCc0,
};

export const specimenPhotos: SpecimenPhoto[] = [
  featuredSpecimenPhoto,
  {
    commonName: "ナミテントウ",
    scientificName: "Harmonia axyridis",
    photoUrl: harmoniaAxyridisPhoto,
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
    photoUrl: rosaliaBatesiPhoto,
    photoId: 691864486,
    sourcePhotoUrl: externalLinks.specimenRosaliaPhoto,
    observationId: 378294423,
    attribution: "Jie-Hao Ou",
    license: "CC BY",
    licenseUrl: externalLinks.licenseCcBy,
  },
];

export const photosRequiringAttribution = specimenPhotos.filter(
  ({ license }) => license !== "CC0",
);

export const redistributedPhotos = [photoGuideExample, ...specimenPhotos];
