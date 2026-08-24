import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

import { Quake } from '../../core/quake-model.quake';

/**
 * QuakeMap
 * Mapa vectorial en la paleta de marca (sin tiles raster):
 *  - Océano  = fondo del contenedor (#051F20).
 *  - Tierra  = países GeoJSON con relleno #0B2B26 y borde #235347.
 * Sobre él, un `circleMarker` por sismo cuyo color/radio comunican la magnitud.
 *
 * Sincroniza selección con el histórico del sidebar:
 *  - `selectedId` (input): vuela, resalta (anillo mint) y abre el popup.
 *  - `select` (output): emite el id al hacer clic en un marcador.
 */
@Component({
  selector: 'app-quake-map',
  imports: [],
  templateUrl: './quake-map.html',
  styleUrl: './quake-map.scss',
})
export class QuakeMap implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);

  /** Sismos ya filtrados que se deben pintar. */
  readonly quakes = input<Quake[]>([]);

  /** Id del sismo seleccionado desde el histórico (para enfocarlo). */
  readonly selectedId = input<string | null>(null);

  /** Emite el id del sismo cuando se hace clic en su marcador. */
  readonly select = output<string>();

  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('map');

  private map?: L.Map;
  private markers = L.layerGroup();
  private markersById = new Map<string, L.CircleMarker>();
  private colorById = new Map<string, string>();

  /** Renderer SVG dedicado a los sismos (en su pane, siempre sobre los países). */
  private quakeRenderer?: L.SVG;

  private highlighted?: { id: string; marker: L.CircleMarker };

  /** Observa el tamaño del contenedor para revalidar el mapa al redimensionar. */
  private resizeObserver?: ResizeObserver;

  /** Límites de un solo mundo (sin repeticiones ni océano vacío). */
  private readonly worldBounds = L.latLngBounds([-85, -180], [85, 180]);

  constructor() {
    // Repinta cuando cambian los sismos (solo si el mapa ya existe).
    effect(() => {
      const quakes = this.quakes();
      if (this.map) {
        this.renderQuakes(quakes);
      }
    });

    // Enfoca el sismo seleccionado desde el histórico.
    effect(() => {
      const id = this.selectedId();
      if (this.map && id) {
        this.focusQuake(id);
      }
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl().nativeElement, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      // Acota el mapa a un solo mundo: sin saltos ni océano vacío duplicado.
      maxBounds: this.worldBounds,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      attributionControl: true,
    });

    // Panes con orden explícito: los países quedan por debajo y los sismos
    // por encima, para que el relleno de los países nunca tape los marcadores.
    this.map.createPane('countries');
    this.map.getPane('countries')!.style.zIndex = '300';
    this.map.createPane('quakes');
    this.map.getPane('quakes')!.style.zIndex = '450';

    // Renderer SVG anclado al pane de sismos.
    this.quakeRenderer = L.svg({ pane: 'quakes' });

    // Capa de países vectorial con la paleta de marca (pane inferior).
    this.http
      .get<GeoJSON.FeatureCollection>('data/countries.geo.json')
      .subscribe((world) => {
        L.geoJSON(world, {
          pane: 'countries',
          style: () => ({
            fillColor: '#0f2033',
            fillOpacity: 1,
            color: '#1f4368',
            weight: 0.6,
          }),
          attribution: '&copy; Natural Earth · Datos: USGS',
        }).addTo(this.map!);
      });

    this.markers.addTo(this.map);

    // El mundo debe cubrir siempre el contenedor (evita ver vacío al arrastrar).
    this.coverWorld();

    // Al cambiar el tamaño del contenedor (móvil↔escritorio, banner de alerta…)
    // recalcula el zoom mínimo de cobertura y revalida el mapa.
    this.resizeObserver = new ResizeObserver(() => this.coverWorld());
    this.resizeObserver.observe(this.mapEl().nativeElement);

    // Primer render con los datos disponibles.
    this.renderQuakes(this.quakes());
  }

  /**
   * Fija el zoom mínimo para que el mundo cubra por completo el contenedor
   * (efecto "cover"). Así el viewport siempre queda dentro del mapa y no se
   * revela vacío al arrastrar, ni quedan franjas de océano a los lados.
   */
  private coverWorld(): void {
    if (!this.map) return;
    this.map.invalidateSize();
    const coverZoom = this.map.getBoundsZoom(this.worldBounds, true);
    this.map.setMinZoom(coverZoom);
    if (this.map.getZoom() < coverZoom) {
      this.map.setZoom(coverZoom);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  private renderQuakes(quakes: Quake[]): void {
    this.markers.clearLayers();
    this.markersById.clear();
    this.colorById.clear();
    this.highlighted = undefined;

    for (const quake of quakes) {
      const color = this.colorFor(quake.magnitude);
      const marker = L.circleMarker([quake.latitude, quake.longitude], {
        pane: 'quakes',
        renderer: this.quakeRenderer,
        radius: this.radiusFor(quake.magnitude),
        color,
        fillColor: color,
        fillOpacity: 0.65,
        weight: 1.5,
      });

      marker.bindTooltip(
        `${this.escape(quake.place)} · M${quake.magnitude.toFixed(1)}`,
        { direction: 'top', className: 'quake-tooltip', opacity: 1 },
      );
      marker.bindPopup(this.popupFor(quake));
      marker.on('click', () => this.select.emit(quake.id));

      this.markers.addLayer(marker);
      this.markersById.set(quake.id, marker);
      this.colorById.set(quake.id, color);
    }
  }

  private focusQuake(id: string): void {
    const marker = this.markersById.get(id);
    if (!marker || !this.map) return;

    // Restaura el estilo del marcador previamente resaltado.
    if (this.highlighted && this.highlighted.id !== id) {
      const prevColor = this.colorById.get(this.highlighted.id) ?? '#94a3b8';
      this.highlighted.marker.setStyle({ color: prevColor, weight: 1.5 });
    }

    // Anillo claro para el seleccionado.
    marker.setStyle({ color: '#e2f1ff', weight: 3 });
    marker.bringToFront();
    this.highlighted = { id, marker };

    const target = marker.getLatLng();
    this.map.flyTo(target, Math.max(this.map.getZoom(), 5), { duration: 0.6 });
    marker.openPopup();
  }

  /** Radio escalado por magnitud (mínimo visible incluso para mag pequeñas). */
  private radiusFor(magnitude: number): number {
    return Math.max(4, magnitude * 3);
  }

  /**
   * Escala on-brand: los sismos bajos receden en tono marca (sage) y los
   * fuertes resaltan en rojo, marcando las zonas importantes.
   */
  private colorFor(magnitude: number): string {
    if (magnitude < 2) return '#94a3b8'; // slate (recede)
    if (magnitude < 4) return '#facc15'; // amarillo
    if (magnitude < 5) return '#f59e0b'; // ámbar
    if (magnitude < 6) return '#f97316'; // naranja
    return '#ef4444'; // rojo (resalta)
  }

  private popupFor(quake: Quake): string {
    const when = new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(quake.time));

    return `
      <div class="quake-popup">
        <strong>${this.escape(quake.place)}</strong><br />
        Magnitud: <b>${quake.magnitude.toFixed(1)}</b><br />
        Profundidad: ${quake.depth.toFixed(1)} km<br />
        Hora: ${when}<br />
        <a href="${quake.url}" target="_blank" rel="noopener">Ver en USGS</a>
      </div>
    `;
  }

  /** Evita inyección de HTML en el popup/tooltip a partir de `place`. */
  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
