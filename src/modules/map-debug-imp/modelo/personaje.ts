import {
  jugadorDe,
  numeroDeTurno,
  todosLosPersonajes,
  turnoDePersonaje,
  type Ataque,
  type AtaqueDeEscuadra,
  type ClaseDePersonaje,
  type Comando,
  type MapaEnJuego,
  type MovimientoGastado,
  type OpcionesMovimiento,
  type OpcionMovimiento,
  type Personaje,
  type PersonajeEnJuego,
  type ResultadoAccion,
  type ResultadoAlEntrar,
  type Ubicacion,
} from '../../gamemap'
import { JUGADOR_MONSTRUOS } from '../configuracion'
import { CogerObjeto } from './cogerObjeto'
import type { AccionDeObjeto } from './objeto'
import type { PuertasDePrueba } from './puerta'
import { RevisarMueble } from './revisarMueble'

export const MOVER = { id: 'mover', nombre: 'Mover', icono: '🥾' }

/** Cómo se decide el daño de un ataque (el diálogo del banco de pruebas); se rechaza si se cancela */
export type ResolverAtaque = (ataque: Ataque) => Promise<number>

/** Cómo se reparte el daño de un ataque de escuadra (el diálogo del banco de pruebas): el daño a cada objetivo, por su id; se rechaza si se cancela */
export type RepartirDano = (ataque: AtaqueDeEscuadra) => Promise<Record<string, number>>

/** Diálogos del banco de pruebas que usa un personaje: decidir el daño de un ataque, repartir el de un ataque de escuadra y avisar de algo (se resuelve al cerrarlo) */
export type DialogosDePrueba = { resolverAtaque: ResolverAtaque; repartirDano: RepartirDano; avisar: (aviso: { titulo: string; texto: string }) => Promise<void> }

/**
 * Hasta cuántas casillas ataca cada personaje de prueba (`Ataque.distancia`,
 * según la medición del movimiento): el bárbaro a menos de 2 y el enano hasta
 * 5; los demás, solo a 1
 */
export const ALCANCE_DE_PRUEBA: Record<string, number> = { barbaro: 1, enano: 5 }

/** Personajes de prueba que pueden volar: el bárbaro */
export const VUELAN = ['barbaro']

/**
 * Volar: 4 casillas sin que le afecte el terreno (el impasable lo cruza como
 * si fuera normal) y por encima de los muros interiores (no de sus puertas
 * cerradas ni del muro de la estancia); gasta su propia acción
 */
export const VOLAR: OpcionMovimiento = {
  id: 'volar',
  nombre: 'Volar',
  tipo: 'normal',
  accion: { id: 'volar', nombre: 'Volar', icono: '🪽' },
  tramos: [{ distancia: 4 }],
  terreno: { dificil: 1, 'muy-dificil': 1, impasable: 1 },
  cruzaMuros: true,
}

/** Probabilidad de pisar una trampa al entrar en cada casilla de una estancia en la que no se han buscado trampas */
export const PROBABILIDAD_DE_TRAMPA = 0.3

/** Probabilidad de que la lava de prueba detenga el movimiento al entrar */
export const PROBABILIDAD_DETENERSE_EN_LAVA = 0.5

/** Un personaje de prueba hace una acción por turno (moverse no cuenta): tras ella, ya no le quedan */
const TRAS_SU_ACCION: ResultadoAccion = { quedanAcciones: false }
const DESLIZAR = { id: 'deslizar', nombre: 'Deslizar', icono: '💨' }

/** Casillas del movimiento de un personaje de prueba */
const MOVIMIENTO = 6

/**
 * Cómo se mueve un personaje de prueba: 6 casillas, 8 para cargar contra un
 * enemigo (sin estar trabado, cruzando su zona de control), 6 más 3
 * deslizando (otra acción) o, trabado en cuerpo a cuerpo, 6 para destrabarse
 * (salir de la zona de control enemiga) o para posicionarse (pegado a quien
 * lo traba)
 */
