import { todosLosPersonajes } from './activaciones'
import { motivoParaNoColocar } from './elementos'
import { dimensionesDe, type Tamano } from './huella'
import type { Aparicion } from './modelo/aparicion'
import type { Casilla } from './modelo/casilla'
import type { DescripcionPersonajeNoJugador } from './modelo/descripcionPersonaje'
import type { Objeto } from './modelo/elemento'
import type { Estancia } from './modelo/estancia'
import type { Mapa } from './modelo/mapa'
import type { PersonajeNoJugador } from './modelo/personajeNoJugador'

/** Hueco que ocupa un personaje (su huella, según su tamaño y hacia dónde mira), para buscar sitio a otro sin que se pisen */
export const huecoDePersonaje = ({ id, nombre, ...tamano }: { id: string; nombre: string } & Tamano, posicion?: Casilla): Objeto => ({
  id: `personaje-${id}`,
  tipo: 'objeto',
  nombre,
  ...dimensionesDe(tamano),
  posicion,
})

/**
 * Casilla de la estancia donde aparece un personaje según su aparición: la
 * casilla que pide o una al azar (con `azar`, entre 0 y 1) de su zona o de toda
 * la estancia. Tiene que estar libre: dentro, sin puerta ni terreno impasable,
 * sin objeto, fuera de las estancias interiores y sin otro personaje. Nada si
 * no hay sitio
 */
export function sitioParaPersonaje(m: Mapa, estancia: Estancia, { casilla, zona }: Aparicion, azar: () => number = Math.random, tamano: Tamano = {}): Casilla | undefined {
  const ocupada = todosLosPersonajes(m)
    .filter((p) => p.estancia === estancia.id && p.casilla)
    .map((p) => huecoDePersonaje(p, p.casilla))
  const conOcupadas = { ...estancia, elementos: [...estancia.elementos, ...ocupada] }
  const libre = (c: Casilla) => !motivoParaNoColocar(conOcupadas, huecoDePersonaje({ id: 'nuevo', nombre: 'nuevo', ...tamano }), c)
  if (casilla) return libre(casilla) ? casilla : undefined
  const { posicion, columnas, filas } = zona ?? { posicion: { x: 0, y: 0 }, columnas: estancia.columnas, filas: estancia.filas }
  const candidatas = Array.from({ length: columnas * filas }, (_, i) => ({ x: posicion.x + (i % columnas), y: posicion.y + Math.floor(i / columnas) })).filter(libre)
  return candidatas.length ? candidatas[Math.min(candidatas.length - 1, Math.floor(azar() * candidatas.length))] : undefined
}

/**
 * Añade a la estancia los personajes no jugadores descritos, uno tras otro
 * (cada uno ve ocupadas las casillas de los anteriores): en su sitio según su
 * aparición o, si no lo hay, en la zona de espera. Falla si la estancia no
 * está en el mapa o un id ya lo tiene otro personaje
 */
export function anadirPersonajesNoJugadores(
  m: Mapa,
  estanciaId: string,
  descripciones: DescripcionPersonajeNoJugador[],
  azar: () => number = Math.random,
): { mapa: Mapa; anadidos: PersonajeNoJugador[] } {
  const estancia = m.estancias.find((e) => e.id === estanciaId)
  if (!estancia) throw new Error(`No hay ninguna estancia «${estanciaId}» en el mapa`)
  return descripciones.reduce<{ mapa: Mapa; anadidos: PersonajeNoJugador[] }>(
    ({ mapa, anadidos }, { id, nombre, imagenVtt, vida, jugador, largo, ancho, ...aparicion }) => {
      if (todosLosPersonajes(mapa).some((p) => p.id === id)) throw new Error(`Ya hay un personaje «${id}» en el mapa`)
      const tamano = { ...(largo && largo > 1 && { largo }), ...(ancho && ancho > 1 && { ancho }) }
      const casilla = sitioParaPersonaje(mapa, estancia, aparicion, azar, tamano)
      const nuevo: PersonajeNoJugador = { id, nombre, ...(imagenVtt && { imagenVtt }), estancia: estanciaId, ...(casilla && { casilla }), ...(vida !== undefined && { vida, vidaMax: vida }), ...tamano, turnos: [], jugador }
      return { mapa: { ...mapa, personajesNoJugadores: [...(mapa.personajesNoJugadores ?? []), nuevo] }, anadidos: [...anadidos, nuevo] }
    },
    { mapa: m, anadidos: [] },
  )
}
