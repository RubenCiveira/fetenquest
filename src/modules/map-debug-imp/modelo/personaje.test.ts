import { describe, expect, it, vi } from 'vitest'
import type { Personaje, PersonajeEnJuego, MapaEnJuego, Puerta } from '../../gamemap'
import { esComando } from '../../gamemap'
import { PersonajeDePrueba, MOVIMIENTO_DE_PRUEBA, movimientoDePrueba, PROBABILIDAD_DETENERSE_EN_LAVA, PROBABILIDAD_DE_TRAMPA } from './personaje'
import { JUGADOR_MONSTRUOS, JUGADORES_DE_PRUEBA } from '../configuracion'
import { PuertasDePrueba } from './puerta'

/** El personaje en juego, sin trabar y sin apoyos */
const enJuego = <P extends Personaje>(p: P): P & PersonajeEnJuego => ({ ...p, estaTrabado: () => false, trabadoPor: () => [], conApoyos: () => [] })

/** Mapa en juego vacío en el turno 1 */
const turno1: MapaEnJuego = {
  mapa: { estancias: [], turno: 1 },
  personaje: () => undefined,
  personajesEn: () => [],
  puertaEn: () => undefined,
  terrenoEn: () => undefined,
  tieneFlag: () => false,
  marcarFlag: vi.fn(),
  quitarFlag: vi.fn(),
  dameLoQueEstaAlLado: () => [],
  quitarElemento: vi.fn(),
  abrirPuerta: vi.fn(),
  anadirPuerta: vi.fn(),
  anadirPersonajes: vi.fn(),
  anadirMuebles: vi.fn(),
  reducirVida: vi.fn(),
  eliminarPersonaje: vi.fn(),
  desplazar: vi.fn(),
  desplazarEscuadra: vi.fn(),
  cambiarJugadores: vi.fn(),
  terminarTurno: vi.fn(),
}

/** Diálogos del banco de pruebas: el daño que se decide y el aviso, que se cierra al momento */
const dialogos = (dano = 1) => ({ resolverAtaque: vi.fn(async () => dano), repartirDano: vi.fn(async () => ({})), avisar: vi.fn(async (_aviso: { titulo: string; texto: string }) => {}) })

describe('personaje de prueba', () => {
  it('sin moverse, tiene todo su movimiento', () => {
    expect(movimientoDePrueba({ casillas: 0, acciones: [] })).toEqual(MOVIMIENTO_DE_PRUEBA)
  })

  it('tras moverse de forma normal, le queda el resto del movimiento, cargar con lo que le queda de la carga y deslizar', () => {
    const opciones = movimientoDePrueba({ casillas: 2, acciones: ['mover'] })
    expect([opciones?.base.tramos, opciones?.variaciones.map((v) => [v.id, v.tramos.map((t) => t.distancia)])]).toEqual([
      [{ distancia: 4 }],
      [
        ['cargar', [6]],
        ['mover-y-deslizar', [4, 3]],
      ],
    ])
  })

  it('con todo el movimiento gastado, solo puede deslizar (y cargar con lo que le queda de la carga)', () => {
    expect(movimientoDePrueba({ casillas: 6, acciones: ['mover'] })?.variaciones.map((v) => v.tramos.map((t) => t.distancia))).toEqual([[2], [0, 3]])
  })

  it('tras una carga parcial, puede seguir cargando con lo que le queda', () => {
    expect(movimientoDePrueba({ casillas: 2, acciones: ['cargar'] })?.variaciones.map((v) => [v.id, v.tramos.map((t) => t.distancia)])).toEqual([
      ['cargar', [6]],
      ['mover-y-deslizar', [4, 3]],
    ])
  })

  it('tras agotar la carga, ya no carga', () => {
    expect(movimientoDePrueba({ casillas: 8, acciones: ['cargar'] })?.variaciones.map((v) => v.id)).toEqual(['mover-y-deslizar'])
  })

  it.each(['posicionarse', 'destrabarse'])('tras %s, ya no carga', (accion) => {
    expect(movimientoDePrueba({ casillas: 2, acciones: [accion] })?.variaciones.map((v) => v.id)).toEqual(['mover-y-deslizar'])
  })

  it('si ya ha deslizado, no puede moverse más', () => {
    expect(movimientoDePrueba({ casillas: 7, acciones: ['mover', 'deslizar'] })).toBeUndefined()
  })

  it('tras encararse sin moverse, sigue pudiendo cargar: es parte del movimiento', () => {
    expect(movimientoDePrueba({ casillas: 1, acciones: [] })?.variaciones.map((v) => v.id)).toEqual(MOVIMIENTO_DE_PRUEBA.variaciones.map((v) => v.id))
  })

  it('lo que le costó encararse se descuenta de cada forma de moverse', () => {
    const opciones = movimientoDePrueba({ casillas: 1, acciones: [] })
    expect([opciones?.base.tramos, opciones?.variaciones.map((v) => v.tramos.map((t) => t.distancia))]).toEqual([[{ distancia: 5 }], [[7], [5, 3], [5], [5]]])
  })
})

