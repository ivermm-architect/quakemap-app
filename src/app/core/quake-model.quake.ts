/**
 * Representa un sismo ya normalizado desde la respuesta GeoJSON de USGS.
 * Sugerencia de campos: ajústalos según tu implementación.
 *
 * Endpoint USGS (GeoJSON, sin API key):
 *   https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
 * Cada "feature" trae: properties.mag, properties.place, properties.time,
 * geometry.coordinates = [lon, lat, depth].
 */
export interface Quake {
  id: string;
  magnitude: number;
  place: string;
  time: number; // timestamp en ms
  longitude: number;
  latitude: number;
  depth: number; // km
  url: string; // enlace al detalle en USGS
}
