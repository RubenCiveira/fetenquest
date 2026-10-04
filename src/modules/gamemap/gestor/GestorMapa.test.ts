import { describe, expect, it, vi } from 'vitest'
import { activacionDe, activacionDeNoJugador, numeroDeTurno, turnoDeEscuadra, turnoDePersonaje } from '../activaciones'
import type { Accion } from '../modelo/accion'
import type { AccionEjecutada } from '../modelo/accionEjecutada'
import type { Ataque, AtaqueDeEscuadra } from '../modelo/ataque'
import type { ResultadoAccion } from '../modelo/resultadoAccion'
import type { ResultadoAlEntrar } from '../modelo/resultadoAlEntrar'
import type { Ubicacion } from '../modelo/ubicacion'
import type { Casilla } from '../modelo/casilla'
import type { ClaseDeEscuadra } from '../modelo/claseDeEscuadra'
import type { Coherencia } from '../modelo/coherencia'
import type { Configuracion } from '../modelo/configuracion'
import type { HuecoDelTurno } from '../modelo/ordenDelTurno'
import type { Escuadra } from '../modelo/escuadra'
import type { DescripcionEstancia } from '../modelo/descripcionEstancia'
import type { Direccion } from '../modelo/direccion'
import type { Estancia } from '../modelo/estancia'
import type { Personaje } from '../modelo/personaje'
import type { PersonajeEnJuego } from '../modelo/personajeEnJuego'
import type { Jugador } from '../modelo/jugador'
import type { Mapa } from '../modelo/mapa'
import type { MapaEnJuego } from '../modelo/mapaEnJuego'
import type { MovimientoGastado } from '../modelo/movimientoGastado'
import type { OpcionesMovimiento } from '../modelo/opcionesMovimiento'
import { gastadoPor, ruta } from '../movimiento'
import { GestorMapa } from './GestorMapa'
import type { Jugadores } from '../modelo/jugadores'

/** Reparto de prueba: Ana (rojos y azules) de los Héroes y la Oscuridad (IA) de los Monstruos, hostiles hacia los Héroes */
const REPARTO: Jugadores = {
  alianzas: [
    { id: 'heroes', nombre: 'Héroes' },
    { id: 'monstruos', nombre: 'Monstruos', posturas: { heroes: 'hostil' } },
  ],
  jugadores: [
    { id: 'j1', nombre: 'Ana', tipo: 'humano', alianza: 'heroes' },
    { id: 'oscuridad', nombre: 'La Oscuridad', tipo: 'ia', alianza: 'monstruos' },
  ],
}

const sala: DescripcionEstancia = {
  tipo: 'sala',
  tamano: { columnas: 4, filas: 3 },
  orientacion: 'abajo',
  salidas: 1,
  elementos: [{ tipo: 'objeto', nombre: 'Cofre', columnas: 1, filas: 1 }],
}
/** Sala amplia y vacía para moverse */
const amplia: DescripcionEstancia = { ...sala, tamano: { columnas: 12, filas: 8 }, elementos: [] }

const mover = { id: 'mover', nombre: 'Mover', icono: '🥾' }
const deslizar = { id: 'deslizar', nombre: 'Deslizar', icono: '💨' }
const opciones: OpcionesMovimiento = {
  base: { id: 'mover', nombre: 'Mover', tipo: 'normal', accion: mover, tramos: [{ distancia: 2 }] },
  variaciones: [{ id: 'mover-y-deslizar', nombre: 'Mover y deslizar', tipo: 'normal', accion: mover, tramos: [{ distancia: 2 }, { distancia: 1, accion: deslizar }] }],
}

/** Comando del bárbaro, con su código */
const gritar = { id: 'gritar', nombre: 'Gritar', icono: '📣', exec: vi.fn(async (): Promise<ResultadoAccion> => ({ quedanAcciones: true })) }

/**
 * Proveedor de prueba: los rojos (el bárbaro, que puede gritar, con 4 de
 * vida) empiezan agresivos y los azules (el enano, sin acciones) sigilosos;
 * con la `coherencia` de escuadra que se diga (sin ella, ninguna).
 * Todos atacan con `atacar`, que no hace nada si no se cambia
 */
function proveedor(descripcion = sala, conElfo = false, coherencia?: Coherencia) {
  const acciones = vi.fn(async (_personaje: PersonajeEnJuego, _mapa: MapaEnJuego): Promise<Accion[]> => [gritar])
  const opcionesMovimiento = vi.fn(async (_personaje: PersonajeEnJuego, _gastado: MovimientoGastado) => opciones)
  const activar = vi.fn(async (_acciones: AccionEjecutada[]) => ({ completo: false }))
  const atacar = vi.fn(async (_ataque: Ataque, _mapa: MapaEnJuego): Promise<ResultadoAccion> => ({ quedanAcciones: false }))
  const motivoParaNoAtacar = vi.fn((_ataque: Ataque, _mapa: MapaEnJuego): string | undefined => undefined)
  const alEntrar = vi.fn(async (_personaje: PersonajeEnJuego, _donde: Ubicacion, _mapa: MapaEnJuego): Promise<ResultadoAlEntrar> => 'seguir')
  const barbaro = { id: 'barbaro', nombre: 'Bárbaro', imagenVtt: 'barbaro.png', vida: 4, opcionesMovimiento, acciones, atacar, motivoParaNoAtacar, alEntrar }
  const elfo = { id: 'elfo', nombre: 'Elfo', opcionesMovimiento, acciones: async () => [], atacar, motivoParaNoAtacar }
  const enano = { id: 'enano', nombre: 'Enano', opcionesMovimiento, acciones: async () => [], atacar, motivoParaNoAtacar }
  return {
    configuracion: {
      ordenActivaciones: 'alternas',
      modosActivacion: 'agresivo-sigiloso',
      medicionMovimiento: 'ortogonal',
      terrenoPersonajes: 'normal',
      distanciaControl: 0,
      cuerpoACuerpo: 'diagonal',
      coherencia: coherencia?.modo ?? 'ninguna',
      distanciaCoherencia: coherencia?.distancia ?? 0,
      modoAtaque: 'uno-a-uno',
      apoyoALaCarga: 0,
      ajusteDelDefensor: 0,
      consolidacionTrasCombate: 0,
      retrocesoTrasCombate: 0,
      costeGiro: 0,
      costeGiroDiagonal: 0,
      jugadores: REPARTO,
    } as const,
    confirmar: vi.fn(async (_mensaje: string) => true),
    describirEstancia: vi.fn(async (_mapa?: Mapa, _entrada?: Direccion) => descripcion),
    estanciaCreada: vi.fn((_estancia: Estancia, _mapa: MapaEnJuego) => {}),
    turnoDe: vi.fn((_jugador: Jugador, _mapa: MapaEnJuego) => {}),
    finDeTurno: vi.fn((_mapa: MapaEnJuego) => {}),
    escuadraSinCoherencia: vi.fn((_escuadra: Escuadra, _fuera: PersonajeEnJuego[], _mapa: MapaEnJuego) => {}),
    listarEscuadras: vi.fn(async (): Promise<ClaseDeEscuadra[]> => [
      { id: 'rojos', nombre: 'Rojos', jugador: 'j1', personajes: async () => (conElfo ? [barbaro, elfo] : [barbaro]), modoActivacion: async () => 'agresivo', activar },
      { id: 'azules', nombre: 'Azules', jugador: 'j1', personajes: async () => [enano], modoActivacion: async () => 'sigiloso', activar },
    ]),
    acciones,
    opcionesMovimiento,
    activar,
    atacar,
    motivoParaNoAtacar,
    alEntrar,
  }
}

/** Gestor con la estancia inicial creada, el proveedor y el estado del bárbaro */
async function conInicial(descripcion = sala, conElfo = false, coherencia?: Coherencia) {
  const p = proveedor(descripcion, conElfo, coherencia)
  const gestor = new GestorMapa(p)
  await gestor.nuevaEstancia()
  const barbaro = () => gestor.mapa.escuadras?.[0].personajes[0] ?? { id: '', nombre: '', estancia: '', turnos: [] }
  const elfo = () => gestor.mapa.escuadras?.[0].personajes[1] ?? { id: '', nombre: '', estancia: '', turnos: [] }
  return { gestor, p, barbaro, elfo }
}

/** Recorrido de `pasos` casillas hacia la derecha desde una casilla */
const enLinea = (desde: Casilla | undefined, pasos: number) =>
  Array.from({ length: pasos + 1 }, (_, i) => ({ x: (desde?.x ?? 0) + i, y: desde?.y ?? 0 }))

describe('gestor del mapa: estancias y escuadras', () => {
  it('en la primera estancia, el proveedor no recibe mapa', async () => {
    const { p } = await conInicial()
    expect(p.describirEstancia.mock.lastCall?.[0]).toBeUndefined()
  })

  it('en las siguientes, el proveedor recibe el mapa ya construido', async () => {
    const { gestor, p } = await conInicial()
    const construido = gestor.mapa
    await gestor.nuevaEstancia()
    expect(p.describirEstancia.mock.lastCall?.[0]).toBe(construido)
  })

  it('añade cada estancia nueva al mapa con un id propio', async () => {
    const { gestor } = await conInicial()
    await gestor.nuevaEstancia()
    expect(gestor.mapa.estancias.map((e) => e.id)).toEqual(['estancia-1', 'estancia-2'])
  })

  it('si el proveedor rechaza, el mapa no cambia', async () => {
    const gestor = new GestorMapa({ ...proveedor(), describirEstancia: () => Promise.reject(new Error('cancelada')) })
    await expect(gestor.nuevaEstancia()).rejects.toThrow('cancelada')
    expect(gestor.mapa.estancias).toEqual([])
  })

  it('avisa de cada cambio a quien se suscribe', async () => {
    const gestor = new GestorMapa(proveedor())
    const aviso = vi.fn()
    gestor.suscribir(aviso)
    await gestor.nuevaEstancia()
    expect(aviso).toHaveBeenCalledWith(gestor.mapa)
  })

  it('la estancia inicial crea el estado de cada escuadra con sus personajes, en el turno 1', async () => {
    const { gestor } = await conInicial()
    expect([numeroDeTurno(gestor.mapa), gestor.mapa.escuadras?.map((e) => [e.id, e.personajes.map((h) => h.id), e.turnos])]).toEqual([
      1,
      [
        ['rojos', ['barbaro'], []],
        ['azules', ['enano'], []],
      ],
    ])
  })

  it('cada personaje queda en la estancia inicial, en una casilla libre y con su imagen', async () => {
    const { barbaro } = await conInicial()
    expect(barbaro()).toMatchObject({ nombre: 'Bárbaro', imagenVtt: 'barbaro.png', estancia: 'estancia-1', casilla: expect.any(Object), turnos: [] })
  })

  it('los personajes no se colocan encima de objetos ni de otros personajes', async () => {
    const { gestor } = await conInicial()
    const casillas = [...gestor.mapa.estancias[0].elementos.map((el) => el.posicion), ...(gestor.mapa.escuadras?.flatMap((e) => e.personajes.map((h) => h.casilla)) ?? [])]
    expect(new Set(casillas.map((c) => `${c?.x},${c?.y}`)).size).toBe(3)
  })

  it('con modo agresivo o sigiloso, cada escuadra empieza en el modo que dice su clase', async () => {
    const { gestor } = await conInicial()
    expect(gestor.mapa.escuadras?.map((e) => e.modo)).toEqual(['agresivo', 'sigiloso'])
  })

  it('sin modo agresivo o sigiloso, las escuadras no tienen modo de partida', async () => {
    const gestor = new GestorMapa({ ...proveedor(), configuracion: { ordenActivaciones: 'alternas', modosActivacion: 'normal', medicionMovimiento: 'ortogonal', terrenoPersonajes: 'normal', distanciaControl: 0, cuerpoACuerpo: 'diagonal', coherencia: 'ninguna', distanciaCoherencia: 0, modoAtaque: 'uno-a-uno', apoyoALaCarga: 0, ajusteDelDefensor: 0, consolidacionTrasCombate: 0, retrocesoTrasCombate: 0, costeGiro: 0, costeGiroDiagonal: 0, jugadores: REPARTO } })
    await gestor.nuevaEstancia()
    expect(gestor.mapa.escuadras?.map((e) => e.modo)).toEqual([undefined, undefined])
  })

  it('las estancias siguientes no vuelven a crear escuadras', async () => {
    const { gestor, p } = await conInicial()
    await gestor.nuevaEstancia()
    expect([p.listarEscuadras.mock.calls.length, gestor.mapa.escuadras?.length]).toEqual([1, 2])
  })

  it('avisa al proveedor de cada estancia creada, ya en su sitio', async () => {
    const { gestor, p } = await conInicial()
    expect(p.estanciaCreada.mock.lastCall).toEqual([gestor.mapa.estancias[0], gestor])
  })

  it('la estancia inicial va en la esquina del mapa y la siguiente sin puerta, aparte a su derecha', async () => {
    const { gestor } = await conInicial()
    await gestor.nuevaEstancia()
    expect(gestor.mapa.estancias.map((e) => e.posicion)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ])
  })
})

