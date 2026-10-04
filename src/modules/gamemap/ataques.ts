import { conPersonaje, conPersonajeNoJugador, todosLosPersonajes } from './activaciones'
import { huellaEnElMapa } from './huella'
import { esEnemigo, jugadorDe } from './jugadores'
import { casillaDelMapa, conPersonajes, costeDe, enContacto, ruta, sePuedePasar } from './movimiento'
import { aristaEntre, coberturaDeArista } from './muros'
import { coberturaEn } from './terrenos'
import type { Ataque, Trayectoria } from './modelo/ataque'
import type { Casilla } from './modelo/casilla'
import type { Configuracion } from './modelo/configuracion'
import type { Elemento } from './modelo/elemento'
import type { Estancia } from './modelo/estancia'
import type { Mapa } from './modelo/mapa'
import type { TipoCobertura } from './modelo/terreno'
import type { Personaje } from './modelo/personaje'

const misma = (a: Casilla, b: Casilla) => a.x === b.x && a.y === b.y

const cubre = (el: Elemento, { x, y }: Casilla) =>
  !!el.posicion && x >= el.posicion.x && y >= el.posicion.y && x < el.posicion.x + el.columnas && y < el.posicion.y + el.filas

/** El enemigo del personaje que ocupa esa casilla del mapa (alguna de su huella), si lo hay */
export function enemigoEn(m: Mapa, personajeId: string, casilla: Casilla): Personaje | undefined {
  const alianza = jugadorDe(m, personajeId)?.alianza
  return todosLosPersonajes(m).find((p) => p.id !== personajeId && esEnemigo(m, p.id, alianza) && huellaEnElMapa(m, p).some((c) => misma(c, casilla)))
}

/**
 * Las dos casillas más cercanas de las que ocupan los dos personajes (las
 * suyas, o las de su huella si ocupan varias), según la medición (sin decirla,
 * en línea recta por Pitágoras): entre ellas se miden la distancia, el
 * contacto y la trayectoria de un ataque. Nada si alguno no está colocado
 */
export function masCercanas(m: Mapa, a: Personaje, b: Personaje, medicion: Configuracion['medicionMovimiento'] = 'euclidea'): [Casilla, Casilla] | undefined {
  const [deA, deB] = [huellaEnElMapa(m, a), huellaEnElMapa(m, b)]
  const parejas = deA.flatMap((ca) => deB.map((cb): [Casilla, Casilla] => [ca, cb]))
  // a igual distancia, la más corta en línea recta: la trayectoria más limpia
  const recta = ([p, q]: [Casilla, Casilla]) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2
  return parejas.sort((p, q) => distanciaSegun(medicion, ...p) - distanciaSegun(medicion, ...q) || recta(p) - recta(q))[0]
}

/**
 * Casillas del mapa que cruza la línea recta del centro de `desde` al de
 * `hasta`, en orden y con las dos. Si pasa justo por una esquina, sigue en
 * diagonal sin contar las casillas de los lados, que solo roza
 */
export function lineaDeCasillas(desde: Casilla, hasta: Casilla): Casilla[] {
  const [nx, ny] = [Math.abs(hasta.x - desde.x), Math.abs(hasta.y - desde.y)]
  const [sx, sy] = [Math.sign(hasta.x - desde.x), Math.sign(hasta.y - desde.y)]
  const casillas = [desde]
  let { x, y } = desde
  for (let ix = 0, iy = 0; ix < nx || iy < ny; ) {
    // qué borde de la casilla cruza antes la línea: el vertical, el horizontal o los dos a la vez (la esquina)
    const cruce = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx
    if (cruce <= 0) {
      x += sx
      ix++
    }
    if (cruce >= 0) {
      y += sy
      iy++
    }
    casillas.push({ x, y })
  }
  return casillas
}

