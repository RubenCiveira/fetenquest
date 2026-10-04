import { describe, expect, it } from 'vitest'
import { conVidaReducida, enemigoEn, lineaDeCasillas, medirAtaque, sinPersonaje, trayectoria } from './ataques'
import { crearEstancia } from './estancias'
import type { Casilla } from './modelo/casilla'
import type { Configuracion } from './modelo/configuracion'
import type { Objeto } from './modelo/elemento'
import type { Mapa } from './modelo/mapa'
import type { Personaje } from './modelo/personaje'
import type { Postura } from './modelo/alianza'

const barbaro: Personaje = { id: 'barbaro', nombre: 'Bárbaro', estancia: 'sala', casilla: { x: 1, y: 1 }, vida: 8, turnos: [] }
/** Sala de 6 × 3 con el bárbaro de Ana (Héroes) en 1,1 y un orco de la Oscuridad (Monstruos, con esa postura hacia los Héroes) */
const sala = (orco: Casilla, haciaHeroes: Postura = 'hostil', objetos: Objeto[] = []): Mapa => ({
  estancias: [{ ...crearEstancia({ id: 'sala', tipo: 'sala', columnas: 6, filas: 3 }), elementos: objetos }],
  escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'ana', personajes: [barbaro], turnos: [] }],
  personajesNoJugadores: [{ id: 'orco', nombre: 'Orco', estancia: 'sala', casilla: orco, vida: 3, turnos: [], jugador: 'oscuridad' }],
  jugadores: {
    alianzas: [
      { id: 'heroes', nombre: 'Héroes' },
      { id: 'monstruos', nombre: 'Monstruos', posturas: { heroes: haciaHeroes } },
    ],
    jugadores: [
      { id: 'ana', nombre: 'Ana', tipo: 'humano', alianza: 'heroes' },
      { id: 'oscuridad', nombre: 'La Oscuridad', tipo: 'ia', alianza: 'monstruos' },
    ],
  },
})
const orcoDe = (m: Mapa) => m.personajesNoJugadores?.[0] ?? barbaro
const sinDiagonales = { medicionMovimiento: 'ortogonal', terrenoPersonajes: 'normal', distanciaControl: 0, cuerpoACuerpo: 'diagonal' } as const
const medir = (m: Mapa, config: Pick<Configuracion, 'medicionMovimiento' | 'terrenoPersonajes' | 'cuerpoACuerpo'> = sinDiagonales) => medirAtaque(m, config, barbaro, orcoDe(m))
const casilla = (id: string, x: number, y: number): Objeto => ({ id, tipo: 'objeto', nombre: id, columnas: 1, filas: 1, posicion: { x, y } })

describe('enemigo bajo el puntero', () => {
  it('el enemigo que está en esa casilla', () => {
    expect(enemigoEn(sala({ x: 4, y: 1 }), 'barbaro', { x: 4, y: 1 })?.id).toBe('orco')
  })

  it('uno que no es enemigo no cuenta', () => {
    expect(enemigoEn(sala({ x: 4, y: 1 }, 'neutral'), 'barbaro', { x: 4, y: 1 })).toBeUndefined()
  })

  it('la casilla vacía, nadie', () => {
    expect(enemigoEn(sala({ x: 4, y: 1 }), 'barbaro', { x: 3, y: 1 })).toBeUndefined()
  })
})

