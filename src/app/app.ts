import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';

import { QuakeFilters } from './features/quake-filters/quake-filters';
import { QuakeMap } from './features/quake-map/quake-map';
import { QuakeList } from './features/quake-list/quake-list';
import { AuthGate } from './features/auth/auth';
import { QuakeService, QuakeRange } from './core/quake';
import { AuthService } from './core/auth';
import { Quake } from './core/quake-model.quake';

type SortMode = 'time' | 'mag';

@Component({
  selector: 'app-root',
  imports: [QuakeFilters, QuakeMap, QuakeList, AuthGate],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly service = inject(QuakeService);
  private readonly auth = inject(AuthService);

  protected readonly title = signal('QuakeMap');

  /** Estado de sesión para el "gate" (undefined=cargando, null=fuera, User=dentro). */
  protected readonly user = this.auth.user;

  /** Menú de usuario (avatar → desplegable). */
  protected readonly menuOpen = signal(false);

  /** Foto de perfil (Google) si existe. */
  protected readonly avatarUrl = computed(() => this.user()?.photoURL ?? null);

  /** Nombre visible: displayName (Google) o el correo. */
  protected readonly displayName = computed(
    () => this.user()?.displayName ?? this.user()?.email ?? '',
  );

  /** Iniciales para el avatar cuando no hay foto. */
  protected readonly initials = computed(() => {
    const source = this.user()?.displayName ?? this.user()?.email ?? '';
    return source.slice(0, 2).toUpperCase() || '?';
  });

  /** Estado de los filtros (two-way con <app-quake-filters>). */
  protected readonly range = signal<QuakeRange>('day');
  protected readonly minMag = signal<number>(0);

  /** Orden del histórico. */
  protected readonly sort = signal<SortMode>('time');

  /** Sismo seleccionado (sincroniza histórico ↔ mapa). */
  protected readonly selectedId = signal<string | null>(null);

  /** Datos y estado de la petición. */
  protected readonly quakes = signal<Quake[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Filtra por magnitud mínima (en cliente) y ordena según `sort`. */
  protected readonly filtered = computed(() => {
    const min = this.minMag();
    const mode = this.sort();
    const list = this.quakes().filter((q) => q.magnitude >= min);
    return [...list].sort((a, b) =>
      mode === 'mag' ? b.magnitude - a.magnitude : b.time - a.time,
    );
  });

  /** Estadísticas de cabecera. */
  protected readonly stats = computed(() => {
    const list = this.filtered();
    const maxMag = list.reduce((max, q) => Math.max(max, q.magnitude), 0);
    return { count: list.length, maxMag };
  });

  constructor() {
    // Recarga los datos cuando cambia el rango (solo con sesión iniciada).
    effect((onCleanup) => {
      if (!this.user()) return;
      const range = this.range();
      this.loading.set(true);
      this.error.set(null);

      const sub = this.service.getQuakes(range).subscribe({
        next: (quakes) => {
          this.quakes.set(quakes);
          this.selectedId.set(null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar los sismos. Inténtalo de nuevo.');
          this.quakes.set([]);
          this.loading.set(false);
        },
      });

      onCleanup(() => sub.unsubscribe());
    });
  }

  protected onSelect(id: string): void {
    this.selectedId.set(id);
  }

  protected toggleMenu(event: MouseEvent): void {
    // Evita que este clic llegue al listener de documento y cierre el menú.
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  /** Cierra el menú al hacer clic en cualquier parte fuera del botón. */
  @HostListener('document:click')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }

  /** Color de severidad por magnitud (coherente con el mapa y la leyenda). */
  protected magColor(magnitude: number): string {
    if (magnitude < 2) return '#94a3b8';
    if (magnitude < 4) return '#facc15';
    if (magnitude < 5) return '#f59e0b';
    if (magnitude < 6) return '#f97316';
    return '#ef4444';
  }
}