describe('gestor del mapa: activaciones y acciones', () => {
  it('guarda la activación en el turno de la escuadra', async () => {
    const { gestor } = await conInicial()
    gestor.activarEscuadra('rojos', 'agresivo')
    expect(activacionDe(gestor.mapa, 'rojos')).toEqual({ modo: 'agresivo', terminada: false })
  })

  it('si la escuadra no puede activarse, dice por qué', async () => {
    const { gestor } = await conInicial()
    expect(gestor.activarEscuadra('rojos', 'normal')).toBe('El modo normal no está permitido: agresivo o sigiloso')
  })

  it('termina el turno cuando todas las escuadras han completado su activación', async () => {
    const { gestor } = await conInicial()
    for (const id of ['rojos', 'azules']) {
      gestor.activarEscuadra(id, 'agresivo')
      gestor.terminarActivacion(id)
    }
    gestor.terminarTurno()
    expect(numeroDeTurno(gestor.mapa)).toBe(2)
  })

  it('sin activaciones completas, no termina el turno', async () => {
    const { gestor } = await conInicial()
    expect(gestor.terminarTurno()).toBe('Falta terminar la activación de Rojos, Azules')
  })

  it('al pulsar un personaje, sus acciones van delante de las del gestor', async () => {
    const { gestor } = await conInicial()
    expect((await gestor.accionesDisponibles('rojos', 'barbaro')).map((a) => a.id)).toEqual(['gritar', 'buscar-trampas', 'cambiar-modo', 'terminar-turno'])
  })

  it('las acciones se piden a la clase del personaje, con su estado y el mapa', async () => {
    const { gestor, p, barbaro } = await conInicial()
    await gestor.accionesDisponibles('rojos', 'barbaro')
    expect(p.acciones.mock.lastCall).toMatchObject([barbaro(), gestor])
  })

  it('sin un personaje pulsado solo están las del gestor', async () => {
    const { gestor } = await conInicial()
    expect((await gestor.accionesDisponibles('rojos')).map((a) => a.id)).toEqual(['cambiar-modo', 'terminar-turno'])
  })

  it('buscar trampas marca la estancia y deja de estar disponible', async () => {
    const { gestor } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'buscar-trampas', 'barbaro')
    expect([gestor.tieneFlag('estancia', 'estancia-1', 'sin_trampas'), (await gestor.accionesDisponibles('rojos', 'barbaro')).map((a) => a.id)]).toEqual([
      true,
      ['gritar', 'cambiar-modo', 'terminar-turno'],
    ])
  })

  it('permite marcar y consultar flags de estancias', async () => {
    const { gestor } = await conInicial()
    gestor.marcarFlag('estancia', 'estancia-1', 'sin_trampas')
    expect(gestor.tieneFlag('estancia', 'estancia-1', 'sin_trampas')).toBe(true)
  })

  it('quita flags de personajes', async () => {
    const { gestor } = await conInicial()
    gestor.marcarFlag('personaje', 'barbaro', 'aturdido')
    gestor.quitarFlag('personaje', 'barbaro', 'aturdido')
    expect(gestor.tieneFlag('personaje', 'barbaro', 'aturdido')).toBe(false)
  })

  it('no marca flags en lo que no está en el mapa', async () => {
    const { gestor } = await conInicial()
    expect(gestor.marcarFlag('escuadra', 'nadie', 'aturdida')).toBe('No hay ninguna escuadra «nadie» en el mapa')
  })

  it('un comando del personaje se ejecuta con su propio código', async () => {
    const { gestor } = await conInicial()
    gritar.exec.mockClear()
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    expect(gritar.exec).toHaveBeenCalledOnce()
  })

  it('la acción del personaje queda en su turno y en el de su escuadra, que lo tiene como activo', async () => {
    const { gestor, barbaro } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    const rojos = gestor.mapa.escuadras?.[0]
    expect([turnoDePersonaje(barbaro(), 1).acciones, rojos && turnoDeEscuadra(rojos, 1).acciones, rojos?.activo]).toEqual([
      ['gritar'],
      [{ accion: 'gritar', personaje: 'barbaro' }],
      'barbaro',
    ])
  })

  it('si el comando falla, no se apunta', async () => {
    const { gestor } = await conInicial()
    gritar.exec.mockRejectedValueOnce(new Error('cancelada'))
    await expect(gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')).rejects.toThrow('cancelada')
    expect(gestor.mapa.escuadras?.[0].turnos).toEqual([])
  })

  it('una acción que no está disponible no se ejecuta', async () => {
    const { gestor } = await conInicial()
    expect(await gestor.ejecutarAccion('azules', 'gritar', 'enano')).toBe('«gritar» no es una acción disponible ahora')
  })

  it('tras cada acción, pasa a la clase de la escuadra las que lleva en el turno', async () => {
    const { gestor, p } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    expect(p.activar).toHaveBeenLastCalledWith([{ accion: 'gritar', personaje: 'barbaro' }])
  })

  it('si la escuadra dice que su activación está completa, termina su turno', async () => {
    const { gestor, p } = await conInicial()
    p.activar.mockResolvedValueOnce({ completo: true })
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    expect(activacionDe(gestor.mapa, 'rojos')?.terminada).toBe(true)
  })

  it('tras terminar turno, la escuadra no tiene acciones', async () => {
    const { gestor } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(await gestor.accionesDisponibles('rojos', 'barbaro')).toEqual([])
  })

  it('pide las clases de las escuadras al proveedor una sola vez', async () => {
    const { gestor, p } = await conInicial()
    await gestor.accionesDisponibles('rojos', 'barbaro')
    await gestor.accionesDisponibles('azules', 'enano')
    expect(p.listarEscuadras).toHaveBeenCalledTimes(1)
  })
})

describe('gestor del mapa: al entrar en cada casilla', () => {
  /** Casilla a `pasos` a la derecha */
  const aLaDerecha = (desde: Casilla | undefined, pasos: number) => ({ x: (desde?.x ?? 0) + pasos, y: desde?.y ?? 0 })

  it('pregunta a la clase por cada casilla del recorrido, en orden, en su estancia', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla
    await gestor.moverPersonaje('barbaro', enLinea(desde, 2))
    expect(p.alEntrar.mock.calls.map(([, donde]) => donde)).toEqual([
      { estancia: 'estancia-1', casilla: aLaDerecha(desde, 1) },
      { estancia: 'estancia-1', casilla: aLaDerecha(desde, 2) },
    ])
  })

  it('al detenerse, se mueve solo hasta esa casilla y no pregunta por las demás', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla
    p.alEntrar.mockResolvedValueOnce('detenerse')
    await gestor.moverPersonaje('barbaro', enLinea(desde, 2))
    expect([barbaro().casilla, p.alEntrar.mock.calls.length]).toEqual([aLaDerecha(desde, 1), 1])
  })

  it('al detenerse en terreno con efecto, se queda en esa casilla', async () => {
    const lava = { ...amplia, terrenos: [{ tipo: 'dificil' as const, efecto: 'lava', posicion: { x: 2, y: 1 }, columnas: 1, filas: 1 }] }
    const { gestor, p, barbaro } = await conInicial(lava)
    const desde = barbaro().casilla
    p.alEntrar.mockResolvedValueOnce('detenerse')
    await gestor.moverPersonaje('barbaro', enLinea(desde, 2))
    expect([barbaro().casilla, p.alEntrar.mock.calls.at(-1)?.[1].terreno?.efecto]).toEqual([aLaDerecha(desde, 1), 'lava'])
  })

  it('al detenerse antes de deslizar, solo gasta lo que ha recorrido', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    p.alEntrar.mockResolvedValueOnce('seguir').mockResolvedValueOnce('detenerse')
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 3))
    expect(turnoDePersonaje(barbaro(), 1).movimientos).toEqual([{ opcion: 'mover-y-deslizar', casillas: 2, acciones: ['mover'] }])
  })

  it('con terminar el turno, ya no le quedan acciones y su activación termina', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    p.alEntrar.mockResolvedValueOnce('terminar-turno')
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 2))
    expect([turnoDePersonaje(barbaro(), 1).quedanAcciones, activacionDe(gestor.mapa, 'rojos')?.terminada]).toEqual([false, true])
  })

  it('pregunta también por las casillas ocupadas que atraviesa', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia, true)
    const desde = barbaro().casilla
    // con el elfo, el enano empieza dos casillas a la derecha del bárbaro
    await gestor.moverPersonaje('barbaro', enLinea(desde, 3))
    expect(p.alEntrar.mock.calls.map(([, donde]) => donde.casilla)).toEqual([aLaDerecha(desde, 1), aLaDerecha(desde, 2), aLaDerecha(desde, 3)])
  })

  it('si se detiene al entrar en una casilla ocupada, se queda antes', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia, true)
    const desde = barbaro().casilla
    p.alEntrar.mockResolvedValueOnce('seguir').mockResolvedValueOnce('detenerse')
    await gestor.moverPersonaje('barbaro', enLinea(desde, 3))
    expect(barbaro().casilla).toEqual(aLaDerecha(desde, 1))
  })

  it('si lo que pasa al entrar lo quita del mapa, no apunta el movimiento', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia, true)
    p.alEntrar.mockImplementationOnce(async (_personaje, _donde, mapa) => (mapa.eliminarPersonaje('barbaro'), 'detenerse'))
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 1))
    const rojos = gestor.mapa.escuadras?.[0]
    expect([rojos?.personajes.map((h) => h.id), rojos && turnoDeEscuadra(rojos, 1).acciones]).toEqual([['elfo'], []])
  })
})