export const MOVIMIENTO_DE_PRUEBA: OpcionesMovimiento = {
  base: { id: 'mover', nombre: 'Mover', tipo: 'normal', accion: MOVER, tramos: [{ distancia: MOVIMIENTO }] },
  variaciones: [
    { id: 'cargar', nombre: 'Cargar', tipo: 'carga', accion: { id: 'cargar', nombre: 'Cargar', icono: '🐂' }, tramos: [{ distancia: 8 }], terminarJuntoAEnemigo: true },
    {
      id: 'mover-y-deslizar',
      nombre: 'Mover y deslizar',
      tipo: 'normal',
      accion: MOVER,
      tramos: [{ distancia: MOVIMIENTO }, { distancia: 3, accion: DESLIZAR }],
    },
    { id: 'destrabarse', nombre: 'Destrabarse', tipo: 'destrabarse', accion: { id: 'destrabarse', nombre: 'Destrabarse', icono: '🏃' }, tramos: [{ distancia: MOVIMIENTO }] },
    { id: 'posicionarse', nombre: 'Posicionarse', tipo: 'posicionarse', accion: { id: 'posicionarse', nombre: 'Posicionarse', icono: '🤺' }, tramos: [{ distancia: MOVIMIENTO }] },
  ],
}

/** La opción con `casillas` menos en su primer tramo (lo que ya gastó al encararse) */
const descontada = (opcion: OpcionMovimiento, casillas: number): OpcionMovimiento => ({
  ...opcion,
  tramos: opcion.tramos.map((t, i) => (i ? t : { ...t, distancia: Math.max(0, t.distancia - casillas) })),
})

/**
 * Cómo puede moverse un personaje de prueba tras lo que ya ha movido este turno:
 * - sin moverse, `MOVIMIENTO_DE_PRUEBA`; si solo se ha encarado (girar sin
 *   moverse no apunta ninguna acción), todo eso menos lo que le costó girar:
 *   encararse es parte del movimiento;
 * - si ya se ha movido, lo que le quede de mover más deslizar 3 y, si solo se
 *   ha movido de forma normal (`mover`) o una carga parcial, también cargar
 *   con lo que le quede de la carga; tras posicionarse o destrabarse, ya no carga;
 * - si ya ha deslizado, no puede moverse más
 */
export function movimientoDePrueba({ casillas, acciones }: MovimientoGastado): OpcionesMovimiento | undefined {
  if (acciones.includes(DESLIZAR.id)) return
  if (!acciones.length) return casillas ? { base: descontada(MOVIMIENTO_DE_PRUEBA.base, casillas), variaciones: MOVIMIENTO_DE_PRUEBA.variaciones.map((v) => descontada(v, casillas)) } : MOVIMIENTO_DE_PRUEBA
  const quedan = Math.max(0, MOVIMIENTO - casillas)
  const [cargar, deslizar] = MOVIMIENTO_DE_PRUEBA.variaciones
  const quedaCarga = descontada(cargar, casillas)
  const puedeSeguirCargando = acciones.every((a) => a === MOVER.id || a === cargar.accion.id) && quedaCarga.tramos[0].distancia > 0
  return {
    base: { ...MOVIMIENTO_DE_PRUEBA.base, tramos: [{ distancia: quedan }] },
    variaciones: [...(puedeSeguirCargando ? [quedaCarga] : []), { ...deslizar, tramos: [{ distancia: quedan }, { distancia: 3, accion: DESLIZAR }] }],
  }
}

/**
 * Clase de un personaje del mapa de prueba: se mueve según `movimientoDePrueba`
 * y hace una acción por turno. Ofrece las acciones de los objetos de su
 * casilla (abrir la puerta que pisa…), revisar cada mueble sin revisar y coger
 * cada objeto que tiene al lado, y ataca hasta su alcance si no hay terreno
 * bloqueante en medio; si ya no le queda su acción, al intentarlo lo avisa en
 * un diálogo y no la hace. Al moverse, si no es un monstruo, puede pisar una
 * trampa (`alEntrar`)
 */
export class PersonajeDePrueba implements ClaseDePersonaje {
  readonly id: string
  readonly nombre: string
  readonly imagenVtt?: string
  readonly vida?: number
  readonly largo?: number
  readonly ancho?: number
  #puertas: PuertasDePrueba
  #dialogos: DialogosDePrueba
  /** De dónde salen las tiradas de dado (entre 0 y 1) */
  #azar: () => number

  constructor(
    { id, nombre, imagenVtt, vida, largo, ancho }: Pick<ClaseDePersonaje, 'id' | 'nombre' | 'imagenVtt' | 'vida' | 'largo' | 'ancho'>,
    puertas: PuertasDePrueba,
    dialogos: DialogosDePrueba,
    azar: () => number = Math.random,
  ) {
    this.id = id
    this.nombre = nombre
    this.imagenVtt = imagenVtt
    this.vida = vida
    this.largo = largo
    this.ancho = ancho
    this.#puertas = puertas
    this.#dialogos = dialogos
    this.#azar = azar
  }

