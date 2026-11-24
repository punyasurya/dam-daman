/**
 * Topologi papan dam-daman versi Jawa:
 * persegi 5x5 bergaris diagonal (pola alquerque) dan dua "gunungan"
 * segitiga di tengah sisi atas dan bawah. Total 37 titik.
 *
 * Koordinat (c, r): c = kolom 0..4, r = baris 0..8.
 *   baris 0 : c 0, 2, 4      (gunungan atas, baris terluar)
 *   baris 1 : c 1, 2, 3      (gunungan atas)
 *   baris 2-6 : c 0..4       (persegi)
 *   baris 7 : c 1, 2, 3      (gunungan bawah)
 *   baris 8 : c 0, 2, 4      (gunungan bawah, baris terluar)
 */

export interface Point {
  readonly id: number;
  readonly c: number;
  readonly r: number;
}

const rowCols: number[][] = [
  [0, 2, 4],
  [1, 2, 3],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4],
  [1, 2, 3],
  [0, 2, 4],
];

export const ROWS = 9;
export const POINTS: readonly Point[] = (() => {
  const pts: Point[] = [];
  rowCols.forEach((cols, r) => cols.forEach((c) => pts.push({ id: pts.length, c, r })));
  return pts;
})();

export const POINT_COUNT = POINTS.length; // 37

const idAt = new Map<string, number>();
for (const p of POINTS) idAt.set(`${p.c},${p.r}`, p.id);

export function pointAt(c: number, r: number): number {
  const id = idAt.get(`${c},${r}`);
  if (id === undefined) throw new Error(`Tidak ada titik di (${c},${r})`);
  return id;
}

export function hasPoint(c: number, r: number): boolean {
  return idAt.has(`${c},${r}`);
}

/** Setiap garis lurus di papan, sebagai urutan titik (koordinat). */
const LINE_COORDS: Array<Array<[number, number]>> = [
  // Mendatar
  [[0, 0], [2, 0], [4, 0]],
  [[1, 1], [2, 1], [3, 1]],
  ...[2, 3, 4, 5, 6].map((r) => [0, 1, 2, 3, 4].map((c) => [c, r] as [number, number])),
  [[1, 7], [2, 7], [3, 7]],
  [[0, 8], [2, 8], [4, 8]],
  // Tegak
  ...[0, 1, 3, 4].map((c) => [2, 3, 4, 5, 6].map((r) => [c, r] as [number, number])),
  [0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => [2, r] as [number, number]),
  // Diagonal utama persegi
  [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]],
  [[4, 2], [3, 3], [2, 4], [1, 5], [0, 6]],
  // Sisi gunungan yang menyambung ke sisi belah ketupat di persegi
  [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
  [[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]],
  [[0, 8], [1, 7], [2, 6], [3, 5], [4, 4]],
  [[4, 8], [3, 7], [2, 6], [1, 5], [0, 4]],
];

export const LINES: readonly (readonly number[])[] = LINE_COORDS.map((line) =>
  line.map(([c, r]) => pointAt(c, r)),
);

/**
 * Untuk setiap titik: daftar "sinar" (ray), yaitu titik-titik berurutan
 * sepanjang satu garis lurus ke satu arah, mulai dari tetangga terdekat.
 */
export const RAYS: readonly (readonly (readonly number[])[])[] = (() => {
  const rays: number[][][] = POINTS.map(() => []);
  for (const line of LINES) {
    line.forEach((id, i) => {
      if (i < line.length - 1) rays[id].push(line.slice(i + 1));
      if (i > 0) rays[id].push(line.slice(0, i).reverse());
    });
  }
  return rays;
})();

export const NEIGHBORS: readonly (readonly number[])[] = RAYS.map((rays) => rays.map((ray) => ray[0]));

/** Pasangan titik yang terhubung garis (untuk menggambar papan). */
export const EDGES: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (const line of LINES) for (let i = 0; i < line.length - 1; i++) out.push([line[i], line[i + 1]]);
  return out;
})();