/** Si entre dos casillas del mapa seguidas de la línea hay un muro: de una estancia a otra sin una puerta abierta entre ellas, o entrando o saliendo de las estancias */
function cruzaMuro(m: Mapa, a: Casilla, b: Casilla): boolean {
  const [desde, hasta] = [casillaDelMapa(m, a), casillaDelMapa(m, b)]
  if (!desde || !hasta) return desde !== hasta
  if (desde.estancia.id === hasta.estancia.id) return false
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return true
  const lado = (de: Casilla, a: Casilla) => (a.x > de.x ? 'derecha' : a.x < de.x ? 'izquierda' : a.y > de.y ? 'abajo' : 'arriba')
  const abierta = ({ estancia, casilla }: { estancia: Estancia; casilla: Casilla }, hacia: string) =>
    estancia.puertas.some((p) => p.abierta && p.lado === hacia && p.casilla.x === casilla.x && p.casilla.y === casilla.y)
  return !abierta(desde, lado(a, b)) && !abierta(hasta, lado(b, a))
}

const ORDEN_COBERTURA: TipoCobertura[] = ['ninguna', 'ligera', 'pesada', 'bloqueante']

/**
 * Cobertura del muro interior que cruza la línea entre dos casillas seguidas
 * del mapa, en la misma estancia; nada si no cruza ninguno. Por una esquina
 * (en diagonal), solo si el muro la atraviesa de verdad: los dos caminos en
 * recto por las casillas de los lados cruzan muro, y cuenta la menor
 */
function coberturaDeMuro(m: Mapa, a: Casilla, b: Casilla): TipoCobertura | undefined {
  const [desde, hasta] = [casillaDelMapa(m, a), casillaDelMapa(m, b)]
  if (!desde || !hasta || desde.estancia.id !== hasta.estancia.id) return
  const e = desde.estancia
  const borde = (x: Casilla, y: Casilla) => {
    const arista = aristaEntre(x, y)
    return arista && coberturaDeArista(e, arista)
  }
  const [da, db] = [desde.casilla, hasta.casilla]
  if (da.x === db.x || da.y === db.y) return borde(da, db)
  const porLosLados = [{ x: db.x, y: da.y }, { x: da.x, y: db.y }].map((lado) => {
    const coberturas = [borde(da, lado), borde(lado, db)].flatMap((c) => c ?? [])
    return coberturas.length ? coberturas.reduce((mayor, c) => (ORDEN_COBERTURA.indexOf(c) > ORDEN_COBERTURA.indexOf(mayor) ? c : mayor)) : undefined
  })
  const [uno, otro] = porLosLados
  if (!uno || !otro) return
  return ORDEN_COBERTURA.indexOf(uno) < ORDEN_COBERTURA.indexOf(otro) ? uno : otro
}

/** Lo que cruza la línea del ataque del atacante al objetivo (ver `Trayectoria`); nada si alguno no está colocado */
export function trayectoria(m: Mapa, atacante: Personaje, objetivo: Personaje, entre = masCercanas(m, atacante, objetivo)): Trayectoria | undefined {
  if (!entre) return
  const linea = lineaDeCasillas(...entre)
  // sin las casillas del atacante ni del objetivo, aunque ocupen varias
  const suyas = [...huellaEnElMapa(m, atacante), ...huellaEnElMapa(m, objetivo)]
  const casillas = linea.slice(1, -1).filter((c) => !suyas.some((s) => misma(s, c)))
  const alianza = jugadorDe(m, atacante.id)?.alianza
  const en = (c: Casilla) => todosLosPersonajes(m).filter((p) => p.id !== atacante.id && p.id !== objetivo.id && huellaEnElMapa(m, p).some((s) => misma(s, c)))
  const personajes = casillas.flatMap(en)
  const coberturas: Trayectoria['coberturas'] = { ninguna: 0, ligera: 0, pesada: 0, bloqueante: 0 }
  let objetos = 0
  for (const c of casillas) {
    const suya = casillaDelMapa(m, c)
    if (!suya) continue
    coberturas[coberturaEn(suya.estancia, suya.casilla)]++
    if (suya.estancia.elementos.some((el) => el.posicion && cubre(el, suya.casilla))) objetos++
  }
  for (const c of linea.slice(1).flatMap((b, i) => coberturaDeMuro(m, linea[i], b) ?? [])) coberturas[c]++
  return {
    casillas,
    aliados: personajes.filter((p) => !esEnemigo(m, p.id, alianza)).length,
    enemigos: personajes.filter((p) => esEnemigo(m, p.id, alianza)).length,
    coberturas,
    objetos,
    muros: linea.slice(1).filter((c, i) => cruzaMuro(m, linea[i], c)).length,
  }
}