  /** Casillas hasta las que ataca (`ALCANCE_DE_PRUEBA`) */
  get alcance() {
    return ALCANCE_DE_PRUEBA[this.id] ?? 1
  }

  /**
   * No ataca si ya ha usado su acción del turno (otra acción, como abrir una
   * puerta, o deslizar). Trabado en cuerpo a cuerpo, solo ataca a uno de los
   * que lo traban (si no le llega, tiene que posicionarse en contacto); y no
   * ataca más allá de su alcance ni si la trayectoria cruza terreno bloqueante
   */
  motivoParaNoAtacar({ atacante, objetivo, distancia, trayectoria }: Ataque, mapa: MapaEnJuego): string | undefined {
    const { acciones, movimientos } = turnoDePersonaje(atacante, numeroDeTurno(mapa.mapa))
    if (acciones.length || movimientos.some((m) => m.acciones.includes(DESLIZAR.id))) return `${this.nombre} ya ha usado su acción este turno`
    const loTraban = atacante.trabadoPor()
    if (loTraban.length && !loTraban.some((p) => p.id === objetivo.id)) {
      return `${this.nombre} está trabado: solo puede atacar a ${loTraban.map((p) => p.nombre).join(' o ')}`
    }
    if (distancia > this.alcance && loTraban.length) return `${this.nombre} tiene que posicionarse en contacto con ${objetivo.nombre} para atacarle`
    if (distancia > this.alcance) return `${this.nombre} solo ataca hasta ${this.alcance} ${this.alcance === 1 ? 'casilla' : 'casillas'} y ${objetivo.nombre} está a ${distancia}`
    if (trayectoria.coberturas.bloqueante) return `Hay terreno bloqueante entre ${this.nombre} y ${objetivo.nombre}`
  }

  /** `movimientoDePrueba` y, si vuela (`VUELAN`) y aún no se ha movido (encararse no cuenta, pero se descuenta), `VOLAR` detrás de cargar */
  async opcionesMovimiento(_personaje: Personaje, gastado: MovimientoGastado) {
    const opciones = movimientoDePrueba(gastado)
    if (!opciones || !VUELAN.includes(this.id) || gastado.acciones.length) return opciones
    const [cargar, ...resto] = opciones.variaciones
    return { ...opciones, variaciones: [cargar, descontada(VOLAR, gastado.casillas), ...resto] }
  }

  async acciones(personaje: Personaje, mapa: MapaEnJuego): Promise<Comando[]> {
    if (!personaje.casilla) return []
    const alLado = mapa.dameLoQueEstaAlLado(personaje)
    const deObjetos: AccionDeObjeto[] = [
      ...this.#puertas.objetosEn({ estancia: personaje.estancia, casilla: personaje.casilla }).flatMap((objeto) => objeto.acciones(mapa)),
      ...alLado.flatMap((el) => (el.tipo === 'mueble' && !el.flags?.includes('revisado') ? [new RevisarMueble(el, mapa)] : [])),
      ...alLado.flatMap((el) => (el.tipo === 'objeto' ? [new CogerObjeto(el, mapa)] : [])),
    ]
    return deObjetos.map((accion) => ({
      id: accion.id,
      nombre: accion.nombre,
      icono: accion.icono,
      exec: async () => {
        await this.#gastarAccion(mapa)
        await accion.hacer()
        return TRAS_SU_ACCION
      },
    }))
  }