describe('acciones del personaje de prueba', () => {
  const salida: Puerta = { id: 'salida-1', tipo: 'salida', casilla: { x: 2, y: 3 }, lado: 'abajo' }
  const mapa: MapaEnJuego = {
    mapa: { estancias: [], turno: 1 },
    puertaEn: () => salida,
    terrenoEn: () => undefined,
    tieneFlag: () => false,
    marcarFlag: vi.fn(),
    dameLoQueEstaAlLado: () => [],
    quitarFlag: vi.fn(),
    desplazar: vi.fn(),
    desplazarEscuadra: vi.fn(),
    quitarElemento: vi.fn(),
    reducirVida: vi.fn(),
    eliminarPersonaje: vi.fn(),
    abrirPuerta: vi.fn(),
    anadirPuerta: vi.fn(),
    anadirPersonajes: vi.fn(),
    anadirMuebles: vi.fn(),
    cambiarJugadores: vi.fn(),
    terminarTurno: vi.fn(),
    personaje: () => undefined,
    personajesEn: () => [],
  }
  const enLaPuerta: Personaje = { id: 'barbaro', nombre: 'Bárbaro', estancia: 'estancia-1', casilla: { x: 2, y: 3 }, turnos: [] }
  /** El bárbaro, con la puerta de su casilla asociada */
  function barbaro() {
    const puertas = new PuertasDePrueba()
    puertas.asociar({ id: 'estancia-1', tipo: 'sala', columnas: 5, filas: 4, puertas: [salida], elementos: [], estancias: [] })
    return new PersonajeDePrueba({ id: 'barbaro', nombre: 'Bárbaro' }, puertas, dialogos())
  }

  it('en una salida cerrada, compone el comando de abrirla que da la puerta', async () => {
    expect((await barbaro().acciones(enLaPuerta, mapa)).map((a) => a.id)).toEqual(['abrir-puerta'])
  })

  /** El mapa en juego con el bárbaro, en la escuadra de Ana, con esos turnos */
  const conTurnos = (turnos: Personaje['turnos']) => ({
    ...mapa,
    abrirPuerta: vi.fn(),
    anadirPuerta: vi.fn(),
    mapa: { ...mapa.mapa, escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'ana', personajes: [{ ...enLaPuerta, turnos }], turnos: [] }] },
  })
  /** El bárbaro abre la puerta con esos turnos: lo que resuelve, o el error, y si se abrió */
  async function abrirCon(turnos: Personaje['turnos'], avisos = dialogos()) {
    const puertas = new PuertasDePrueba()
    puertas.asociar({ id: 'estancia-1', tipo: 'sala', columnas: 5, filas: 4, puertas: [salida], elementos: [], estancias: [] })
    const mapaEnJuego = conTurnos(turnos)
    const [abrir] = await new PersonajeDePrueba({ id: 'barbaro', nombre: 'Bárbaro' }, puertas, avisos).acciones({ ...enLaPuerta, turnos }, mapaEnJuego)
    const resultado = await (abrir ? abrir.exec() : Promise.resolve(undefined)).catch((error: unknown) => error)
    return { resultado, abierta: mapaEnJuego.abrirPuerta.mock.calls.length > 0, avisos }
  }

  it('aunque ya haya hecho su acción, se le ofrecen: se comprueba al hacerla', async () => {
    const yaActuo = { ...enLaPuerta, turnos: [{ numero: 1, acciones: ['abrir-puerta'], movimientos: [] }] }
    expect((await barbaro().acciones(yaActuo, mapa)).map((a) => a.id)).toEqual(['abrir-puerta'])
  })

  it('con su acción del turno, la hace y resuelve que ya no le quedan', async () => {
    expect(await abrirCon([])).toMatchObject({ resultado: { quedanAcciones: false }, abierta: true })
  })

  it('sin su acción del turno, lo avisa en un diálogo', async () => {
    const { avisos } = await abrirCon([{ numero: 1, acciones: ['coger-objeto-cofre'], movimientos: [] }])
    expect(avisos.avisar).toHaveBeenCalledWith({ titulo: 'Sin acciones', texto: 'Bárbaro ya ha hecho su acción de este turno.' })
  })

  it('sin su acción del turno, no la hace y se cancela', async () => {
    const { resultado, abierta } = await abrirCon([{ numero: 1, acciones: ['coger-objeto-cofre'], movimientos: [] }])
    expect([resultado instanceof DOMException && resultado.name, abierta]).toEqual(['AbortError', false])
  })

  it('moverse no cuenta como acción', async () => {
    expect(await abrirCon([{ numero: 1, acciones: [], movimientos: [{ opcion: 'mover', casillas: 3, acciones: ['mover'] }] }])).toMatchObject({ abierta: true })
  })

  it('lo que hizo en turnos anteriores no cuenta', async () => {
    expect(await abrirCon([{ numero: 0, acciones: ['abrir-puerta'], movimientos: [] }])).toMatchObject({ abierta: true })
  })

  it('en una casilla sin objetos, o en la zona de espera, no tiene acciones', async () => {
    const lejos = { ...enLaPuerta, casilla: { x: 0, y: 0 } }
    const enEspera = { ...enLaPuerta, casilla: undefined }
    expect([await barbaro().acciones(lejos, mapa), await barbaro().acciones(enEspera, mapa)]).toEqual([[], []])
  })

  it('junto a un mueble sin revisar puede revisarlo', async () => {
    const conMueble = { ...mapa, dameLoQueEstaAlLado: () => [{ id: 'mesa', tipo: 'mueble' as const, nombre: 'Mesa', columnas: 1, filas: 1 }] }
    expect((await barbaro().acciones(enLaPuerta, conMueble)).map((a) => a.id)).toEqual(['abrir-puerta', 'revisar-mueble-mesa'])
  })

  it('revisarlo lo marca revisado', async () => {
    const conMueble = { ...mapa, marcarFlag: vi.fn(), dameLoQueEstaAlLado: () => [{ id: 'mesa', tipo: 'mueble' as const, nombre: 'Mesa', columnas: 1, filas: 1 }] }
    const [, revisar] = await barbaro().acciones(enLaPuerta, conMueble)
    await (esComando(revisar) && revisar.exec())
    expect(conMueble.marcarFlag).toHaveBeenCalledWith('elemento', 'mesa', 'revisado')
  })

  it('junto a un mueble revisado no puede volver a revisarlo', async () => {
    const conMueble = { ...mapa, dameLoQueEstaAlLado: () => [{ id: 'mesa', tipo: 'mueble' as const, nombre: 'Mesa', columnas: 1, filas: 1, flags: ['revisado'] }] }
    expect((await barbaro().acciones(enLaPuerta, conMueble)).map((a) => a.id)).toEqual(['abrir-puerta'])
  })
})

