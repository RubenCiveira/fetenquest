import { cargarHeroes, urlFichaVtt } from '../../lib/personajes'
import { jugadorDe, todosLosPersonajes, type AccionEjecutada, type AtaqueDeEscuadra, type ClaseDeEscuadra, type DescripcionPersonajeNoJugador, type Escuadra, type MapaEnJuego, type PersonajeEnJuego, type ProveedorPersonajes, type ResultadoAccion, type ResultadoActivacion } from '../gamemap'
import { JUGADOR_MONSTRUOS } from './configuracion'
import { PersonajeDePrueba, MOVER, type DialogosDePrueba } from './modelo/personaje'
import type { PuertasDePrueba } from './modelo/puerta'

/**
 * La activación de una escuadra de prueba está completa cuando a ninguno de sus
 * `personajes` (ids) le quedan acciones: cada uno se ha movido y además ha
 * hecho otra acción suya (deslizar, coger…). Las de la escuadra sin personaje
 * (cambiar de modo) no cuentan
 */
export const activacionDePrueba = (acciones: AccionEjecutada[], personajes: string[]): ResultadoActivacion => ({
  completo: personajes.every((id) => {
    const suyas = acciones.filter((a) => a.personaje === id)
    return suyas.some((a) => a.accion === MOVER.id) && suyas.some((a) => a.accion !== MOVER.id)
  }),
})

/**
 * Clase de una escuadra de prueba con los personajes de FetenQuest de esos ids
 * (`PersonajeDePrueba`, con su ficha VTT vista desde arriba y su cuerpo como
 * vida, que abren las puertas de `puertas`, usan los diálogos de
 * `dialogos` y tiran los dados con `azar`); empieza en modo sigiloso y su turno termina según
 * `activacionDePrueba`
 */
function escuadra(id: string, nombre: string, jugador: string, ids: string[], puertas: PuertasDePrueba, dialogos: DialogosDePrueba, azar: () => number): ClaseDeEscuadra {
  // las mismas clases de personaje cada vez
  let suyos: Promise<PersonajeDePrueba[]> | undefined
  return {
    id,
    nombre,
    jugador,
    personajes: () =>
      (suyos ??= cargarHeroes().then((todos) =>
        todos
          .filter((h) => ids.includes(h.id))
          .map((h) => new PersonajeDePrueba({ id: h.id, nombre: h.nombre, imagenVtt: urlFichaVtt('heroes', h.id, 'hombre', 'vtt-heroe'), vida: h.cuerpo }, puertas, dialogos, azar)),
      )),
    modoActivacion: async () => 'sigiloso',
    mostrarDetalle: (_mapa, personaje) => {
      void dialogos.avisar({ titulo: personaje?.nombre ?? nombre, texto: personaje ? `${personaje.nombre} (${personaje.id})` : nombre })
    },
    atacarEscuadra: (ataque, mapa) => atacarEscuadraDePrueba(ataque, mapa, dialogos),
    activar: async (acciones) => {
      const resultado = activacionDePrueba(acciones, ids)
      // banco de pruebas: se ve en la consola qué recibe y qué responde cada escuadra
      console.log(`[map-debug] activar ${id}`, acciones, resultado)
      return resultado
    },
  }
}

/** Dos escuadras de prueba, la de Ana con el bárbaro y la de Bruno con el enano, más las escuadras de monstruos elegidas */
/** Sin diálogos: los ataques no se resuelven y los avisos no se ven */
const sinDialogos: DialogosDePrueba = {
  resolverAtaque: () => Promise.reject(new Error('Este banco de pruebas no resuelve ataques')),
  repartirDano: () => Promise.reject(new Error('Este banco de pruebas no resuelve ataques')),
  avisar: async () => {},
}

/**
 * Ataque de escuadra contra escuadra del banco de pruebas: lo pinta en la
 * consola; si atacan monstruos a quien no lo es, hacen 1 de daño por atacante;
 * si no, se reparte el daño en un diálogo (`repartirDano`), se quita a cada
 * objetivo y se elimina a quien se queda sin vida. Tras él, a los atacantes no
 * les quedan acciones
 */