  /**
   * Pinta en la consola lo que el gestor dice del ataque (tipo, distancias,
   * trayectoria con las coberturas que cruza y si el atacante y el objetivo
   * están trabados y con qué apoyos) y, si aún le queda su acción del turno:
   * un monstruo hace 1 de daño a un héroe; en otro caso, pide el daño del
   * ataque (`resolverAtaque`: el diálogo del banco de pruebas), se lo quita al
   * objetivo y, si se queda sin vida, lo elimina del mapa
   */
  async atacar(ataque: Ataque, mapa: MapaEnJuego): Promise<ResultadoAccion> {
    const { atacante, objetivo, tipo, distancia, recorrido, trayectoria } = ataque
    // banco de pruebas: se ve en la consola qué calcula el gestor de cada ataque
    console.log(`[map-debug] ${atacante.nombre} ataca a ${objetivo.nombre}`, {
      tipo,
      distancia,
      recorrido,
      casillas: trayectoria.casillas.map(({ x, y }) => `${x},${y}`).join(' → '),
      aliados: trayectoria.aliados,
      enemigos: trayectoria.enemigos,
      coberturas: trayectoria.coberturas,
      objetos: trayectoria.objetos,
      muros: trayectoria.muros,
      atacanteTrabado: atacante.estaTrabado(),
      // los propios personajes en juego, para poder navegarlos en la consola
      apoyosDelAtacante: atacante.conApoyos(),
      objetivoTrabado: objetivo.estaTrabado(),
      apoyosDelObjetivo: objetivo.conApoyos(),
    })
    await this.#gastarAccion(mapa)
    const esMonstruo = (id: string) => jugadorDe(mapa.mapa, id)?.id === JUGADOR_MONSTRUOS
    if (esMonstruo(atacante.id) && !esMonstruo(objetivo.id)) {
      const motivo = mapa.reducirVida(objetivo.id, 1)
      if (motivo) throw new Error(motivo)
      await this.#dialogos.avisar({ titulo: 'Ataque', texto: `${atacante.nombre} ataca a ${objetivo.nombre}: hace 1 de daño.` })
      return TRAS_SU_ACCION
    }
    const motivo = mapa.reducirVida(objetivo.id, await this.#dialogos.resolverAtaque(ataque))
    if (motivo) throw new Error(motivo)
    const vida = todosLosPersonajes(mapa.mapa).find((p) => p.id === objetivo.id)?.vida
    if (vida !== undefined && vida <= 0) mapa.eliminarPersonaje(objetivo.id)
    return TRAS_SU_ACCION
  }

  /**
   * Terreno y trampas de prueba: la lava avisa siempre y puede detener el
   * movimiento; un héroe que entra en una casilla de una estancia en la que
   * nadie ha buscado trampas (sin `sin_trampas`) pisa una trampa con
   * `PROBABILIDAD_DE_TRAMPA`. Los monstruos no pisan trampas. Cada llamada se
   * ve en la consola
   */
  async alEntrar(personaje: PersonajeEnJuego, donde: Ubicacion, mapa: MapaEnJuego): Promise<ResultadoAlEntrar> {
    const terreno = donde.terreno ?? mapa.terrenoEn(donde)
    if (terreno?.efecto === 'lava') {
      await this.#dialogos.avisar({ titulo: 'Lava', texto: `${personaje.nombre} ha entrado en lava: le va a hacer daño.` })
      const resultado: ResultadoAlEntrar = this.#azar() < PROBABILIDAD_DETENERSE_EN_LAVA ? 'terminar-turno' : 'seguir'
      if (resultado === 'terminar-turno') await this.#dialogos.avisar({ titulo: 'Lava', texto: `${personaje.nombre} tiene que pararse.` })
      console.log(`[map-debug] alEntrar: ${personaje.nombre} en ${donde.casilla.x},${donde.casilla.y} de «${donde.estancia}»`, { terreno: terreno.efecto, resultado })
      return resultado
    }
    const sinPeligro = jugadorDe(mapa.mapa, personaje.id)?.id === JUGADOR_MONSTRUOS || mapa.tieneFlag('estancia', donde.estancia, 'sin_trampas')
    const pisaTrampa = !sinPeligro && this.#azar() < PROBABILIDAD_DE_TRAMPA
    if (pisaTrampa) await this.#dialogos.avisar({ titulo: '¡Trampa!', texto: `${personaje.nombre} ha pisado una trampa: se detiene aquí.` })
    const resultado: ResultadoAlEntrar = pisaTrampa ? 'detenerse' : 'seguir'
    // banco de pruebas: se ve en la consola cada vez que el gestor pregunta al entrar en una casilla
    console.log(`[map-debug] alEntrar: ${personaje.nombre} en ${donde.casilla.x},${donde.casilla.y} de «${donde.estancia}»`, { sinPeligro, resultado })
    return resultado
  }

  /**
   * Comprueba, con su estado de ahora en el mapa, que aún le queda su acción
   * del turno; si no, lo avisa en un diálogo y, al cerrarlo, se cancela (la
   * acción no se hace ni se apunta)
   */
  async #gastarAccion(mapa: MapaEnJuego) {
    const yo = todosLosPersonajes(mapa.mapa).find((p) => p.id === this.id)
    if (!yo || !turnoDePersonaje(yo, numeroDeTurno(mapa.mapa)).acciones.length) return
    await this.#dialogos.avisar({ titulo: 'Sin acciones', texto: `${this.nombre} ya ha hecho su acción de este turno.` })
    throw new DOMException(`${this.nombre} no tiene acciones`, 'AbortError')
  }
}