describe('tipo de ataque', () => {
  it('pegado, cuerpo a cuerpo', () => {
    expect(medir(sala({ x: 2, y: 1 }))).toMatchObject({ tipo: 'cuerpo-a-cuerpo', distancia: 1 })
  })

  it('pegado en diagonal, también cuerpo a cuerpo si se permite, a 1', () => {
    expect(medir(sala({ x: 2, y: 2 }))).toMatchObject({ tipo: 'cuerpo-a-cuerpo', distancia: 1 })
  })

  it('pegado en diagonal, sin cuerpo a cuerpo en diagonal, es a distancia', () => {
    expect(medir(sala({ x: 2, y: 2 }), { ...sinDiagonales, cuerpoACuerpo: 'ortogonal' })).toMatchObject({ tipo: 'distancia', distancia: 2 })
  })

  it('pegado en recto, siempre cuerpo a cuerpo', () => {
    expect(medir(sala({ x: 2, y: 1 }), { ...sinDiagonales, cuerpoACuerpo: 'ortogonal' })?.tipo).toBe('cuerpo-a-cuerpo')
  })

  it('en diagonal con la esquina tapada por dos objetos, a distancia', () => {
    const objetos: Objeto[] = [
      { id: 'c1', tipo: 'objeto', nombre: 'c1', columnas: 1, filas: 1, posicion: { x: 2, y: 1 } },
      { id: 'c2', tipo: 'objeto', nombre: 'c2', columnas: 1, filas: 1, posicion: { x: 1, y: 2 } },
    ]
    expect(medir(sala({ x: 2, y: 2 }, 'hostil', objetos))?.tipo).toBe('distancia')
  })

  it('lejos, a distancia', () => {
    expect(medir(sala({ x: 5, y: 2 }))?.tipo).toBe('distancia')
  })
})

describe('distancias del ataque', () => {
  const lejos = sala({ x: 4, y: 2 })

  it('sin diagonales, la distancia cuenta casilla a casilla en recto', () => {
    expect(medir(lejos)?.distancia).toBe(4)
  })

  it('con la diagonal como recta, la mayor de las dos', () => {
    expect(medir(lejos, { ...sinDiagonales, medicionMovimiento: 'diagonal' })?.distancia).toBe(3)
  })

  it('por Pitágoras, redondeando hacia arriba', () => {
    expect(medir(lejos, { ...sinDiagonales, medicionMovimiento: 'euclidea' })?.distancia).toBe(4)
  })

  it('el recorrido es lo que costaría llegar moviéndose, rodeando lo que estorba', () => {
    expect(medir(sala({ x: 3, y: 1 }, 'hostil', [casilla('c1', 2, 1), casilla('c2', 2, 2)]))).toMatchObject({ distancia: 2, recorrido: 4 })
  })

  it('sin forma de llegar, no hay recorrido', () => {
    expect(medir(sala({ x: 3, y: 1 }, 'hostil', [casilla('c0', 2, 0), casilla('c1', 2, 1), casilla('c2', 2, 2)]))?.recorrido).toBeUndefined()
  })
})

