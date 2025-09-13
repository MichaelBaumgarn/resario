export type BBox = { xmin: number; ymin: number; xmax: number; ymax: number };
export type Detection = { score: number; label: string; box: BBox };
