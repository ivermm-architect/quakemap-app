import { Component, ElementRef, effect, inject, input, output } from '@angular/core';

import { Quake } from '../../core/quake-model.quake';

/**
 * QuakeList
 * Histórico lateral de sismos. Cada elemento es clickeable y se sincroniza
 * con el mapa (resalta el seleccionado y hace scroll hasta él).
 */
@Component({
  selector: 'app-quake-list',
  imports: [],
  templateUrl: './quake-list.html',
})
export class QuakeList {
  /** Sismos ya filtrados y ordenados. */
  readonly quakes = input<Quake[]>([]);

  /** Id seleccionado (para resaltar y desplazar hasta él). */
  readonly selectedId = input<string | null>(null);

  /** Emite el id del sismo al hacer clic. */
  readonly select = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    // Desplaza el elemento seleccionado a la vista cuando cambia la selección
    // (p. ej. al hacer clic en un marcador del mapa).
    effect(() => {
      const id = this.selectedId();
      if (!id) return;
      queueMicrotask(() => {
        const el = this.host.nativeElement.querySelector(
          `[data-id="${CSS.escape(id)}"]`,
        );
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
  }

  /** Color del badge según los bins de magnitud (coherente con el mapa). */
  magColor(magnitude: number): string {
    if (magnitude < 2) return '#94a3b8'; // slate (recede)
    if (magnitude < 4) return '#facc15'; // amarillo
    if (magnitude < 5) return '#f59e0b'; // ámbar
    if (magnitude < 6) return '#f97316'; // naranja
    return '#ef4444'; // rojo (resalta)
  }

  formatTime(time: number): string {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(time));
  }
}