describe('gestor del mapa: orden del turno con iniciativa', () => {
  /** Proveedor con iniciativa: en cada turno, primero los azules (Ana) */
  async function conIniciativa(ordenDelTurno?: (mapa: MapaEnJuego) => HuecoDelTurno[]) {
    const base = proveedor()
    const p = { ...base, configuracion: { ...base.configuracion, ordenActivaciones: 'iniciativa' as const }, ordenDelTurno: vi.fn(ordenDelTurno ?? (() => [{ jugador: 'j1' }])) }
    const gestor = new GestorMapa(p)
    await gestor.nuevaEstancia()
    return { gestor, p }
  }

  it('al empezar la partida, pide el orden del primer turno y lo guarda', async () => {
    const { gestor } = await conIniciativa()
    expect(gestor.mapa.ordenDelTurno).toEqual({ numero: 1, huecos: [{ jugador: 'j1' }] })
  })

  it('al empezar cada turno, pide el suyo', async () => {
    const { gestor, p } = await conIniciativa()
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    await gestor.ejecutarAccion('azules', 'terminar-turno')
    gestor.terminarTurno()
    expect([p.ordenDelTurno.mock.calls.length, gestor.mapa.ordenDelTurno?.numero]).toEqual([2, 2])
  })

  it('sin iniciativa, no lo pide', async () => {
    const p = { ...proveedor(), ordenDelTurno: vi.fn(() => []) }
    await new GestorMapa(p).nuevaEstancia()
    expect(p.ordenDelTurno).not.toHaveBeenCalled()
  })
})

describe('gestor del mapa: coherencia de escuadra', () => {
  // con el elfo, el bárbaro está en 1,1 y el elfo en 1,3: a 2 casillas
  const aUna: Coherencia = { modo: 'alguno', distancia: 1 }
  /** Escuadras y personajes de los que se ha avisado que quedan fuera de coherencia */
  const avisados = (p: ReturnType<typeof proveedor>) => p.escuadraSinCoherencia.mock.calls.map(([escuadra, fuera]) => [escuadra.id, fuera.map((h) => h.id)])

  it('da la guía de las escuadras con más de un personaje colocado, con los que quedan fuera', async () => {
    const { gestor } = await conInicial(amplia, true, aUna)
    expect(gestor.guiasDeCoherencia().map((g) => [g.escuadra, g.fuera])).toEqual([['rojos', ['elfo']]])
  })

  it('sin coherencia, no hay guía', async () => {
    const { gestor } = await conInicial(amplia, true)
    expect(gestor.guiasDeCoherencia()).toEqual([])
  })

  it('al terminar su activación, avisa al proveedor de los que quedan fuera', async () => {
    const { gestor, p } = await conInicial(amplia, true, aUna)
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(avisados(p)).toEqual([['rojos', ['elfo']]])
  })

  it('mientras se activa, no avisa', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia, true, aUna)
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 1))
    expect(p.escuadraSinCoherencia).not.toHaveBeenCalled()
  })

  it('también avisa con un gestor recién creado con el mapa guardado, sin esperar a las clases', async () => {
    const { gestor, p } = await conInicial(amplia, true, aUna)
    const otro = new GestorMapa(p, gestor.mapa)
    otro.activarEscuadra('rojos', 'agresivo')
    otro.terminarActivacion('rojos')
    expect(avisados(p)).toEqual([['rojos', ['elfo']]])
  })

  it('si todos están en coherencia, no avisa', async () => {
    const { gestor, p } = await conInicial(amplia, true, { modo: 'alguno', distancia: 2 })
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(p.escuadraSinCoherencia).not.toHaveBeenCalled()
  })
})

describe('gestor del mapa: desplazamientos forzados', () => {
  /** Sala amplia con el bárbaro en 1,1 (y el enano en 1,3; con el elfo, el elfo en 1,3 y el enano en 3,1) y un orco de la Oscuridad en 6,1 */
  async function conOrco(conElfo = false) {
    const inicial = await conInicial(amplia, conElfo)
    inicial.gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: { x: 6, y: 1 } }])
    return inicial
  }
  const delOrco = { personaje: 'orco' }

  it('se aleja de quien se le pide y dice por dónde ha ido', async () => {
    const { gestor } = await conOrco()
    expect(await gestor.desplazar('barbaro', { sentido: 'lejos', de: delOrco, casillas: 1 })).toEqual({
      personaje: 'barbaro',
      recorrido: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      llega: true,
    })
  })

  it('no gasta movimiento ni apunta nada en su turno', async () => {
    const { gestor, barbaro } = await conOrco()
    await gestor.desplazar('barbaro', { sentido: 'lejos', de: delOrco, casillas: 1 })
    expect([barbaro().casilla, barbaro().turnos]).toEqual([{ x: 0, y: 1 }, []])
  })

  it('también desplaza a los personajes no jugadores', async () => {
    const { gestor } = await conOrco()
    await gestor.desplazar('orco', { sentido: 'hacia', de: { personaje: 'barbaro' }, casillas: 9, hasta: 1 })
    expect(gestor.mapa.personajesNoJugadores?.[0].casilla).toEqual({ x: 2, y: 1 })
  })

  it('pregunta a su clase al entrar en cada casilla y se detiene donde diga, sin llegar', async () => {
    const { gestor, p, barbaro } = await conOrco()
    p.alEntrar.mockResolvedValueOnce('seguir').mockResolvedValueOnce('detenerse')
    const resultado = await gestor.desplazar('barbaro', { sentido: 'hacia', de: delOrco, casillas: 9, hasta: 1 })
    expect([barbaro().casilla, 'llega' in resultado && resultado.llega]).toEqual([{ x: 3, y: 1 }, false])
  })

  it('con `alEntrar: false`, no pregunta a su clase', async () => {
    const { gestor, p } = await conOrco()
    await gestor.desplazar('barbaro', { sentido: 'hacia', de: delOrco, casillas: 9, alEntrar: false })
    expect(p.alEntrar).not.toHaveBeenCalled()
  })

  it('si al entrar termina su turno, se queda sin acciones', async () => {
    const { gestor, p, barbaro } = await conOrco()
    p.alEntrar.mockResolvedValueOnce('terminar-turno')
    await gestor.desplazar('barbaro', { sentido: 'lejos', de: delOrco, casillas: 1 })
    expect(turnoDePersonaje(barbaro(), 1).quedanAcciones).toBe(false)
  })

  it('por un recorrido concreto', async () => {
    const { gestor, barbaro } = await conOrco()
    await gestor.desplazar('barbaro', { recorrido: enLinea(barbaro().casilla, 2) })
    expect(barbaro().casilla).toEqual({ x: 3, y: 1 })
  })

  it('si el recorrido no vale, dice por qué y no lo mueve', async () => {
    const { gestor, barbaro } = await conOrco()
    expect([await gestor.desplazar('barbaro', { recorrido: enLinea({ x: 2, y: 1 }, 2) }), barbaro().casilla]).toEqual([
      { personaje: 'barbaro', motivo: 'El recorrido tiene que empezar en Bárbaro' },
      { x: 1, y: 1 },
    ])
  })

  /** Qué personajes de los rojos se desplazan, en orden */
  const orden = (resultados: Awaited<ReturnType<GestorMapa['desplazarEscuadra']>>) => (typeof resultados === 'string' ? resultados : resultados.map((r) => r.personaje))

  it('a una escuadra, hacia la referencia, primero el más cercano', async () => {
    // el bárbaro, en 1,1, está más cerca del orco que el elfo, en 1,3
    const { gestor } = await conOrco(true)
    expect(orden(await gestor.desplazarEscuadra('rojos', { sentido: 'hacia', de: delOrco, casillas: 9, hasta: 1, alEntrar: false }))).toEqual(['barbaro', 'elfo'])
  })

  it('a una escuadra, lejos de la referencia, primero el más lejano', async () => {
    const { gestor } = await conOrco(true)
    expect(orden(await gestor.desplazarEscuadra('rojos', { sentido: 'lejos', de: delOrco, casillas: 1, alEntrar: false }))).toEqual(['elfo', 'barbaro'])
  })

  it('a una escuadra que no hay, el motivo', async () => {
    const { gestor } = await conOrco()
    expect(await gestor.desplazarEscuadra('nadie', { sentido: 'lejos', de: delOrco, casillas: 1 })).toBe('No hay ninguna escuadra «nadie» en el mapa')
  })
})

describe('gestor del mapa: encaramiento', () => {
  /** Sala amplia con girar a 1 casilla de movimiento por cada 90° (el bárbaro, en 1,1, mira abajo) */
  async function conGiros() {
    const base = proveedor(amplia)
    const p = { ...base, configuracion: { ...base.configuracion, costeGiro: 1 } }
    const gestor = new GestorMapa(p)
    await gestor.nuevaEstancia()
    const barbaro = () => gestor.personaje('barbaro')
    return { gestor, p, barbaro }
  }

  it('girar sin moverse cambia hacia dónde mira', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    await gestor.girar('barbaro', 'derecha')
    expect(barbaro().orientacion).toBe('derecha')
  })

  it('también gira a un personaje no jugador de quien tiene el turno, con las opciones que le dan', async () => {
    const { gestor } = await conInicial(amplia)
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: { x: 6, y: 6 } }])
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    await gestor.girarNoJugador('orco', 'izquierda', opciones)
    expect(gestor.personaje('orco')?.orientacion).toBe('izquierda')
  })

  it('darse la vuelta cuesta dos giros de su movimiento', async () => {
    const { gestor, barbaro } = await conGiros()
    await gestor.girar('barbaro', 'arriba')
    expect(gastadoPor(gestor.mapa, barbaro() ?? { id: '', nombre: '', estancia: '', turnos: [] })).toEqual({ casillas: 2, acciones: [] })
  })

  it('sin movimiento para girar, no gira y dice por qué', async () => {
    const { gestor, p, barbaro } = await conGiros()
    p.opcionesMovimiento.mockResolvedValueOnce({ ...opciones, base: { ...opciones.base, tramos: [{ distancia: 1 }] } })
    expect([await gestor.girar('barbaro', 'arriba'), barbaro()?.orientacion]).toEqual(['Bárbaro no tiene movimiento para girar: le cuesta 2 y le queda 1', undefined])
  })

  it('ocupando varias casillas, no gira si su huella girada no cabe', async () => {
    const base = proveedor(amplia)
    const clases = await base.listarEscuadras()
    // el bárbaro ocupa 2 × 1: mirando abajo (como empieza), su casilla y la de debajo
    const conLargo = clases.map((c) => (c.id === 'rojos' ? { ...c, personajes: async () => (await c.personajes()).map((h) => ({ ...h, largo: 2 })) } : c))
    const gestor = new GestorMapa({ ...base, listarEscuadras: vi.fn(async () => conLargo) })
    await gestor.nuevaEstancia()
    const { x, y } = gestor.personaje('barbaro')?.casilla ?? { x: 0, y: 0 }
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: { x: x + 1, y } }])
    expect(await gestor.girar('barbaro', 'derecha')).toBe('Bárbaro no cabe girado hacia derecha')
  })

  it('al moverse, gira hacia donde va, lo paga y acaba mirando hacia allí', async () => {
    const { gestor, barbaro } = await conGiros()
    await gestor.moverPersonaje('barbaro', enLinea(barbaro()?.casilla, 1))
    expect([barbaro()?.orientacion, turnoDePersonaje(barbaro() ?? { id: '', nombre: '', estancia: '', turnos: [] }, 1).movimientos[0].casillas]).toEqual(['derecha', 2])
  })
})

