import type { AccionEjecutada } from './accionEjecutada'
import type { ModoAgresivoSigiloso } from './activacion'
import type { AtaqueDeEscuadra } from './ataque'
import type { ClaseDePersonaje } from './claseDePersonaje'
import type { MapaEnJuego } from './mapaEnJuego'
import type { PersonajeEnJuego } from './personajeEnJuego'
import type { ResultadoAccion } from './resultadoAccion'
import type { ResultadoActivacion } from './resultadoActivacion'

/** Grupo de personajes según lo define el proyecto: quiénes lo componen y cómo se activa */
export interface ClaseDeEscuadra {
  id: string
  nombre: string
  /** Id del jugador del que es, de los de la configuración */
  jugador: string
  /** Si sus personajes pueden buscar trampas (la acción «Buscar trampas» del gestor); sin decirlo, sí */
  buscaTrampas?: boolean
  personajes(): Promise<ClaseDePersonaje[]>
  /** Modo en que empieza, si la configuración permite modo agresivo o sigiloso */
  modoActivacion(): Promise<ModoAgresivoSigiloso>
  /**
   * Tras cada acción o movimiento, con las acciones que lleva ejecutadas en el
   * turno: si responde `completo`, el gestor termina su turno
   */
  activar(acciones: AccionEjecutada[]): Promise<ResultadoActivacion>
  /** Muestra el detalle de la escuadra o de uno de sus personajes, si el proyecto lo soporta */
  mostrarDetalle?(mapa: MapaEnJuego, personaje?: PersonajeEnJuego): void
  /**
   * Con `modoAtaque: 'escuadra'`, resuelve el ataque de sus personajes contra
   * la escuadra objetivo (un `Ataque` por atacante y los `objetivos`, de los
   * más cercanos a los más lejanos, para repartir el daño con
   * `mapa.reducirVida` y `mapa.eliminarPersonaje`). Resuelve con el estado
   * de los atacantes, que el gestor apunta a todos. Si falla o se cancela, no
   * se apunta. Sin él, sus personajes atacan uno a uno
   */
  atacarEscuadra?(ataque: AtaqueDeEscuadra, mapa: MapaEnJuego): Promise<ResultadoAccion>
}