export async function atacarEscuadraDePrueba(ataque: AtaqueDeEscuadra, mapa: MapaEnJuego, dialogos: DialogosDePrueba): Promise<ResultadoAccion> {
  const { ataques, objetivos, sinAtacar } = ataque
  // banco de pruebas: se ve en la consola qué reúne el gestor en cada ataque de escuadra
  console.log('[map-debug] ataque de escuadra', { ataques: ataques.map((a) => `${a.atacante.nombre} → ${a.objetivo.nombre} (${a.tipo}, a ${a.distancia})`), objetivos: objetivos.map((p) => p.nombre), sinAtacar })
  const esMonstruo = (id: string) => jugadorDe(mapa.mapa, id)?.id === JUGADOR_MONSTRUOS
  if (ataques.every((a) => esMonstruo(a.atacante.id)) && !objetivos.some((p) => esMonstruo(p.id))) {
    const objetivo = objetivos[0]
    if (objetivo) {
      const motivo = mapa.reducirVida(objetivo.id, ataques.length)
      if (motivo) throw new Error(motivo)
      const vida = todosLosPersonajes(mapa.mapa).find((p) => p.id === objetivo.id)?.vida
      if (vida !== undefined && vida <= 0) mapa.eliminarPersonaje(objetivo.id)
    }
    await dialogos.avisar({ titulo: 'Ataque', texto: `${ataques.map((a) => a.atacante.nombre).join(', ')} ${ataques.length > 1 ? 'hacen' : 'hace'} ${ataques.length} de daño.` })
    return { quedanAcciones: false }
  }
  const reparto = await dialogos.repartirDano(ataque)
  for (const { id } of objetivos.filter((p) => (reparto[p.id] ?? 0) > 0)) {
    const motivo = mapa.reducirVida(id, reparto[id])
    if (motivo) throw new Error(motivo)
    const vida = todosLosPersonajes(mapa.mapa).find((p) => p.id === id)?.vida
    if (vida !== undefined && vida <= 0) mapa.eliminarPersonaje(id)
  }
  return { quedanAcciones: false }
}

export const escuadrasDePrueba = (
  puertas: PuertasDePrueba,
  escuadrasMonstruos: () => DescripcionPersonajeNoJugador[][] = () => [],
  dialogos: DialogosDePrueba = sinDialogos,
  azar: () => number = Math.random,
): ProveedorPersonajes => ({
  listarEscuadras: async () => [
    escuadra('escuadra-barbaro', 'Escuadra del bárbaro', 'ana', ['barbaro'], puertas, dialogos, azar),
    escuadra('escuadra-enano', 'Escuadra del enano', 'bruno', ['enano'], puertas, dialogos, azar),
    ...escuadrasMonstruos().map((personajes, i): ClaseDeEscuadra => {
      let suyos: PersonajeDePrueba[] | undefined
      return {
        id: `escuadra-monstruos-${i + 1}`,
        nombre: `Escuadra de monstruos ${i + 1}`,
        jugador: JUGADOR_MONSTRUOS,
        // los monstruos del dueño de la mazmorra, como los solitarios, no buscan trampas
        buscaTrampas: false,
        personajes: async () => (suyos ??= personajes.map((p) => new PersonajeDePrueba(p, puertas, dialogos, azar))),
        modoActivacion: async () => 'sigiloso',
        mostrarDetalle: (_mapa, personaje) => {
          void dialogos.avisar({ titulo: personaje?.nombre ?? `Escuadra de monstruos ${i + 1}`, texto: personaje ? `${personaje.nombre} (${personaje.id})` : `Escuadra de monstruos ${i + 1}` })
        },
        atacarEscuadra: (ataque, mapa) => atacarEscuadraDePrueba(ataque, mapa, dialogos),
        activar: async (acciones) => activacionDePrueba(acciones, personajes.map((p) => p.id)),
      }
    }),
  ],
})

/**
 * Lo que hace el banco de pruebas con los personajes que quedan fuera de la
 * coherencia de su escuadra al terminar su activación: los quita del mapa como
 * si hubieran muerto y lo avisa en un diálogo
 */
export function sinCoherenciaDePrueba(escuadra: Escuadra, fuera: PersonajeEnJuego[], mapa: MapaEnJuego, dialogos: DialogosDePrueba) {
  for (const { id } of fuera) mapa.eliminarPersonaje(id)
  const varios = fuera.length > 1
  return dialogos.avisar({
    titulo: 'Fuera de coherencia',
    texto: `${fuera.map((p) => p.nombre).join(' y ')} ${varios ? 'han quedado' : 'ha quedado'} fuera de la coherencia de ${escuadra.nombre} y ${varios ? 'desaparecen' : 'desaparece'}.`,
  })
}