/** Casillas de `a` a `b` según la medición del movimiento, en línea recta y sin obstáculos (por Pitágoras, redondeando hacia arriba) */
export function distanciaSegun(medicion: Configuracion['medicionMovimiento'], a: Casilla, b: Casilla) {
  const [dx, dy] = [Math.abs(a.x - b.x), Math.abs(a.y - b.y)]
  if (medicion === 'ortogonal') return dx + dy
  if (medicion === 'diagonal') return Math.max(dx, dy)
  // sin arrastrar el error de coma flotante: 2 × √2 no llega a 3
  return Math.ceil(Math.max(dx, dy) - Math.min(dx, dy) + Math.min(dx, dy) * Math.SQRT2 - 1e-9)
}

/**
 * Cómo es el ataque: cuerpo a cuerpo si el objetivo está en contacto (pegado
 * en recto o, con `cuerpoACuerpo: 'diagonal'`, también en diagonal) y se
 * podría pasar de una casilla a la otra (sin muro ni esquina en medio); si
 * no, a distancia. Con la distancia según la medición del movimiento (en
 * contacto, 1), lo que costaría llegar moviéndose (como el atacante ve el
 * mapa, con el objetivo apartado) y la trayectoria. Nada si alguno no está
 * colocado
 */
export function medirAtaque(
  m: Mapa,
  { medicionMovimiento, terrenoPersonajes, cuerpoACuerpo }: Pick<Configuracion, 'medicionMovimiento' | 'terrenoPersonajes' | 'cuerpoACuerpo'>,
  atacante: Personaje,
  objetivo: Personaje,
): Omit<Ataque, 'atacante' | 'objetivo'> | undefined {
  const entre = masCercanas(m, atacante, objetivo, medicionMovimiento)
  const linea = entre && trayectoria(m, atacante, objetivo, entre)
  if (!entre || !linea) return
  const [desde, hasta] = entre
  // ocupando varias casillas, en contacto si alguna de las suyas lo está con alguna del objetivo
  const pegado = huellaEnElMapa(m, atacante).some((a) => huellaEnElMapa(m, objetivo).some((b) => enContacto(a, b, cuerpoACuerpo) && sePuedePasar(m, a, b, 'diagonal')))
  const vista = conPersonajes(sinPersonaje(m, objetivo.id), atacante.id, terrenoPersonajes)
  const camino = ruta(vista, desde, hasta, medicionMovimiento)
  return {
    tipo: pegado ? 'cuerpo-a-cuerpo' : 'distancia',
    distancia: pegado ? 1 : distanciaSegun(medicionMovimiento, desde, hasta),
    ...(camino && { recorrido: costeDe(vista, camino, medicionMovimiento) }),
    trayectoria: linea,
  }
}

/** Resta puntos de vida al personaje (de escuadra o no jugador), sin bajar de cero; sin cambios si no lleva la cuenta */
export function conVidaReducida(m: Mapa, id: string, puntos: number): Mapa {
  const herido = <P extends Personaje>(p: P): P => (p.vida === undefined ? p : { ...p, vida: Math.max(0, p.vida - puntos), vidaMax: p.vidaMax ?? p.vida })
  return conPersonajeNoJugador(conPersonaje(m, id, herido), id, herido)
}

/** El mapa sin ese personaje, esté en una escuadra o sea no jugador */
export const sinPersonaje = (m: Mapa, id: string): Mapa => ({
  ...m,
  ...(m.escuadras && { escuadras: m.escuadras.map((e) => ({ ...e, personajes: e.personajes.filter((p) => p.id !== id) })) }),
  ...(m.personajesNoJugadores && { personajesNoJugadores: m.personajesNoJugadores.filter((p) => p.id !== id) }),
})
