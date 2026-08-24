import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Quake } from './quake-model.quake';

/** Rangos temporales soportados por los feeds de USGS. */
export type QuakeRange = 'hour' | 'day' | 'week';

/** Forma mínima de la respuesta GeoJSON de USGS que consumimos. */
interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    url: string;
  } | null;
  geometry: {
    coordinates: [number, number, number]; // [lon, lat, depth]
  } | null;
}

interface UsgsFeatureCollection {
  features: UsgsFeature[];
}

/**
 * QuakeService
 * Obtiene y normaliza los sismos recientes desde la API pública de USGS.
 *
 * Feeds GeoJSON (sin API key):
 *   .../summary/all_hour.geojson   (última hora)
 *   .../summary/all_day.geojson    (último día)
 *   .../summary/all_week.geojson   (última semana)
 * Base: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/
 */
@Injectable({
  providedIn: 'root',
})
export class QuakeService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl =
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/';

  /**
   * Descarga el feed correspondiente al rango y lo normaliza a `Quake[]`.
   * Descarta features sin coordenadas o sin magnitud y ordena por tiempo desc.
   */
  getQuakes(range: QuakeRange): Observable<Quake[]> {
    const url = `${this.baseUrl}all_${range}.geojson`;

    return this.http.get<UsgsFeatureCollection>(url).pipe(
      map((collection) => this.toQuakes(collection)),
    );
  }

  private toQuakes(collection: UsgsFeatureCollection): Quake[] {
    const features = collection?.features ?? [];

    return features
      .filter(
        (feature): feature is UsgsFeature & {
          properties: NonNullable<UsgsFeature['properties']> & { mag: number };
          geometry: NonNullable<UsgsFeature['geometry']>;
        } =>
          !!feature.properties &&
          !!feature.geometry &&
          typeof feature.properties.mag === 'number' &&
          Array.isArray(feature.geometry.coordinates) &&
          feature.geometry.coordinates.length >= 2,
      )
      .map((feature) => {
        const [longitude, latitude, depth] = feature.geometry.coordinates;
        return {
          id: feature.id,
          magnitude: feature.properties.mag,
          place: feature.properties.place ?? 'Ubicación desconocida',
          time: feature.properties.time,
          longitude,
          latitude,
          depth: depth ?? 0,
          url: feature.properties.url,
        } satisfies Quake;
      })
      .sort((a, b) => b.time - a.time);
  }
}
