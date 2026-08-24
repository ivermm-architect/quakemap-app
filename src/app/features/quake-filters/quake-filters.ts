import { Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { QuakeRange } from '../../core/quake';

/**
 * QuakeFilters
 * Controles para filtrar los sismos que se muestran en el mapa.
 *  - Selector de rango temporal (última hora / día / semana).
 *  - Filtro por magnitud mínima (slider).
 * Ambos usan `model()` para two-way binding con el orquestador (App).
 */
@Component({
  selector: 'app-quake-filters',
  imports: [FormsModule],
  templateUrl: './quake-filters.html',
  styleUrl: './quake-filters.scss',
})
export class QuakeFilters {
  /** Rango temporal del feed de USGS. */
  readonly range = model<QuakeRange>('day');

  /** Magnitud mínima para mostrar un sismo (0–8). */
  readonly minMag = model<number>(0);
}
