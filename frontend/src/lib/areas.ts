/**
 * Sample patient areas for the Chennai demo. Coordinates are approximate area centres used only
 * to compute straight-line distance in this academic prototype. Edit this list (or add areas) to
 * demonstrate other locations; the backend only ever receives latitude/longitude.
 */
export interface Area {
  name: string;
  latitude: number;
  longitude: number;
}

export const SAMPLE_AREAS: Area[] = [
  { name: "T. Nagar", latitude: 13.0418, longitude: 80.2341 },
  { name: "Anna Nagar", latitude: 13.085, longitude: 80.2101 },
  { name: "Tambaram", latitude: 12.9249, longitude: 80.1 },
  { name: "Perambur", latitude: 13.1167, longitude: 80.2329 },
  { name: "Porur", latitude: 13.033, longitude: 80.1525 },
  { name: "Adyar", latitude: 13.0012, longitude: 80.2565 },
  { name: "Velachery", latitude: 12.9815, longitude: 80.218 },
  { name: "Guindy", latitude: 13.0067, longitude: 80.2206 },
  { name: "Egmore", latitude: 13.0732, longitude: 80.2609 },
  { name: "Mylapore", latitude: 13.0368, longitude: 80.2676 },
  { name: "Chromepet", latitude: 12.9516, longitude: 80.1462 },
  { name: "Royapuram", latitude: 13.1137, longitude: 80.2954 },
];

export function findArea(name: string): Area | undefined {
  return SAMPLE_AREAS.find((a) => a.name === name);
}
