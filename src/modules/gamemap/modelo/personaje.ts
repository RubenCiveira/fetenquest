import type { Casilla } from './casilla'
import type { MovimientoHecho } from './movimientoHecho'
import type { Direccion } from './direccion'

/**
 * Lo que ha hecho un personaje en un turno: sus acciones (sin contar moverse),
 * sus movimientos y, tras su última acción, si su clase dijo que aún le
 * quedaban acciones
 */
export type TurnoDePersonaje = { numero: number; acciones: string[]; movimientos: MovimientoHecho[]; quedanAcciones?: boolean }

/**
 * Estado de un personaje en el mapa, que guarda el gestor: dónde está (la
 * estancia y su casilla en ella; sin casilla, en la zona de espera de la
 * estancia), los puntos de vida que le quedan (sin ellos, no se lleva la
 * cuenta) y sus turnos
 */
export type Personaje = {
  id: string
  nombre: string
  imagenVtt?: string
  estancia: string
  casilla?: Casilla
  vida?: number
  /** Puntos de vida con los que empezó; si no está, se usa `vida` como máximo */
  vidaMax?: number
  turnos: TurnoDePersonaje[]
  /** Marcas de estado del personaje que cambian durante la partida (aturdido…) */
  flags?: string[]
  /** Hacia dónde mira (su encaramiento); sin ella, aún no ha girado: `ORIENTACION_INICIAL` */
  orientacion?: Direccion
  /**
   * Casillas que ocupa hacia donde mira (`largo`) y de lado (`ancho`); sin
   * ellas, una. Su `casilla` es la esquina superior izquierda de las que
   * ocupa (su huella), que gira con él
   */
  largo?: number
  ancho?: number
}