describe('gestor del mapa: movimiento', () => {
  it('pregunta a la clase del personaje cómo puede moverse, con su estado y sin nada gastado', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    expect([await gestor.opcionesMovimiento('barbaro'), p.opcionesMovimiento.mock.lastCall]).toMatchObject([opciones, [barbaro(), { casillas: 0, acciones: [] }]])
  })

  it('dentro del movimiento base, mueve sin preguntar y lo apunta en el turno del personaje', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla
    await gestor.moverPersonaje('barbaro', enLinea(desde, 2))
    expect([p.confirmar.mock.calls.length, barbaro().casilla, turnoDePersonaje(barbaro(), 1).movimientos]).toEqual([
      0,
      { x: (desde?.x ?? 0) + 2, y: desde?.y },
      [{ opcion: 'mover', casillas: 2, acciones: ['mover'] }],
    ])
  })

  it('las acciones que consume moverse van al turno de la escuadra, no a las acciones del personaje', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 2))
    const rojos = gestor.mapa.escuadras?.[0]
    expect([rojos && turnoDeEscuadra(rojos, 1).acciones, turnoDePersonaje(barbaro(), 1).acciones]).toEqual([[{ accion: 'mover', personaje: 'barbaro' }], []])
  })

  it('deja mover a varios personajes de la escuadra en la misma activación', async () => {
    const { gestor, barbaro, elfo } = await conInicial(amplia, true)
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 1))
    await gestor.moverPersonaje('elfo', enLinea(elfo().casilla, 1))
    expect(turnoDeEscuadra(gestor.mapa.escuadras?.[0] ?? { id: '', nombre: '', jugador: '', personajes: [], turnos: [] }, 1).acciones).toEqual([
      { accion: 'mover', personaje: 'barbaro' },
      { accion: 'mover', personaje: 'elfo' },
    ])
  })

  it('para deslizar, pide confirmación y, confirmado, apunta también deslizar', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 3))
    expect([p.confirmar.mock.lastCall?.[0], turnoDePersonaje(barbaro(), 1).movimientos[0].acciones]).toEqual(['Confirme que queremos deslizar', ['mover', 'deslizar']])
  })

  it('sin confirmar, no hace nada', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    p.confirmar.mockResolvedValueOnce(false)
    const antes = gestor.mapa
    expect([await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 3)), gestor.mapa]).toEqual([undefined, antes])
  })

  it('si el recorrido no vale, dice por qué y el personaje no se mueve', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const antes = gestor.mapa
    expect([await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 4)), gestor.mapa]).toEqual(['Demasiado lejos: 4 casillas y como mucho 3', antes])
  })

  it('si ya se ha movido, se le pregunta de nuevo diciendo lo que ha gastado', async () => {
    const { gestor, p, barbaro } = await conInicial(amplia)
    await gestor.moverPersonaje('barbaro', enLinea(barbaro().casilla, 2))
    await gestor.opcionesMovimiento('barbaro')
    expect(p.opcionesMovimiento.mock.lastCall?.[1]).toEqual({ casillas: 2, acciones: ['mover'] })
  })

  it('un personaje cuya escuadra ya terminó su turno no puede moverse', async () => {
    const { gestor } = await conInicial(amplia)
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(await gestor.opcionesMovimiento('barbaro')).toBeUndefined()
  })

  it('muestra el detalle de la escuadra con el personaje seleccionado', async () => {
    const mostrarDetalle = vi.fn()
    const p = proveedor(amplia)
    const clases = await p.listarEscuadras()
    p.listarEscuadras.mockResolvedValueOnce([{ ...clases[0], mostrarDetalle }, ...clases.slice(1)])
    const gestor = new GestorMapa(p)
    await gestor.nuevaEstancia()
    await gestor.mostrarDetalle('barbaro')
    expect(mostrarDetalle.mock.lastCall?.[1]).toMatchObject({ id: 'barbaro', nombre: 'Bárbaro' })
  })

  it('un personaje del mapa no se coloca a mano: se mueve arrastrándolo', async () => {
    const { gestor } = await conInicial(amplia)
    expect(gestor.colocarPersonaje('barbaro', { x: 0, y: 0 })).toBe('Bárbaro se mueve arrastrando su ficha')
  })

  it('un personaje de la zona de espera se coloca a mano en una casilla libre', async () => {
    const gestor = new GestorMapa(proveedor(), {
      estancias: [{ id: 'sala', tipo: 'sala', columnas: 3, filas: 3, puertas: [], elementos: [], estancias: [] }],
      escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'j1', personajes: [{ id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', turnos: [] }], turnos: [] }],
    })
    gestor.colocarPersonaje('barbaro', { x: 1, y: 1 })
    expect(gestor.mapa.escuadras?.[0].personajes[0].casilla).toEqual({ x: 1, y: 1 })
  })

  it('valida la zona de despliegue al colocar desde la zona de espera', async () => {
    const p = proveedor()
    const gestor = new GestorMapa({ ...p, configuracion: { ...p.configuracion, despliegue: [{ alianza: 'heroes', zona: { posicion: { x: 0, y: 0 }, columnas: 1, filas: 1 } }] } }, {
      estancias: [{ id: 'sala', tipo: 'sala', columnas: 3, filas: 3, puertas: [], elementos: [], estancias: [] }],
      escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'j1', personajes: [{ id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', turnos: [] }], turnos: [] }],
      jugadores: REPARTO,
    })
    expect(gestor.colocarPersonaje('barbaro', { x: 1, y: 1 })).toBe('La casilla 1,1 no está en la zona de despliegue de «heroes»')
  })
})

describe('gestor del mapa: enemigos', () => {
  const orco = { id: 'orco', nombre: 'Orco', jugador: 'oscuridad' } as const

  it('los personajes no jugadores de la descripción aparecen en la estancia nueva', async () => {
    const { gestor } = await conInicial({ ...amplia, personajesNoJugadores: [{ ...orco, casilla: { x: 11, y: 7 } }] })
    expect(gestor.mapa.personajesNoJugadores).toEqual([{ id: 'orco', nombre: 'Orco', estancia: 'estancia-1', casilla: { x: 11, y: 7 }, turnos: [], jugador: 'oscuridad' }])
  })

  it('se añaden a una estancia del mapa y avisa del cambio', async () => {
    const { gestor } = await conInicial(amplia)
    const aviso = vi.fn()
    gestor.suscribir(aviso)
    gestor.anadirPersonajes('estancia-1', [{ ...orco, casilla: { x: 0, y: 0 } }])
    expect(aviso.mock.lastCall?.[0].personajesNoJugadores).toHaveLength(1)
  })

  it('al azar, con el azar que se le da al gestor', async () => {
    const gestor = new GestorMapa(proveedor(amplia), undefined, () => 0)
    await gestor.nuevaEstancia()
    expect(gestor.anadirPersonajes('estancia-1', [orco])[0].casilla).toEqual({ x: 0, y: 0 })
  })

  it('no se puede mover a través de un enemigo', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    const hacia = (dx: number) => ({ x: desde.x + dx, y: desde.y })
    const [colocado] = gestor.anadirPersonajes('estancia-1', [{ ...orco, casilla: hacia(-1) }])
    expect([colocado.casilla, await gestor.moverPersonaje('barbaro', [desde, hacia(-1), hacia(-2)])]).toEqual([hacia(-1), 'El recorrido pasa por donde no se puede'])
  })
})

describe('gestor del mapa: muebles', () => {
  it('añade muebles a una estancia del mapa y avisa del cambio', async () => {
    const { gestor } = await conInicial(amplia)
    const aviso = vi.fn()
    gestor.suscribir(aviso)
    const [mesa] = gestor.anadirMuebles('estancia-1', [{ id: 'mesa', tipo: 'mueble', nombre: 'Mesa', columnas: 1, filas: 1 }])
    expect([!!mesa.posicion, Boolean(aviso.mock.lastCall?.[0].estancias[0].elementos.find((el: { id: string }) => el.id === 'mesa'))]).toEqual([true, true])
  })

  it('no permite mover muebles a mano', async () => {
    const { gestor } = await conInicial(amplia)
    gestor.anadirMuebles('estancia-1', [{ id: 'mesa', tipo: 'mueble', nombre: 'Mesa', columnas: 1, filas: 1 }])
    expect(gestor.colocarElemento('estancia-1', 'mesa', { x: 1, y: 1 })).toBe('El mueble «Mesa» no se puede mover')
  })

  it('marca flags de muebles y los consulta', async () => {
    const { gestor } = await conInicial(amplia)
    gestor.anadirMuebles('estancia-1', [{ id: 'mesa', tipo: 'mueble', nombre: 'Mesa', columnas: 1, filas: 1 }])
    gestor.marcarFlag('elemento', 'mesa', 'revisado')
    expect(gestor.tieneFlag('elemento', 'mesa', 'revisado')).toBe(true)
  })

  it('devuelve los muebles colocados al lado de un personaje', async () => {
    const gestor = new GestorMapa(proveedor(), {
      estancias: [{ id: 'sala', tipo: 'sala', columnas: 3, filas: 3, puertas: [], elementos: [{ id: 'mesa', tipo: 'mueble', nombre: 'Mesa', columnas: 1, filas: 1, posicion: { x: 2, y: 1 } }], estancias: [] }],
      escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'j1', personajes: [{ id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', casilla: { x: 1, y: 1 }, turnos: [] }], turnos: [] }],
    })
    expect(gestor.dameLoQueEstaAlLado(gestor.mapa.escuadras?.[0].personajes[0] ?? { id: '', nombre: '', estancia: '', turnos: [] }).map((el) => el.id)).toEqual(['mesa'])
  })
})

describe('gestor del mapa: agrupar y coger', () => {
  /**
   * Los rojos con el bárbaro en 0,0 y el elfo en `elfo`, en una sala de 5 × 3.
   * La clase del elfo mueve 2 por turno, menos lo que ya haya gastado
   */
  async function conElfo(elfo: Casilla) {
    const p = proveedor()
    const [rojos] = await p.listarEscuadras()
    const [barbaro] = await rojos.personajes()
    const gestor = new GestorMapa(
      { ...p, listarEscuadras: async () => [{ ...rojos, personajes: async () => [
            barbaro,
            {
              ...barbaro,
              id: 'elfo',
              nombre: 'Elfo',
              opcionesMovimiento: async (_personaje: Personaje, { casillas }: MovimientoGastado) => ({
                base: { ...opciones.base, tramos: [{ distancia: Math.max(0, 2 - casillas) }] },
                variaciones: [],
              }),
            },
          ] }] },
      {
        estancias: [{ id: 'sala', tipo: 'sala', columnas: 5, filas: 3, puertas: [], elementos: [], estancias: [] }],
        escuadras: [
          {
            id: 'rojos',
            nombre: 'Rojos',
            jugador: 'j1',
            personajes: [
              { id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', casilla: { x: 0, y: 0 }, turnos: [] },
              { id: 'elfo', nombre: 'Elfo', estancia: 'sala', casilla: elfo, turnos: [] },
            ],
            turnos: [],
          },
        ],
        turno: 1,
      },
    )
    const elfoDe = () => gestor.mapa.escuadras?.[0].personajes[1] ?? { id: '', nombre: '', estancia: '', turnos: [] }
    return { gestor, elfoDe }
  }

  it('un personaje de una escuadra con más personajes puede agrupar', async () => {
    const { gestor } = await conElfo({ x: 4, y: 2 })
    expect((await gestor.accionesDisponibles('rojos', 'barbaro')).map((a) => a.id)).toContain('agrupar')
  })

  it('solo, no tiene a quién agrupar', async () => {
    const { gestor } = await conInicial()
    expect((await gestor.accionesDisponibles('rojos', 'barbaro')).map((a) => a.id)).not.toContain('agrupar')
  })

  it('agrupar trae al resto de la escuadra a su lado con su movimiento, que queda gastado', async () => {
    const { gestor, elfoDe } = await conElfo({ x: 3, y: 0 })
    await gestor.ejecutarAccion('rojos', 'agrupar', 'barbaro')
    expect([elfoDe().casilla, turnoDePersonaje(elfoDe(), 1).movimientos]).toEqual([{ x: 1, y: 0 }, [{ opcion: 'mover', casillas: 2, acciones: ['mover'] }]])
  })

  it('sin movimiento para llegar, se queda a medio camino', async () => {
    const { gestor, elfoDe } = await conElfo({ x: 4, y: 0 })
    await gestor.ejecutarAccion('rojos', 'agrupar', 'barbaro')
    expect(elfoDe().casilla).toEqual({ x: 2, y: 0 })
  })

  it('el que ya ha gastado su movimiento no se mueve al agrupar', async () => {
    const { gestor, elfoDe } = await conElfo({ x: 3, y: 0 })
    await gestor.moverPersonaje('elfo', [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }])
    await gestor.ejecutarAccion('rojos', 'agrupar', 'barbaro')
    expect([elfoDe().casilla, gastadoPor(gestor.mapa, elfoDe()).casillas]).toEqual([{ x: 3, y: 2 }, 2])
  })

  it('el que ha gastado parte de su movimiento solo se acerca con lo que le queda', async () => {
    const { gestor, elfoDe } = await conElfo({ x: 4, y: 0 })
    await gestor.moverPersonaje('elfo', [{ x: 4, y: 0 }, { x: 4, y: 1 }])
    await gestor.ejecutarAccion('rojos', 'agrupar', 'barbaro')
    // de 4,1 (a 5 del bárbaro) le queda 1: acaba a 4, en 4,0 o en 3,1
    const { x, y } = elfoDe().casilla ?? { x: Number.NaN, y: Number.NaN }
    expect([x + y, gastadoPor(gestor.mapa, elfoDe()).casillas]).toEqual([4, 2])
  })

  it('agrupar se apunta como acción del que agrupa, y el movimiento, del que se mueve', async () => {
    const { gestor } = await conElfo({ x: 3, y: 0 })
    await gestor.ejecutarAccion('rojos', 'agrupar', 'barbaro')
    expect(turnoDeEscuadra(gestor.mapa.escuadras?.[0] ?? { id: '', nombre: '', jugador: '', personajes: [], turnos: [] }, 1).acciones).toEqual([
      { accion: 'mover', personaje: 'elfo' },
      { accion: 'agrupar', personaje: 'barbaro' },
    ])
  })

  it('quita un elemento de su estancia', async () => {
    const { gestor } = await conInicial()
    gestor.quitarElemento('estancia-1-elemento-1')
    expect(gestor.mapa.estancias[0].elementos).toEqual([])
  })

  it('no quita lo que no está', async () => {
    const { gestor } = await conInicial()
    expect(gestor.quitarElemento('nada')).toBe('No hay ningún elemento «nada» en el mapa')
  })
})

describe('gestor del mapa: mover personajes no jugadores', () => {
  it('tras confirmar, vuelve a leer dónde está: si se ha movido mientras tanto, el recorrido ya no vale', async () => {
    const p = proveedor()
    const gestor = new GestorMapa(p, {
      estancias: [{ id: 'sala', tipo: 'sala', columnas: 5, filas: 3, puertas: [], elementos: [], estancias: [] }],
      personajesNoJugadores: [{ id: 'orco', nombre: 'Orco', estancia: 'sala', casilla: { x: 0, y: 0 }, turnos: [], jugador: 'oscuridad' }],
      jugadores: REPARTO,
      turno: 1,
    })
    p.confirmar.mockImplementationOnce(async () => {
      await gestor.moverPersonajeNoJugador('orco', [{ x: 0, y: 0 }, { x: 0, y: 1 }], opciones)
      return true
    })
    const deslizando = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]
    expect(await gestor.moverPersonajeNoJugador('orco', deslizando, opciones)).toBe('El recorrido tiene que empezar en Orco')
  })
})

describe('gestor del mapa: resultado de las acciones', () => {
  it('lo que resuelve un comando (si le quedan acciones) queda en el turno del personaje', async () => {
    const { gestor, barbaro } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    expect(turnoDePersonaje(barbaro(), 1).quedanAcciones).toBe(true)
  })
})

/**
 * Con ataque de escuadra: los rojos (bárbaro en 1,1 y elfo en 1,3) resuelven
 * sus ataques con `atacarEscuadra`, y los negros de la Oscuridad (orco-1 en
 * 10,6 y orco-2 en 10,4) son enemigos suyos
 */
async function conNegros(rojosAtacanEnEscuadra = true, reglas: Partial<Configuracion> = {}) {
  const base = proveedor(amplia, true)
  const atacarEscuadra = vi.fn(async (_ataque: AtaqueDeEscuadra, _mapa: MapaEnJuego): Promise<ResultadoAccion> => ({ quedanAcciones: false }))
  const orco = (id: string) => ({ id, nombre: id, opcionesMovimiento: base.opcionesMovimiento, acciones: async () => [], atacar: base.atacar, motivoParaNoAtacar: base.motivoParaNoAtacar })
  const clases = await base.listarEscuadras()
  const negros: ClaseDeEscuadra = { id: 'negros', nombre: 'Negros', jugador: 'oscuridad', personajes: async () => [orco('orco-1'), orco('orco-2')], modoActivacion: async () => 'agresivo', activar: base.activar }
  const p = {
    ...base,
    configuracion: { ...base.configuracion, modoAtaque: 'escuadra' as const, ...reglas },
    listarEscuadras: vi.fn(async () => [...clases.map((c) => (c.id === 'rojos' && rojosAtacanEnEscuadra ? { ...c, atacarEscuadra } : c)), negros]),
    atacarEscuadra,
  }
  const gestor = new GestorMapa(p)
  await gestor.nuevaEstancia()
  return { gestor, p }
}

describe('gestor del mapa: ataque de escuadra contra escuadra', () => {
  /** Quién ataca a quién en el ataque de escuadra que resolvió la clase */
  const quienAQuien = (p: Awaited<ReturnType<typeof conNegros>>['p']) => p.atacarEscuadra.mock.lastCall?.[0].ataques.map((a) => [a.atacante.id, a.objetivo.id])

  it('atacan juntos todos los de la escuadra que pueden', async () => {
    const { gestor, p } = await conNegros()
    await gestor.atacar('barbaro', 'orco-1')
    expect(quienAQuien(p)).toEqual([
      ['barbaro', 'orco-1'],
      ['elfo', 'orco-1'],
    ])
  })

  it('solo se ataca al objetivo elegido: quien no puede atacarlo no ataca, aunque llegue a otro de su escuadra', async () => {
    const { gestor, p } = await conNegros()
    p.motivoParaNoAtacar.mockImplementation(({ atacante, objetivo }) => (atacante.id === 'elfo' && objetivo.id === 'orco-1' ? 'Demasiado lejos' : undefined))
    await gestor.atacar('barbaro', 'orco-1')
    expect(quienAQuien(p)).toEqual([['barbaro', 'orco-1']])
  })

  it('el que no puede atacar al objetivo no ataca, con su motivo', async () => {
    const { gestor, p } = await conNegros()
    p.motivoParaNoAtacar.mockImplementation(({ atacante }) => (atacante.id === 'elfo' ? 'Demasiado lejos' : undefined))
    await gestor.atacar('barbaro', 'orco-1')
    expect(p.atacarEscuadra.mock.lastCall?.[0].sinAtacar.map(({ atacante, motivo }) => [atacante.id, motivo])).toEqual([['elfo', 'Demasiado lejos']])
  })

  it('los que ya no tienen acciones no atacan', async () => {
    const { gestor, p } = await conNegros()
    gritar.exec.mockResolvedValueOnce({ quedanAcciones: false })
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    await gestor.atacar('elfo', 'orco-1')
    expect(quienAQuien(p)).toEqual([['elfo', 'orco-1']])
  })

  it('los objetivos van de los más cercanos a los atacantes a los más lejanos', async () => {
    const { gestor, p } = await conNegros()
    await gestor.atacar('barbaro', 'orco-1')
    expect(p.atacarEscuadra.mock.lastCall?.[0].objetivos.map((o) => o.id)).toEqual(['orco-2', 'orco-1'])
  })

  it('apunta «atacar» a cada atacante', async () => {
    const { gestor } = await conNegros()
    await gestor.atacar('barbaro', 'orco-1')
    const rojos = gestor.mapa.escuadras?.[0]
    expect(rojos && turnoDeEscuadra(rojos, 1).acciones).toEqual([
      { accion: 'atacar', personaje: 'barbaro' },
      { accion: 'atacar', personaje: 'elfo' },
    ])
  })

  it('si nadie puede atacar, dice por qué y no ataca', async () => {
    const { gestor, p } = await conNegros()
    p.motivoParaNoAtacar.mockReturnValue('Demasiado lejos')
    expect([await gestor.atacar('barbaro', 'orco-1'), p.atacarEscuadra.mock.calls.length]).toEqual(['Demasiado lejos', 0])
  })

  it('puede atacar aunque el arrastrado no llegue, si llega otro de su escuadra', async () => {
    const { gestor, p } = await conNegros()
    p.motivoParaNoAtacar.mockImplementation(({ atacante }) => (atacante.id === 'barbaro' ? 'Demasiado lejos' : undefined))
    expect(await gestor.motivoParaNoAtacar('barbaro', 'orco-1')).toBeUndefined()
  })

  it('si la clase de la escuadra no resuelve ataques de escuadra, atacan uno a uno', async () => {
    const { gestor, p } = await conNegros(false)
    await gestor.atacar('barbaro', 'orco-1')
    expect([p.atacar.mock.calls.length, p.atacarEscuadra.mock.calls.length]).toEqual([1, 0])
  })
})

describe('gestor del mapa: cargas y consolidación', () => {
  /** Los rojos solo pueden cargar, hasta 20 casillas */
  const CARGAR: OpcionesMovimiento = {
    base: { id: 'cargar', nombre: 'Cargar', tipo: 'carga', accion: { id: 'cargar', nombre: 'Cargar', icono: '🐂' }, tramos: [{ distancia: 20 }], terminarJuntoAEnemigo: true },
    variaciones: [],
  }
  /** Con esas reglas, el bárbaro (en 1,1) carga hasta 9,4, en contacto con el orco-2 (en 10,4); el elfo sigue en 1,3 y el orco-1 en 10,6 */
  async function trasCargar(reglas: Partial<Configuracion>, rojosAtacanEnEscuadra = true) {
    const negros = await conNegros(rojosAtacanEnEscuadra, reglas)
    negros.p.opcionesMovimiento.mockResolvedValue(CARGAR)
    await negros.gestor.moverPersonaje('barbaro', ruta(negros.gestor.mapa, { x: 1, y: 1 }, { x: 9, y: 4 }) ?? [])
    return negros
  }
  const casillaDe = (gestor: GestorMapa, id: string) => gestor.personaje(id)?.casilla ?? { x: Number.NaN, y: Number.NaN }
  /** Casillas en recto, sin diagonales, entre dos personajes */
  const entre = (gestor: GestorMapa, a: string, b: string) => {
    const [ca, cb] = [casillaDe(gestor, a), casillaDe(gestor, b)]
    return Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y)
  }

  it('la carga llega al contacto', async () => {
    const { gestor } = await trasCargar({})
    expect(casillaDe(gestor, 'barbaro')).toEqual({ x: 9, y: 4 })
  })

  it('con apoyo a la carga, los demás de la escuadra se acercan a la cargada', async () => {
    const { gestor } = await trasCargar({ apoyoALaCarga: 3 })
    expect(entre(gestor, 'elfo', 'orco-2')).toBe(7)
  })

  it('sin apoyo a la carga, los demás no se mueven', async () => {
    const { gestor } = await trasCargar({})
    expect(casillaDe(gestor, 'elfo')).toEqual({ x: 1, y: 3 })
  })

  it('con ajuste del defensor, los de la escuadra cargada se acercan hasta el contacto', async () => {
    const { gestor } = await trasCargar({ ajusteDelDefensor: 3 })
    expect(entre(gestor, 'orco-1', 'barbaro')).toBe(1)
  })

  it('el apoyo y el ajuste no gastan movimiento', async () => {
    const { gestor } = await trasCargar({ apoyoALaCarga: 3 })
    expect(gestor.personaje('elfo')?.turnos).toEqual([])
  })

  it('tras un cuerpo a cuerpo sin destruir a la escuadra atacada, la atacante retrocede', async () => {
    const { gestor } = await trasCargar({ retrocesoTrasCombate: 1 })
    await gestor.atacar('barbaro', 'orco-2')
    expect(entre(gestor, 'barbaro', 'orco-2')).toBe(2)
  })

  it('también atacando uno a uno', async () => {
    const { gestor } = await trasCargar({ retrocesoTrasCombate: 1 }, false)
    await gestor.atacar('barbaro', 'orco-2')
    expect(entre(gestor, 'barbaro', 'orco-2')).toBe(2)
  })

  it('tras destruir en cuerpo a cuerpo a la escuadra atacada, la atacante avanza hacia el enemigo más cercano', async () => {
    const { gestor, p } = await trasCargar({ consolidacionTrasCombate: 2 })
    gestor.anadirPersonajes('estancia-1', [{ id: 'goblin', nombre: 'Goblin', jugador: 'oscuridad', casilla: { x: 5, y: 1 } }])
    p.atacarEscuadra.mockImplementationOnce(async (_ataque, mapa) => (mapa.eliminarPersonaje('orco-1'), mapa.eliminarPersonaje('orco-2'), { quedanAcciones: false }))
    await gestor.atacar('barbaro', 'orco-2')
    expect(entre(gestor, 'barbaro', 'goblin')).toBe(5)
  })

  it('tras un ataque a distancia, nadie retrocede', async () => {
    const { gestor } = await conNegros(true, { retrocesoTrasCombate: 1 })
    await gestor.atacar('barbaro', 'orco-2')
    expect(casillaDe(gestor, 'barbaro')).toEqual({ x: 1, y: 1 })
  })
})

describe('gestor del mapa: ataques', () => {
  /** Estancia amplia con un orco de la Oscuridad (3 de vida) pegado a la izquierda del bárbaro */
  async function conOrco(conElfo = false) {
    const inicial = await conInicial(amplia, conElfo)
    const desde = inicial.barbaro().casilla ?? { x: 0, y: 0 }
    inicial.gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', vida: 3, casilla: { x: desde.x - 1, y: desde.y } }])
    const orco = () => inicial.gestor.mapa.personajesNoJugadores?.find((p) => p.id === 'orco')
    return { ...inicial, orco }
  }

  it('los personajes empiezan con la vida de su clase', async () => {
    const { barbaro } = await conInicial()
    expect(barbaro().vida).toBe(4)
  })

  it('la clase del atacante resuelve el ataque, con su tipo y su distancia', async () => {
    const { gestor, p, barbaro, orco } = await conOrco()
    const [atacante, objetivo] = [barbaro(), orco()]
    await gestor.atacar('barbaro', 'orco')
    expect(p.atacar.mock.lastCall?.[0]).toMatchObject({ atacante, objetivo, tipo: 'cuerpo-a-cuerpo', distancia: 1, recorrido: 1, trayectoria: { casillas: [] } })
  })

  it('el ataque se apunta en el turno del personaje y en el de su escuadra', async () => {
    const { gestor, barbaro } = await conOrco()
    await gestor.atacar('barbaro', 'orco')
    const rojos = gestor.mapa.escuadras?.[0]
    expect([turnoDePersonaje(barbaro(), 1).acciones, rojos && turnoDeEscuadra(rojos, 1).acciones]).toEqual([['atacar'], [{ accion: 'atacar', personaje: 'barbaro' }]])
  })

  it('lo que resuelve la clase (si le quedan acciones) queda en el turno del atacante', async () => {
    const { gestor, barbaro } = await conOrco()
    await gestor.atacar('barbaro', 'orco')
    expect(turnoDePersonaje(barbaro(), 1).quedanAcciones).toBe(false)
  })

  it('si al atacante ya no le quedan acciones, termina su activación; solo, la de su escuadra', async () => {
    const { gestor } = await conOrco()
    await gestor.atacar('barbaro', 'orco')
    expect(activacionDe(gestor.mapa, 'rojos')?.terminada).toBe(true)
  })

  it('en una escuadra con más personajes, la de la escuadra sigue para los demás', async () => {
    const { gestor } = await conOrco(true)
    await gestor.atacar('barbaro', 'orco')
    expect([activacionDe(gestor.mapa, 'rojos')?.terminada, gestor.motivoParaNoActuar('elfo')]).toEqual([false, undefined])
  })

  it('el que ya no tiene acciones no puede actuar ni moverse más', async () => {
    const { gestor } = await conOrco(true)
    await gestor.atacar('barbaro', 'orco')
    expect([gestor.motivoParaNoActuar('barbaro'), await gestor.opcionesMovimiento('barbaro')]).toEqual(['Bárbaro ya ha terminado su activación', undefined])
  })

  it('cuando a ninguno de la escuadra le quedan acciones, termina su activación', async () => {
    const { gestor } = await conOrco(true)
    await gestor.atacar('barbaro', 'orco')
    await gestor.atacar('elfo', 'orco')
    expect(activacionDe(gestor.mapa, 'rojos')?.terminada).toBe(true)
  })

  it('con acciones aún, la activación sigue', async () => {
    const { gestor } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    expect(activacionDe(gestor.mapa, 'rojos')?.terminada).toBe(false)
  })

  it('si la clase dice que no puede atacarlo, no ataca y dice por qué', async () => {
    const { gestor, p } = await conOrco()
    p.motivoParaNoAtacar.mockReturnValueOnce('Fuera de alcance')
    expect([await gestor.atacar('barbaro', 'orco'), p.atacar.mock.calls.length]).toEqual(['Fuera de alcance', 0])
  })

  it('se puede preguntar antes si puede atacar: lo decide su clase con los datos del ataque', async () => {
    const { gestor, p } = await conOrco()
    p.motivoParaNoAtacar.mockReturnValueOnce('Fuera de alcance')
    expect([await gestor.motivoParaNoAtacar('barbaro', 'orco'), p.motivoParaNoAtacar.mock.lastCall?.[0]]).toMatchObject(['Fuera de alcance', { tipo: 'cuerpo-a-cuerpo', distancia: 1 }])
  })

  it('preguntar no ataca ni apunta nada', async () => {
    const { gestor, p, barbaro } = await conOrco()
    await gestor.motivoParaNoAtacar('barbaro', 'orco')
    expect([p.atacar.mock.calls.length, turnoDePersonaje(barbaro(), 1).acciones]).toEqual([0, []])
  })

  it('con reducirVida y eliminarPersonaje, la clase hiere y elimina al objetivo', async () => {
    const { gestor, p, orco } = await conOrco()
    p.atacar.mockImplementationOnce(async ({ objetivo }, mapa) => {
      mapa.reducirVida(objetivo.id, 3)
      mapa.eliminarPersonaje(objetivo.id)
      return { quedanAcciones: false }
    })
    await gestor.atacar('barbaro', 'orco')
    expect(orco()).toBeUndefined()
  })

  it('reducirVida quita esos puntos', async () => {
    const { gestor, orco } = await conOrco()
    gestor.reducirVida('orco', 2)
    expect(orco()?.vida).toBe(1)
  })

  it('reducirVida de quien no lleva la cuenta dice por qué', async () => {
    const { gestor } = await conOrco()
    expect(gestor.reducirVida('enano', 1)).toBe('Enano no lleva la cuenta de su vida')
  })

  it('no se ataca a quien no es enemigo', async () => {
    const { gestor } = await conOrco()
    gestor.cambiarJugadores({ ...REPARTO, alianzas: REPARTO.alianzas.map((a) => ({ ...a, posturas: {} })) })
    expect(await gestor.atacar('barbaro', 'orco')).toBe('Orco no es enemigo de Bárbaro')
  })

  it('si la clase falla o se cancela, el ataque no se apunta', async () => {
    const { gestor, p, barbaro } = await conOrco()
    p.atacar.mockRejectedValueOnce(new Error('cancelado'))
    await expect(gestor.atacar('barbaro', 'orco')).rejects.toThrow('cancelado')
    expect(turnoDePersonaje(barbaro(), 1).acciones).toEqual([])
  })
})

describe('gestor del mapa: ataques de personajes no jugadores', () => {
  /** El orco de la Oscuridad en 0,0 y el bárbaro (los rojos ya terminaron) en 1,0, con Héroes y Monstruos hostiles entre sí: le toca a la Oscuridad */
  function conOrcoEnTurno() {
    const mutuo: Jugadores = { ...REPARTO, alianzas: [{ id: 'heroes', nombre: 'Héroes', posturas: { monstruos: 'hostil' } }, REPARTO.alianzas[1]] }
    const gestor = new GestorMapa(proveedor(), {
      estancias: [{ id: 'sala', tipo: 'sala', columnas: 5, filas: 3, puertas: [], elementos: [], estancias: [] }],
      escuadras: [
        {
          id: 'rojos',
          nombre: 'Rojos',
          jugador: 'j1',
          personajes: [{ id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', casilla: { x: 1, y: 0 }, vida: 4, turnos: [] }],
          turnos: [{ numero: 1, activacion: { modo: 'normal', terminada: true }, acciones: [] }],
        },
      ],
      personajesNoJugadores: [{ id: 'orco', nombre: 'Orco', estancia: 'sala', casilla: { x: 0, y: 0 }, turnos: [], jugador: 'oscuridad' }],
      jugadores: mutuo,
      turno: 1,
    })
    const atacar = vi.fn(async (_ataque: Ataque, _mapa: MapaEnJuego): Promise<ResultadoAccion> => ({ quedanAcciones: false }))
    const motivoParaNoAtacar = vi.fn((_ataque: Ataque, _mapa: MapaEnJuego): string | undefined => undefined)
    return { gestor, atacar, motivoParaNoAtacar, clase: { atacar, motivoParaNoAtacar } }
  }

  it('el ataque lo resuelve quien se le pasa, con su tipo y su distancia', async () => {
    const { gestor, atacar, clase } = conOrcoEnTurno()
    await gestor.atacarNoJugador('orco', 'barbaro', clase)
    expect(atacar.mock.lastCall?.[0]).toMatchObject({ atacante: { id: 'orco' }, objetivo: { id: 'barbaro' }, tipo: 'cuerpo-a-cuerpo', distancia: 1 })
  })

  it('si ya no le quedan acciones, su activación termina', async () => {
    const { gestor, clase } = conOrcoEnTurno()
    await gestor.atacarNoJugador('orco', 'barbaro', clase)
    expect(activacionDeNoJugador(gestor.mapa, 'orco')?.activacion.terminada).toBe(true)
  })

  it('si aún le quedan, sigue activándose', async () => {
    const { gestor, atacar, clase } = conOrcoEnTurno()
    atacar.mockResolvedValueOnce({ quedanAcciones: true })
    await gestor.atacarNoJugador('orco', 'barbaro', clase)
    expect(gestor.motivoParaNoActuarNoJugador('orco')).toBeUndefined()
  })

  it('si la clase que se le pasa dice que no puede, no ataca y dice por qué', async () => {
    const { gestor, atacar, motivoParaNoAtacar, clase } = conOrcoEnTurno()
    motivoParaNoAtacar.mockReturnValueOnce('Demasiado lejos')
    expect([await gestor.atacarNoJugador('orco', 'barbaro', clase), atacar.mock.calls.length]).toEqual(['Demasiado lejos', 0])
  })

  it('no ataca a quien no es enemigo', async () => {
    const { gestor, clase } = conOrcoEnTurno()
    gestor.cambiarJugadores(REPARTO)
    expect(await gestor.atacarNoJugador('orco', 'barbaro', clase)).toBe('Bárbaro no es enemigo de Orco')
  })
})

describe('gestor del mapa: buscar trampas', () => {
  it('los personajes de una escuadra buscan trampas', async () => {
    const { gestor } = await conInicial()
    expect((await gestor.accionesDisponibles('rojos', 'barbaro')).map((a) => a.id)).toContain('buscar-trampas')
  })

  it('salvo si su escuadra no busca trampas', async () => {
    const p = proveedor()
    const escuadras = await p.listarEscuadras()
    const gestor = new GestorMapa({ ...p, listarEscuadras: async () => escuadras.map((e) => ({ ...e, buscaTrampas: false })) })
    await gestor.nuevaEstancia()
    expect([(await gestor.accionesDisponibles('rojos', 'barbaro')).map((a) => a.id), await gestor.ejecutarAccion('rojos', 'buscar-trampas', 'barbaro')]).toEqual([
      expect.not.arrayContaining(['buscar-trampas']),
      '«buscar-trampas» no es una acción disponible ahora',
    ])
  })
})

describe('gestor del mapa: personajes en juego', () => {
  /** El bárbaro y el enano de los rojos en 1,1 y 2,1, con zona de control de una casilla */
  function conZona() {
    const p = proveedor()
    const gestor = new GestorMapa(
      { ...p, configuracion: { ...p.configuracion, distanciaControl: 1, cuerpoACuerpo: 'diagonal' } },
      {
        estancias: [{ id: 'sala', tipo: 'sala', columnas: 5, filas: 3, puertas: [], elementos: [], estancias: [] }],
        escuadras: [
          {
            id: 'rojos',
            nombre: 'Rojos',
            jugador: 'j1',
            personajes: [
              { id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', casilla: { x: 1, y: 1 }, turnos: [] },
              { id: 'enano', nombre: 'Enano', estancia: 'sala', casilla: { x: 2, y: 1 }, turnos: [] },
            ],
            turnos: [],
          },
        ],
        jugadores: REPARTO,
        turno: 1,
      },
    )
    const conOrco = () => gestor.anadirPersonajes('sala', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: { x: 0, y: 1 } }])
    return { gestor, p, conOrco }
  }

  it('la clase recibe al personaje trabado si está en la zona de control de un enemigo', async () => {
    const { gestor, p, conOrco } = conZona()
    conOrco()
    await gestor.accionesDisponibles('rojos', 'barbaro')
    expect(p.acciones.mock.lastCall?.[0].estaTrabado()).toBe(true)
  })

  it('con sus apoyos: los aliados en su zona de control', () => {
    const { gestor } = conZona()
    expect(gestor.personaje('barbaro')?.conApoyos().map((a) => a.id)).toEqual(['enano'])
  })

  it('sus apoyos también son personajes en juego', () => {
    const { gestor, conOrco } = conZona()
    conOrco()
    expect(gestor.personaje('barbaro')?.conApoyos()[0].estaTrabado()).toBe(false)
  })

  it('se calcula al preguntarlo, con el mapa de ese momento', () => {
    const { gestor, conOrco } = conZona()
    const barbaro = gestor.personaje('barbaro')
    conOrco()
    expect(barbaro?.estaTrabado()).toBe(true)
  })

  it('dice quién lo traba', () => {
    const { gestor, conOrco } = conZona()
    conOrco()
    expect(gestor.personaje('barbaro')?.trabadoPor().map((p) => p.id)).toEqual(['orco'])
  })

  it('el mapa en juego da los personajes de una estancia', () => {
    const { gestor, conOrco } = conZona()
    conOrco()
    expect(gestor.personajesEn('sala').map((p) => [p.id, p.estaTrabado()])).toEqual([
      ['barbaro', true],
      ['enano', false],
      ['orco', false],
    ])
  })
})

describe('gestor del mapa: jugadores', () => {
  it('la estancia inicial guarda el reparto de jugadores de la configuración', async () => {
    const { gestor } = await conInicial()
    expect(gestor.mapa.jugadores).toEqual(REPARTO)
  })

  it('no empieza si una escuadra es de un jugador que no está en el reparto', async () => {
    const p = proveedor()
    const gestor = new GestorMapa({ ...p, configuracion: { ...p.configuracion, jugadores: { ...REPARTO, jugadores: REPARTO.jugadores.slice(1) } } })
    await expect(gestor.nuevaEstancia()).rejects.toThrow('No hay ningún jugador «j1» para Rojos')
  })

  it('dice a qué jugador le toca', async () => {
    const { gestor } = await conInicial()
    expect(gestor.jugadorEnTurno?.nombre).toBe('Ana')
  })

  it('al terminar una activación, avisa al proveedor de a quién le toca', async () => {
    const { gestor, p } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(p.turnoDe.mock.lastCall?.[0].nombre).toBe('Ana')
  })

  it('al terminar la última activación, avisa al proveedor de que ha terminado el turno', async () => {
    const { gestor, p } = await conInicial()
    await gestor.ejecutarAccion('azules', 'terminar-turno')
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(p.finDeTurno).toHaveBeenCalledWith(gestor)
  })

  it('un jugador con PNJ tiene turno y puede moverlos a mano', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    const hacia = (dx: number) => ({ x: desde.x + dx, y: desde.y })
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: hacia(1) }])
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    await gestor.moverPersonajeNoJugador('orco', [hacia(1), hacia(2)], opciones)
    expect(gestor.mapa.personajesNoJugadores?.[0].casilla).toEqual(hacia(2))
  })

  it('un PNJ movido a mano aplica alEntrar de su clase', async () => {
    const lava = { ...amplia, terrenos: [{ tipo: 'dificil' as const, efecto: 'lava', posicion: { x: 3, y: 1 }, columnas: 1, filas: 1 }] }
    const { gestor, barbaro } = await conInicial(lava)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    const hacia = (dx: number) => ({ x: desde.x + dx, y: desde.y })
    const alEntrar = vi.fn(async (_personaje: PersonajeEnJuego, _donde: Ubicacion, _mapa: MapaEnJuego): Promise<ResultadoAlEntrar> => 'seguir')
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: hacia(1) }])
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    await gestor.moverPersonajeNoJugador('orco', [hacia(1), hacia(2)], opciones, { alEntrar })
    expect(alEntrar.mock.lastCall?.[1].terreno?.efecto).toBe('lava')
  })

  it('los PNJ informan su modo inicial de activación', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: { x: desde.x - 1, y: desde.y } }])
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    expect(gestor.modoActivacionNoJugador('orco')).toBe('sigiloso')
  })

  it('en la activación de PNJ solo actúa un monstruo', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    const hacia = (dx: number) => ({ x: desde.x + dx, y: desde.y })
    gestor.anadirPersonajes('estancia-1', [
      { id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: hacia(1) },
      { id: 'goblin', nombre: 'Goblin', jugador: 'oscuridad', casilla: hacia(2) },
    ])
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    await gestor.moverPersonajeNoJugador('orco', [hacia(1), { x: desde.x + 1, y: desde.y + 1 }], opciones)
    expect(gestor.motivoParaNoActuarNoJugador('goblin')).toBe('En esta activación ya actúa Orco')
  })

  it('tras terminar la activación de un PNJ, otro PNJ del jugador puede actuar si no hay otros jugadores pendientes', async () => {
    const gestor = new GestorMapa(proveedor(), {
      estancias: [{ id: 'estancia-1', tipo: 'sala', columnas: 12, filas: 8, puertas: [], elementos: [], estancias: [] }],
      personajesNoJugadores: [
        { id: 'orco', nombre: 'Orco', jugador: 'oscuridad', estancia: 'estancia-1', casilla: { x: 1, y: 1 }, turnos: [] },
        { id: 'goblin', nombre: 'Goblin', jugador: 'oscuridad', estancia: 'estancia-1', casilla: { x: 2, y: 1 }, turnos: [] },
      ],
      jugadores: REPARTO,
      turno: 1,
    })
    gestor.ejecutarAccionNoJugador('orco', 'terminar-turno')
    expect(gestor.motivoParaNoActuarNoJugador('goblin')).toBeUndefined()
  })

  it('al terminar la activación de un jugador con PNJ pasa al siguiente jugador', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: { x: desde.x - 1, y: desde.y } }])
    await gestor.ejecutarAccion('rojos', 'terminar-turno')
    gestor.terminarActivacionJugador('oscuridad')
    expect(gestor.jugadorEnTurno?.nombre).toBe('Ana')
  })

  it('mientras una escuadra se activa, dice por qué no puede actuar otro personaje', async () => {
    const { gestor } = await conInicial()
    await gestor.ejecutarAccion('rojos', 'gritar', 'barbaro')
    expect(gestor.motivoParaNoActuar('enano')).toBe('No se puede activar hasta terminar la activación de Rojos')
  })

  it('un reparto que no vale no cambia nada y dice por qué', async () => {
    const { gestor } = await conInicial()
    const antes = gestor.mapa
    expect([gestor.cambiarJugadores({ ...REPARTO, alianzas: [] }), gestor.mapa]).toEqual(['No hay ninguna alianza «heroes» para Ana', antes])
  })

  it('un cambio de postura en mitad de la partida cambia quién es enemigo', async () => {
    const { gestor, barbaro } = await conInicial(amplia)
    const desde = barbaro().casilla ?? { x: 0, y: 0 }
    const hacia = (dx: number) => ({ x: desde.x + dx, y: desde.y })
    gestor.anadirPersonajes('estancia-1', [{ id: 'orco', nombre: 'Orco', jugador: 'oscuridad', casilla: hacia(1) }])
    gestor.cambiarJugadores({ ...REPARTO, alianzas: REPARTO.alianzas.map((a) => ({ ...a, posturas: {} })) })
    expect(await gestor.moverPersonaje('barbaro', [desde, hacia(1), hacia(2)])).toBeUndefined()
  })
})