describe('trayectoria del ataque', () => {
  it('en recto, las casillas de una fila', () => {
    expect(lineaDeCasillas({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  it('en diagonal, por las esquinas', () => {
    expect(lineaDeCasillas({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
  })

  it('en otro ángulo, las casillas que cruza la línea', () => {
    expect(lineaDeCasillas({ x: 0, y: 0 }, { x: 3, y: 1 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
  })

  /** El bárbaro en 1,1 ataca al orco en 5,1: el elfo (aliado) en 2,1, un goblin (enemigo) en 3,1, barro difícil (cobertura ligera) en 4,1 y un cofre en 4,1 */
  const cruzada = (): Mapa => {
    const m = sala({ x: 5, y: 1 }, 'hostil', [casilla('cofre', 4, 1)])
    return {
      ...m,
      estancias: [{ ...m.estancias[0], terrenos: [{ tipo: 'dificil', cobertura: 'ligera', posicion: { x: 4, y: 1 }, columnas: 1, filas: 1 }] }],
      escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'ana', personajes: [barbaro, { id: 'elfo', nombre: 'Elfo', estancia: 'sala', casilla: { x: 2, y: 1 }, turnos: [] }], turnos: [] }],
      personajesNoJugadores: [...(m.personajesNoJugadores ?? []), { id: 'goblin', nombre: 'Goblin', estancia: 'sala', casilla: { x: 3, y: 1 }, turnos: [], jugador: 'oscuridad' }],
    }
  }
  const deLaCruzada = () => trayectoria(cruzada(), barbaro, orcoDe(cruzada()))

  it('las casillas entre los dos, sin contar las suyas', () => {
    expect(deLaCruzada()?.casillas).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
  })

  it('cuenta los personajes aliados y enemigos que cruza', () => {
    expect(deLaCruzada()).toMatchObject({ aliados: 1, enemigos: 1 })
  })

  it('cuenta las casillas que dan cada tipo de cobertura', () => {
    expect(deLaCruzada()?.coberturas).toEqual({ ninguna: 2, ligera: 1, pesada: 0, bloqueante: 0 })
  })

  it('un terreno bloqueante también se cuenta, aunque no se pueda pisar', () => {
    const m = cruzada()
    const conPilar = { ...m, estancias: [{ ...m.estancias[0], terrenos: [{ tipo: 'impasable' as const, cobertura: 'bloqueante' as const, posicion: { x: 3, y: 0 }, columnas: 1, filas: 3 }] }] }
    expect(trayectoria(conPilar, barbaro, orcoDe(conPilar))?.coberturas.bloqueante).toBe(1)
  })

  it('cuenta las casillas con objetos', () => {
    expect(deLaCruzada()?.objetos).toBe(1)
  })

  /** Dos salas de 3 × 1 pegadas, el bárbaro en la izquierda y el orco en la derecha, con la puerta entre ellas abierta o no */
  const pegadas = (abierta: boolean): Mapa => {
    const m = sala({ x: 1, y: 0 })
    const izquierda = { ...crearEstancia({ id: 'sala', tipo: 'sala', columnas: 3, filas: 1 }), puertas: [{ id: 'p', tipo: 'salida' as const, casilla: { x: 2, y: 0 }, lado: 'derecha' as const, abierta }] }
    return {
      ...m,
      estancias: [izquierda, { ...crearEstancia({ id: 'otra', tipo: 'sala', columnas: 3, filas: 1 }), posicion: { x: 3, y: 0 } }],
      escuadras: [{ id: 'rojos', nombre: 'Rojos', jugador: 'ana', personajes: [{ ...barbaro, casilla: { x: 0, y: 0 } }], turnos: [] }],
      personajesNoJugadores: m.personajesNoJugadores?.map((p) => ({ ...p, estancia: 'otra' })),
    }
  }
  const muros = (m: Mapa) => trayectoria(m, m.escuadras?.[0].personajes[0] ?? barbaro, orcoDe(m))?.muros

  it('cuenta los muros que cruza entre estancias', () => {
    expect(muros(pegadas(false))).toBe(1)
  })

  it('por una puerta abierta no hay muro', () => {
    expect(muros(pegadas(true))).toBe(0)
  })
})

describe('vida', () => {
  it('se reduce en esos puntos', () => {
    expect(orcoDe(conVidaReducida(sala({ x: 4, y: 1 }), 'orco', 2)).vida).toBe(1)
  })

  it('no baja de cero', () => {
    expect(orcoDe(conVidaReducida(sala({ x: 4, y: 1 }), 'orco', 9)).vida).toBe(0)
  })

  it('también la de los personajes de escuadra', () => {
    expect(conVidaReducida(sala({ x: 4, y: 1 }), 'barbaro', 3).escuadras?.[0].personajes[0].vida).toBe(5)
  })

  it('conserva la vida máxima antes de herirlo', () => {
    expect(orcoDe(conVidaReducida(sala({ x: 4, y: 1 }), 'orco', 2)).vidaMax).toBe(3)
  })
})

describe('quitar personajes', () => {
  it('quitar a un personaje no jugador del mapa', () => {
    expect(sinPersonaje(sala({ x: 4, y: 1 }), 'orco').personajesNoJugadores).toEqual([])
  })

  it('quitar a un personaje de su escuadra', () => {
    expect(sinPersonaje(sala({ x: 4, y: 1 }), 'barbaro').escuadras?.[0].personajes).toEqual([])
  })
})