describe('coger objetos', () => {
  const cofre = { id: 'cofre', tipo: 'objeto' as const, nombre: 'Cofre', columnas: 1, filas: 1, posicion: { x: 3, y: 3 } }
  const barbaro = { id: 'barbaro', nombre: 'Bárbaro', estancia: 'estancia-1', casilla: { x: 2, y: 3 }, turnos: [] }
  const mapaCon = (motivo?: string) => ({
    mapa: { estancias: [], turno: 1 },
    puertaEn: () => undefined,
    terrenoEn: () => undefined,
    tieneFlag: () => false,
    marcarFlag: vi.fn(),
    dameLoQueEstaAlLado: () => [cofre],
    quitarElemento: vi.fn(() => motivo),
    reducirVida: vi.fn(),
    eliminarPersonaje: vi.fn(),
    quitarFlag: vi.fn(),
    desplazar: vi.fn(),
    desplazarEscuadra: vi.fn(),
    abrirPuerta: vi.fn(),
    anadirPuerta: vi.fn(),
    anadirPersonajes: vi.fn(),
    anadirMuebles: vi.fn(),
    cambiarJugadores: vi.fn(),
    terminarTurno: vi.fn(),
    personaje: () => undefined,
    personajesEn: () => [],
  })
  const clase = () => new PersonajeDePrueba({ id: 'barbaro', nombre: 'Bárbaro' }, new PuertasDePrueba(), dialogos())

  it('junto a un objeto puede cogerlo', async () => {
    expect((await clase().acciones(barbaro, mapaCon())).map((a) => a.nombre)).toEqual(['Coger Cofre'])
  })

  it('cogerlo lo quita de la estancia', async () => {
    const mapa = mapaCon()
    const [coger] = await clase().acciones(barbaro, mapa)
    await (esComando(coger) && coger.exec())
    expect(mapa.quitarElemento).toHaveBeenCalledWith('cofre')
  })

  it('si el mapa no lo deja quitar, el comando falla y no se apunta', async () => {
    const [coger] = await clase().acciones(barbaro, mapaCon('No hay ningún elemento «cofre» en el mapa'))
    await expect(esComando(coger) && coger.exec()).rejects.toThrow('No hay ningún elemento «cofre» en el mapa')
  })
})