describe('gestor del mapa: puertas interiores', () => {
  /** La sala de prueba con un muro vertical por el medio y una puerta en su tramo central (casilla 1,1, lado derecho) */
  const conMuro = { ...sala, muros: [{ desde: { x: 2, y: 0 }, hasta: { x: 2, y: 3 }, puertas: [1] }] }

  it('abrir una puerta de un muro interior solo la abre: no pide otra estancia', async () => {
    const { gestor, p } = await conInicial(conMuro)
    const misma = await gestor.abrirPuerta({ estancia: 'estancia-1', casilla: { x: 2, y: 1 } })
    expect([misma.id, p.describirEstancia.mock.calls.length, gestor.puertaEn({ estancia: 'estancia-1', casilla: { x: 1, y: 1 } })?.abierta]).toEqual(['estancia-1', 1, true])
  })
})

describe('gestor del mapa: puertas', () => {
  /** La salida de la sala de prueba (4 × 3, hacia abajo): en medio del muro de abajo */
  const salida = { estancia: 'estancia-1', casilla: { x: 2, y: 2 } }

  it('abrir una puerta pide una estancia nueva y la deja abierta hacia ella', async () => {
    const { gestor } = await conInicial()
    await gestor.abrirPuerta(salida)
    expect([gestor.mapa.estancias.map((e) => e.id), gestor.puertaEn(salida)]).toEqual([
      ['estancia-1', 'estancia-2'],
      expect.objectContaining({ id: 'salida-1', abierta: true, destino: 'estancia-2' }),
    ])
  })

  it('añade una puerta a una estancia ya construida', async () => {
    const { gestor } = await conInicial()
    expect(gestor.anadirPuerta('estancia-1', { x: 0, y: 1 }, 'izquierda')).toMatchObject({ tipo: 'salida', casilla: { x: 0, y: 1 }, lado: 'izquierda' })
  })

  it('si al abrir una puerta al otro lado ya hay una estancia explorada, conecta con ella', async () => {
    const p = proveedor()
    const gestor = new GestorMapa(p, {
      estancias: [
        { id: 'estancia-1', tipo: 'sala', columnas: 4, filas: 3, puertas: [], elementos: [], estancias: [] },
        { id: 'estancia-2', tipo: 'sala', columnas: 4, filas: 3, puertas: [], elementos: [], estancias: [], posicion: { x: 4, y: 0 } },
      ],
    })
    gestor.anadirPuerta('estancia-1', { x: 3, y: 1 }, 'derecha')
    const destino = await gestor.abrirPuerta({ estancia: 'estancia-1', casilla: { x: 3, y: 1 } })
    expect([destino.id, p.describirEstancia.mock.calls.length, gestor.puertaEn({ estancia: 'estancia-1', casilla: { x: 3, y: 1 } })?.destino]).toEqual(['estancia-2', 0, 'estancia-2'])
  })

  it('una puerta abierta no se vuelve a abrir', async () => {
    const { gestor } = await conInicial()
    await gestor.abrirPuerta(salida)
    await expect(gestor.abrirPuerta(salida)).rejects.toThrow('ya está abierta')
  })

  it('si no se da la estancia nueva, la puerta sigue cerrada', async () => {
    const { gestor, p } = await conInicial()
    p.describirEstancia.mockRejectedValueOnce(new Error('cancelada'))
    await expect(gestor.abrirPuerta(salida)).rejects.toThrow('cancelada')
    expect(gestor.puertaEn(salida)?.abierta).toBeUndefined()
  })

  it('al abrir una puerta, el proveedor sabe por qué muro se entrará', async () => {
    const { gestor, p } = await conInicial()
    await gestor.abrirPuerta(salida)
    expect(p.describirEstancia.mock.lastCall?.[1]).toBe('arriba')
  })

  it('la estancia que se abre queda con su entrada junto a la puerta, al otro lado del muro', async () => {
    const { gestor } = await conInicial()
    const nueva = await gestor.abrirPuerta(salida)
    const entrada = nueva.puertas.find((p) => p.tipo === 'entrada')
    expect(entrada && { x: (nueva.posicion?.x ?? 0) + entrada.casilla.x, y: (nueva.posicion?.y ?? 0) + entrada.casilla.y }).toEqual({ x: 2, y: 3 })
  })

  it('la estancia que se abre mantiene su orientación y pone la entrada en el muro de la puerta', async () => {
    const { gestor, p } = await conInicial()
    p.describirEstancia.mockResolvedValueOnce({ ...sala, orientacion: 'derecha' })
    const nueva = await gestor.abrirPuerta(salida)
    expect([nueva.orientacion, nueva.puertas.map((pu) => [pu.tipo, pu.lado])]).toEqual([
      'derecha',
      [
        ['entrada', 'arriba'],
        ['salida', 'derecha'],
      ],
    ])
  })

  it('si la estancia pide salir por el muro de la entrada, no se abre y la puerta sigue cerrada', async () => {
    const { gestor, p } = await conInicial()
    p.describirEstancia.mockResolvedValueOnce({ ...sala, orientacion: 'arriba' })
    await expect(gestor.abrirPuerta(salida)).rejects.toThrow('no puede salir por el muro de arriba')
    expect(gestor.puertaEn(salida)?.abierta).toBeUndefined()
  })

  it('con personajes impasables, no se pasa por encima de otro personaje', async () => {
    const p = { ...proveedor(amplia), configuracion: { ordenActivaciones: 'alternas', modosActivacion: 'agresivo-sigiloso', medicionMovimiento: 'ortogonal', terrenoPersonajes: 'impasable', distanciaControl: 0, cuerpoACuerpo: 'diagonal', coherencia: 'ninguna', distanciaCoherencia: 0, modoAtaque: 'uno-a-uno', apoyoALaCarga: 0, ajusteDelDefensor: 0, consolidacionTrasCombate: 0, retrocesoTrasCombate: 0, costeGiro: 0, costeGiroDiagonal: 0, jugadores: REPARTO } as const }
    const gestor = new GestorMapa(p, {
      estancias: [{ id: 'estancia-1', tipo: 'sala', columnas: 12, filas: 8, puertas: [], elementos: [], estancias: [] }],
      escuadras: [
        { id: 'rojos', nombre: 'Rojos', jugador: 'j1', personajes: [{ id: 'barbaro', nombre: 'Bárbaro', estancia: 'estancia-1', casilla: { x: 1, y: 1 }, turnos: [] }], turnos: [] },
        { id: 'azules', nombre: 'Azules', jugador: 'j1', personajes: [{ id: 'enano', nombre: 'Enano', estancia: 'estancia-1', casilla: { x: 2, y: 1 }, turnos: [] }], turnos: [] },
      ],
      turno: 1,
      jugadores: REPARTO,
    })
    const [barbaro, enano] = gestor.mapa.escuadras?.map((e) => e.personajes[0].casilla) ?? []
    // el enano está justo a la derecha del bárbaro: el recorrido recto lo atraviesa
    expect([enano, await gestor.moverPersonaje('barbaro', enLinea(barbaro, 2))]).toEqual([{ x: (barbaro?.x ?? 0) + 1, y: barbaro?.y }, 'El recorrido pasa por donde no se puede'])
  })
})