describe('ataques del personaje de prueba', () => {
  const barbaro = enJuego<Personaje>({ id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', casilla: { x: 1, y: 1 }, turnos: [] })
  const orco = enJuego({ id: 'orco', nombre: 'Orco', estancia: 'sala', casilla: { x: 2, y: 1 }, vida: 3, turnos: [], jugador: 'oscuridad' })
  const trayectoria = { casillas: [], aliados: 0, enemigos: 0, coberturas: { ninguna: 0, ligera: 0, pesada: 0, bloqueante: 0 }, objetos: 0, muros: 0 }
  const ataque = { atacante: barbaro, objetivo: orco, tipo: 'cuerpo-a-cuerpo' as const, distancia: 1, recorrido: 1, trayectoria }
  // el personaje de prueba pinta cada ataque en la consola
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  /** Mapa en juego con el orco, que se queda con `vidaTras` al reducirle la vida */
  const mapaCon = (vidaTras: number) => {
    const estado = { estancias: [], turno: 1, personajesNoJugadores: [orco] }
    return {
      mapa: estado,
      puertaEn: () => undefined,
      terrenoEn: () => undefined,
      tieneFlag: () => false,
      marcarFlag: vi.fn(),
      dameLoQueEstaAlLado: () => [],
      quitarElemento: vi.fn(),
      reducirVida: vi.fn(() => void (estado.personajesNoJugadores = [{ ...orco, vida: vidaTras }])),
      eliminarPersonaje: vi.fn(),
      quitarFlag: vi.fn(),
      desplazar: vi.fn(),
      desplazarEscuadra: vi.fn(),
      abrirPuerta: vi.fn(),
      anadirPuerta: vi.fn(),
      anadirPersonajes: vi.fn(),
      anadirMuebles: vi.fn(),
      cambiarJugadores: vi.fn(),
      terminarTurno: vi.fn(),
    personaje: () => undefined,
    personajesEn: () => [],
    }
  }
  const conDano = (dano: number, avisos = dialogos(dano)) => new PersonajeDePrueba({ id: 'barbaro', nombre: 'Bárbaro' }, new PuertasDePrueba(), avisos)

  it('quita al objetivo el daño que se decide en el diálogo', async () => {
    const mapa = mapaCon(1)
    await conDano(2).atacar(ataque, mapa)
    expect(mapa.reducirVida).toHaveBeenCalledWith('orco', 2)
  })

  it('si le queda vida, no lo elimina', async () => {
    const mapa = mapaCon(1)
    await conDano(2).atacar(ataque, mapa)
    expect(mapa.eliminarPersonaje).not.toHaveBeenCalled()
  })

  it('sin vida, lo elimina', async () => {
    const mapa = mapaCon(0)
    await conDano(3).atacar(ataque, mapa)
    expect(mapa.eliminarPersonaje).toHaveBeenCalledWith('orco')
  })

  /** El mapa en juego con el bárbaro de Ana (Héroes) y el orco de la Oscuridad (Monstruos) */
  const conJugadores = () => {
    const mapa = mapaCon(1)
    return {
      ...mapa,
      mapa: {
        ...mapa.mapa,
        escuadras: [{ id: 'escuadra-barbaro', nombre: 'Escuadra del bárbaro', jugador: 'ana', personajes: [barbaro], turnos: [] }],
        jugadores: JUGADORES_DE_PRUEBA,
      },
    }
  }

  it('un héroe que ataca a un monstruo pide el daño: ya no lo mata sin más', async () => {
    const mapa = conJugadores()
    await conDano(2).atacar(ataque, mapa)
    expect(mapa.reducirVida).toHaveBeenCalledWith('orco', 2)
  })

  it('pinta en la consola los apoyos como personajes en juego, para navegarlos', async () => {
    log.mockClear()
    const enano = enJuego<Personaje>({ id: 'enano', nombre: 'Enano', estancia: 'sala', turnos: [] })
    await conDano(1).atacar({ ...ataque, atacante: { ...barbaro, conApoyos: () => [enano] } }, conJugadores())
    expect(log.mock.lastCall?.[1].apoyosDelAtacante).toEqual([enano])
  })

  it('pinta en la consola lo que el gestor dice del ataque', async () => {
    log.mockClear()
    await conDano(1).atacar({ ...ataque, trayectoria: { ...trayectoria, casillas: [{ x: 2, y: 1 }], enemigos: 1 } }, conJugadores())
    expect(log.mock.lastCall).toEqual([
      '[map-debug] Bárbaro ataca a Orco',
      expect.objectContaining({ tipo: 'cuerpo-a-cuerpo', distancia: 1, recorrido: 1, casillas: '2,1', enemigos: 1 }),
    ])
  })

  /** El orco ataca al bárbaro: los diálogos y el mapa */
  async function orcoAtaca() {
    const mapa = conJugadores()
    const avisos = dialogos()
    const resultado = await new PersonajeDePrueba({ id: 'orco', nombre: 'Orco' }, new PuertasDePrueba(), avisos).atacar({ ...ataque, atacante: orco, objetivo: barbaro }, mapa)
    return { mapa, avisos, resultado }
  }

  it('un monstruo que ataca a un héroe hace 1 de daño y lo avisa en un diálogo', async () => {
    const { avisos, mapa } = await orcoAtaca()
    expect([mapa.reducirVida.mock.calls.at(-1), avisos.avisar.mock.lastCall?.[0]]).toEqual([['barbaro', 1], { titulo: 'Ataque', texto: 'Orco ataca a Bárbaro: hace 1 de daño.' }])
  })

  it('el ataque de un monstruo no pide el daño al diálogo', async () => {
    const { avisos, mapa } = await orcoAtaca()
    expect([avisos.resolverAtaque.mock.calls.length, mapa.reducirVida.mock.calls.length]).toEqual([0, 1])
  })

  it('el ataque de un monstruo gasta su acción del turno', async () => {
    const { resultado } = await orcoAtaca()
    expect(resultado).toEqual({ quedanAcciones: false })
  })

  /** El mapa en juego en el que el bárbaro ya ha hecho su acción del turno */
  const yaActuo = () => {
    const mapa = conJugadores()
    const barbaroQueActuo = { ...barbaro, turnos: [{ numero: 1, acciones: ['coger-objeto-cofre'], movimientos: [] }] }
    return { ...mapa, mapa: { ...mapa.mapa, escuadras: mapa.mapa.escuadras.map((e) => ({ ...e, personajes: [barbaroQueActuo] })) } }
  }

  it('el ataque resuelve que ya no le quedan acciones', async () => {
    expect(await conDano(1).atacar(ataque, conJugadores())).toEqual({ quedanAcciones: false })
  })

  it('si ya ha hecho su acción del turno, lo avisa en un diálogo', async () => {
    const avisos = dialogos()
    await conDano(1, avisos).atacar(ataque, yaActuo()).catch(() => {})
    expect(avisos.avisar).toHaveBeenCalledWith({ titulo: 'Sin acciones', texto: 'Bárbaro ya ha hecho su acción de este turno.' })
  })

  it('si ya ha hecho su acción del turno, no ataca y se cancela', async () => {
    const mapa = yaActuo()
    const error = await conDano(1).atacar(ataque, mapa).catch((e: unknown) => e)
    expect([error instanceof DOMException && error.name, mapa.eliminarPersonaje.mock.calls.length]).toEqual(['AbortError', 0])
  })
})

describe('alcance de los ataques de prueba', () => {
  const sinCobertura = { ninguna: 0, ligera: 0, pesada: 0, bloqueante: 0 }
  const trayectoria = { casillas: [], aliados: 0, enemigos: 0, coberturas: sinCobertura, objetos: 0, muros: 0 }
  const orco = enJuego<Personaje>({ id: 'orco', nombre: 'Orco', estancia: 'sala', turnos: [] })
  const ataque = (distancia: number, bloqueante = 0) => ({
    atacante: enJuego<Personaje>({ id: 'x', nombre: 'x', estancia: 'sala', turnos: [] }),
    objetivo: orco,
    tipo: 'distancia' as const,
    distancia,
    trayectoria: { ...trayectoria, coberturas: { ...sinCobertura, bloqueante } },
  })
  const clase = (id: string, nombre: string) => new PersonajeDePrueba({ id, nombre }, new PuertasDePrueba(), dialogos())

  it('el bárbaro ataca a menos de 2 casillas', () => {
    expect([clase('barbaro', 'Bárbaro').motivoParaNoAtacar(ataque(1), turno1), clase('barbaro', 'Bárbaro').motivoParaNoAtacar(ataque(2), turno1)]).toEqual([
      undefined,
      'Bárbaro solo ataca hasta 1 casilla y Orco está a 2',
    ])
  })

  it('el enano llega hasta 5', () => {
    expect([clase('enano', 'Enano').motivoParaNoAtacar(ataque(5), turno1), clase('enano', 'Enano').motivoParaNoAtacar(ataque(6), turno1)]).toEqual([
      undefined,
      'Enano solo ataca hasta 5 casillas y Orco está a 6',
    ])
  })

  it('los demás, solo a 1', () => {
    expect(clase('asesino-a-sueldo-1', 'Asesino').motivoParaNoAtacar(ataque(2), turno1)).toBe('Asesino solo ataca hasta 1 casilla y Orco está a 2')
  })

  it('con terreno bloqueante en medio, nadie ataca', () => {
    expect(clase('enano', 'Enano').motivoParaNoAtacar(ataque(3, 1), turno1)).toBe('Hay terreno bloqueante entre Enano y Orco')
  })
})

describe('atacar trabado', () => {
  const sinCobertura = { ninguna: 0, ligera: 0, pesada: 0, bloqueante: 0 }
  const trayectoria = { casillas: [], aliados: 0, enemigos: 0, coberturas: sinCobertura, objetos: 0, muros: 0 }
  const orco = enJuego<Personaje>({ id: 'orco', nombre: 'Orco', estancia: 'sala', turnos: [] })
  const goblin = enJuego<Personaje>({ id: 'goblin', nombre: 'Goblin', estancia: 'sala', turnos: [] })
  /** El bárbaro trabado por el orco ataca a ese objetivo, pegado */
  const ataqueA = (objetivo: typeof orco) => ({
    atacante: { ...enJuego<Personaje>({ id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', turnos: [] }), estaTrabado: () => true, trabadoPor: () => [orco] },
    objetivo,
    tipo: 'cuerpo-a-cuerpo' as const,
    distancia: 1,
    trayectoria,
  })
  const barbaro = () => new PersonajeDePrueba({ id: 'barbaro', nombre: 'Bárbaro' }, new PuertasDePrueba(), dialogos())

  it('trabado, puede atacar a quien lo traba', () => {
    expect(barbaro().motivoParaNoAtacar(ataqueA(orco), turno1)).toBeUndefined()
  })

  it('trabado, si no llega a quien lo traba, tiene que posicionarse en contacto', () => {
    expect(barbaro().motivoParaNoAtacar({ ...ataqueA(orco), tipo: 'distancia', distancia: 2 }, turno1)).toBe('Bárbaro tiene que posicionarse en contacto con Orco para atacarle')
  })

  it('si ya ha deslizado, ya ha usado su acción', () => {
    const deslizo = { numero: 1, acciones: [], movimientos: [{ opcion: 'mover-y-deslizar', casillas: 8, acciones: ['mover', 'deslizar'] }] }
    const ataque = ataqueA(orco)
    expect(barbaro().motivoParaNoAtacar({ ...ataque, atacante: { ...ataque.atacante, turnos: [deslizo] } }, turno1)).toBe('Bárbaro ya ha usado su acción este turno')
  })

  it('si ya ha hecho otra acción (abrir una puerta…), ya ha usado su acción', () => {
    const ataque = ataqueA(orco)
    expect(barbaro().motivoParaNoAtacar({ ...ataque, atacante: { ...ataque.atacante, turnos: [{ numero: 1, acciones: ['abrir-puerta'], movimientos: [] }] } }, turno1)).toBe(
      'Bárbaro ya ha usado su acción este turno',
    )
  })

  it('trabado, no puede atacar a otro', () => {
    expect(barbaro().motivoParaNoAtacar(ataqueA(goblin), turno1)).toBe('Bárbaro está trabado: solo puede atacar a Orco')
  })
})


describe('trampas del personaje de prueba', () => {
  const heroe = enJuego<Personaje>({ id: 'barbaro', nombre: 'Bárbaro', estancia: 'estancia-1', casilla: { x: 0, y: 0 }, turnos: [] })
  const donde = { estancia: 'estancia-1', casilla: { x: 1, y: 0 } }
  // el personaje de prueba pinta cada llamada en la consola
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  /** Mapa en juego con esas flags (`tipo:id:flag`) */
  const mapaCon = (flags: string[] = [], estado: MapaEnJuego['mapa'] = { estancias: [], turno: 1 }): MapaEnJuego => ({
    mapa: estado,
    puertaEn: () => undefined,
    terrenoEn: () => undefined,
    tieneFlag: (tipo, id, flag) => flags.includes(`${tipo}:${id}:${flag}`),
    marcarFlag: vi.fn(),
    quitarFlag: vi.fn(),
    desplazar: vi.fn(),
    desplazarEscuadra: vi.fn(),
    dameLoQueEstaAlLado: () => [],
    quitarElemento: vi.fn(),
    reducirVida: vi.fn(),
    eliminarPersonaje: vi.fn(),
    abrirPuerta: vi.fn(),
    anadirPuerta: vi.fn(),
    anadirPersonajes: vi.fn(),
    anadirMuebles: vi.fn(),
    cambiarJugadores: vi.fn(),
    terminarTurno: vi.fn(),
    personaje: () => undefined,
    personajesEn: () => [],
  })
  /** El bárbaro, con el azar que salga (de 0 a 1: pisa una trampa por debajo de `PROBABILIDAD_DE_TRAMPA`) */
  const conAzar = (azar: number, avisos = dialogos()) => new PersonajeDePrueba({ id: 'barbaro', nombre: 'Bárbaro' }, new PuertasDePrueba(), avisos, () => azar)

  it('por debajo de la probabilidad, pisa una trampa y se detiene', async () => {
    expect(await conAzar(PROBABILIDAD_DE_TRAMPA - 0.01).alEntrar(heroe, donde, mapaCon())).toBe('detenerse')
  })

  it('al pisar una trampa, lo avisa en un diálogo', async () => {
    const avisos = dialogos()
    await conAzar(0, avisos).alEntrar(heroe, donde, mapaCon())
    expect(avisos.avisar.mock.lastCall?.[0].titulo).toBe('¡Trampa!')
  })

  it('al entrar en lava, avisa de que le va a hacer daño', async () => {
    const avisos = dialogos()
    await conAzar(PROBABILIDAD_DETENERSE_EN_LAVA, avisos).alEntrar(heroe, { ...donde, terreno: { tipo: 'dificil', efecto: 'lava', posicion: donde.casilla, columnas: 1, filas: 1 } }, mapaCon())
    expect(avisos.avisar.mock.lastCall?.[0].texto).toContain('le va a hacer daño')
  })

  it('al entrar en lava, termina el turno la mitad de las veces para no poder seguir moviéndose', async () => {
    expect(await conAzar(PROBABILIDAD_DETENERSE_EN_LAVA - 0.01).alEntrar(heroe, { ...donde, terreno: { tipo: 'dificil', efecto: 'lava', posicion: donde.casilla, columnas: 1, filas: 1 } }, mapaCon())).toBe('terminar-turno')
  })

  it('desde la probabilidad, sigue moviéndose', async () => {
    expect(await conAzar(PROBABILIDAD_DE_TRAMPA).alEntrar(heroe, donde, mapaCon())).toBe('seguir')
  })

  it('en una estancia en la que se han buscado trampas no las pisa', async () => {
    expect(await conAzar(0).alEntrar(heroe, donde, mapaCon(['estancia:estancia-1:sin_trampas']))).toBe('seguir')
  })

  it('los monstruos no pisan trampas', async () => {
    const orco = enJuego({ ...heroe, id: 'orco', nombre: 'Orco', jugador: JUGADOR_MONSTRUOS })
    const estado = { estancias: [], turno: 1, personajesNoJugadores: [orco], jugadores: JUGADORES_DE_PRUEBA }
    expect(await conAzar(0).alEntrar(orco, donde, mapaCon([], estado))).toBe('seguir')
  })

  it('cada llamada se ve en la consola, con lo que responde', async () => {
    await conAzar(0).alEntrar(heroe, donde, mapaCon())
    expect(log.mock.lastCall).toEqual(['[map-debug] alEntrar: Bárbaro en 1,0 de «estancia-1»', { sinPeligro: false, resultado: 'detenerse' }])
  })
})
