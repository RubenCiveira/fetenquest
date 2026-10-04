import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { sitiosDeBotones } from './corona'
import {
  alcance,
  analizarRecorrido,
  activacionDeNoJugador,
  casillasDeEnemigos,
  conPersonajes,
  costeDe,
  dimensionesDe,
  esGrande,
  costesDe,
  enElMapa,
  encaramientoDe,
  enemigoEn,
  esEnemigo,
  escuadrasDe,
  estanciaEn,
  estanciasDe,
  evaluarRecorrido,
  medirAtaque,
  planearMovimiento,
  ruta,
  type Accion,
  type Direccion,
  type Encaramiento,
  type AtaqueDeEscuadra,
  type Activacion,
  type Casilla,
  type Configuracion,
  type Estancia,
  type Escuadra,
  type GuiaDeCoherencia,
  type Jugador,
  type Personaje,
  type Mapa,
  tramosDe,
  type MedicionMovimiento,
  type ReglasDeMovimiento,
  type ModoActivacion,
  type OpcionesMovimiento,
  type Puerta,
  type RecorridoEvaluado,
  type TipoAtaque,
  type Terreno,
  type TipoTerreno,
  numeroDeTurno,
  ORIENTACION_INICIAL,
  personajesNoJugadoresDe,
  turnoDeEscuadra,
  turnoDePersonaje,
  type PersonajeNoJugador,
} from '../gamemap'

/** Lado de una casilla en unidades del SVG */
const LADO = 32

/** Grosor de una puerta y margen para que las del muro exterior no se corten */
const GROSOR = 8

/** Largo de una puerta respecto al lado de la casilla */
const LARGO = 0.7

/** Puerta sobre la línea del muro, centrada en la arista de su casilla (`origen`: esquina de su estancia) */
function PuertaEnMuro({ puerta: { casilla, lado, tipo, id, abierta, destino }, origen }: { puerta: Puerta; origen: Casilla }) {
  const x = (origen.x + casilla.x) * LADO
  const y = (origen.y + casilla.y) * LADO
  const hueco = (LADO * (1 - LARGO)) / 2
  const horizontal = lado === 'arriba' || lado === 'abajo'
  const linea = { arriba: y, abajo: y + LADO, izquierda: x, derecha: x + LADO }[lado] - GROSOR / 2
  return (
    <rect
      className={`vista-puerta ${tipo}${abierta ? ' abierta' : ''}`}
      x={horizontal ? x + hueco : linea}
      y={horizontal ? linea : y + hueco}
      width={horizontal ? LADO * LARGO : GROSOR}
      height={horizontal ? GROSOR : LADO * LARGO}
    >
      <title>{abierta ? `${id}: abierta hacia ${destino}` : id}</title>
    </rect>
  )
}

const INICIAL_MODO = { normal: 'N', agresivo: 'A', sigiloso: 'S' }

type PropsFicha = { ficha: Personaje; x: number; y: number; activacion?: Activacion; ultimoModo?: ModoActivacion }

const PUNTOS_POR_FILA = 6
const RADIO_VIDA = 2.5
const PASO_VIDA = RADIO_VIDA * 1.8

/** Texto del badge al pasar el puntero */
function estadoBadge(activacion?: Activacion, ultimoModo?: ModoActivacion) {
  if (activacion) return `${activacion.modo}, ${activacion.terminada ? 'activación completa' : 'activándose'}`
  return `${ultimoModo} en el turno anterior, aún sin activar`
}

/**
 * Ficha redonda de un personaje en la casilla de esquina `x`, `y`: su imagen VTT
 * o, sin ella, sus iniciales. El badge lleva la inicial del modo: con borde
 * mientras se activa, relleno al terminar y, si aún no se ha activado este
 * turno, discontinuo con su último modo (`ultimoModo`). Si lleva la cuenta de
 * su vida, otro badge abajo con los puntos que le quedan
 */
/** Ángulo de la marca del encaramiento, en grados desde arriba en el sentido del reloj */
const ANGULO: Record<Direccion, number> = { arriba: 0, derecha: 90, abajo: 180, izquierda: 270 }

/** Ángulo del retrato según hacia dónde mira: el retrato, tal cual, mira hacia abajo */
const ANGULO_RETRATO: Record<Direccion, number> = { abajo: 0, izquierda: 90, arriba: 180, derecha: 270 }

/** Triángulo del encaramiento en el centro del borde hacia el que mira el rectángulo de `x`, `y` y ese ancho y alto */
function MarcaDeEncaramiento({ x, y, ancho, alto, hacia, className }: { x: number; y: number; ancho: number; alto: number; hacia: Direccion; className: string }) {
  const [cx, cy] = [x + ancho / 2, y + alto / 2]
  const [bx, by] = { arriba: [cx, y], abajo: [cx, y + alto], izquierda: [x, cy], derecha: [x + ancho, cy] }[hacia]
  return <path className={className} d={`M${bx} ${by} l5 6 h-10 z`} transform={`rotate(${ANGULO[hacia]} ${bx} ${by})`} />
}

/** Mientras se tira de una ficha hacia un borde sin salir de su casilla: dónde quedaría encarada hacia él (su huella girada, desde su esquina `desde`) */
function IndicadorDeGiro({ ficha, desde, hacia }: { ficha: Personaje; desde: Casilla; hacia: Direccion }) {
  const { columnas, filas } = dimensionesDe({ ...ficha, orientacion: hacia })
  const [x, y, ancho, alto] = [desde.x * LADO, desde.y * LADO, columnas * LADO, filas * LADO]
  return (
    <g className="vista-giro">
      <rect x={x + 1} y={y + 1} width={ancho - 2} height={alto - 2} rx={LADO / 3} />
      <MarcaDeEncaramiento x={x} y={y} ancho={ancho} alto={alto} hacia={hacia} className="vista-giro-marca" />
      <title>{`Encarar hacia ${hacia}`}</title>
    </g>
  )
}

function FichaEnMapa({ ficha, x, y, activacion, ultimoModo }: PropsFicha) {
  const { id, nombre, imagenVtt, vida, vidaMax = vida, orientacion = ORIENTACION_INICIAL } = ficha
  const modo = activacion?.modo ?? ultimoModo
  const estado = activacion ? (activacion.terminada ? ' terminada' : '') : ' anterior'
  // ocupando varias casillas, un rectángulo redondeado sobre todas las de su huella; si no, un círculo
  const { columnas, filas } = dimensionesDe(ficha)
  const [ancho, alto] = [columnas * LADO, filas * LADO]
  const [cx, cy] = [x + ancho / 2, y + alto / 2]
  const forma = esGrande(ficha) ? <rect x={x + 2} y={y + 2} width={ancho - 4} height={alto - 4} rx={LADO / 3} /> : <circle cx={cx} cy={cy} r={LADO / 2 - 2} />
  // el retrato mira hacia abajo: se dibuja con la huella mirando abajo y se gira hacia donde mira
  const deFrente = dimensionesDe({ ...ficha, orientacion: 'abajo' })
  const [anchoRetrato, altoRetrato] = [deFrente.columnas * LADO - 4, deFrente.filas * LADO - 4]
  return (
    <>
      <clipPath id={`ficha-${id}`}>{forma}</clipPath>
      {forma}
      {imagenVtt ? (
        <g clipPath={`url(#ficha-${id})`}>
          <image
            href={imagenVtt}
            x={cx - anchoRetrato / 2}
            y={cy - altoRetrato / 2}
            width={anchoRetrato}
            height={altoRetrato}
            preserveAspectRatio="xMidYMid slice"
            transform={`rotate(${ANGULO_RETRATO[orientacion]} ${cx} ${cy})`}
          />
        </g>
      ) : (
        <text x={cx} y={cy + 4}>
          {nombre.slice(0, 2)}
        </text>
      )}
      {modo && (
        <g className={`vista-badge ${modo}${estado}`}>
          <circle cx={x + ancho - 5} cy={y + 5} r={6} />
          <text x={x + ancho - 5} y={y + 8}>
            {INICIAL_MODO[modo]}
          </text>
        </g>
      )}
      {/* encaramiento: un triángulo en el borde hacia el que mira */}
      <MarcaDeEncaramiento x={x} y={y} ancho={ancho} alto={alto} hacia={orientacion} className="vista-encaramiento" />
      <title>
        {modo ? `${nombre}: ${estadoBadge(activacion, ultimoModo)}` : nombre}
        {vida !== undefined && ` (${vida} de ${vidaMax} de vida)`}
        {`, mira hacia ${orientacion}`}
      </title>
    </>
  )
}

function IndicadorVida({ ficha, x, y }: { ficha: Personaje; x: number; y: number }) {
  const { vida, vidaMax = vida } = ficha
  if (vida === undefined || vidaMax === undefined || vidaMax <= 0) return null

  const { columnas } = dimensionesDe(ficha)
  const cx = x + (columnas * LADO) / 2
  const columnasVida = vidaMax > PUNTOS_POR_FILA ? Math.ceil(Math.sqrt(vidaMax)) : vidaMax
  const filasVida = Math.ceil(vidaMax / columnasVida)
  const inicioVidaX = cx - ((columnasVida - 1) * PASO_VIDA) / 2
  const inicioVidaY = y - 5 - (filasVida - 1) * PASO_VIDA

  return (
    <g className="vista-vida">
      {Array.from({ length: vidaMax }, (_, i) => {
        const columna = i % columnasVida
        const fila = Math.floor(i / columnasVida)
        return <circle key={i} className={i < vida ? 'sana' : 'herida'} cx={inicioVidaX + columna * PASO_VIDA} cy={inicioVidaY + fila * PASO_VIDA} r={RADIO_VIDA} />
      })}
    </g>
  )
}

/** Cómo se lee cada modo de coherencia en la guía */
const MODO_COHERENCIA: Record<GuiaDeCoherencia['coherencia']['modo'], string> = { alguno: 'en cadena', todos: 'con todos', centro: 'del centro' }

/**
 * Guía de la coherencia de una escuadra (casillas del mapa): azules los
 * enlaces entre los que están a la distancia y rojos los que no; con el
 * centro, el círculo de la distancia; y un aro rojo en los que quedan fuera
 */
function GuiaCoherencia({ guia, mapa }: { guia: GuiaDeCoherencia; mapa: Mapa }) {
  const centro = (c: { x: number; y: number }) => ({ x: (c.x + 0.5) * LADO, y: (c.y + 0.5) * LADO })
  const fuera = escuadrasDe(mapa)
    .find((e) => e.id === guia.escuadra)
    ?.personajes.flatMap((p) => (guia.fuera.includes(p.id) ? (enElMapa(mapa, p) ?? []) : []))
  const { modo, distancia } = guia.coherencia
  const medio = guia.centro && centro(guia.centro)
  return (
    <g className="vista-coherencia">
      {medio && <circle className="vista-coherencia-area" cx={medio.x} cy={medio.y} r={distancia * LADO} />}
      {guia.enlaces.map(({ de, a, desde, hasta, enCoherencia }) => {
        const [i, f] = [centro(desde), centro(hasta)]
        return <line key={`${de}-${a}`} className={enCoherencia ? 'en-coherencia' : 'fuera'} x1={i.x} y1={i.y} x2={f.x} y2={f.y} />
      })}
      {fuera?.map((c) => <circle key={`${c.x},${c.y}`} className="vista-coherencia-fuera" cx={centro(c).x} cy={centro(c).y} r={LADO * 0.55} />)}
      <title>{`${guia.escuadra}: coherencia a ${distancia} ${MODO_COHERENCIA[modo]}${guia.fuera.length ? `; fuera: ${guia.fuera.join(', ')}` : ''}`}</title>
    </g>
  )
}

/** Icono de cada tipo de ataque */
const ICONO_ATAQUE: Record<TipoAtaque, string> = { 'cuerpo-a-cuerpo': '⚔️', distancia: '🏹' }

/**
 * Mientras se arrastra sobre un enemigo: una línea de la ficha a él y el icono
 * del tipo de ataque (casillas del mapa); si no puede atacarlo, apagado y con
 * el `motivo`
 */
function IconoAtaque({ desde, hasta, objetivo, tipo, motivo, lineas }: { desde: Casilla; hasta: Casilla; objetivo: Personaje; tipo: TipoAtaque; motivo?: string; lineas?: LineaDeDisparo[] }) {
  const centro = (c: Casilla) => ({ x: (c.x + 0.5) * LADO, y: (c.y + 0.5) * LADO })
  const [a, b] = [centro(desde), centro(hasta)]
  return (
    <g className={`vista-ataque ${tipo}${motivo ? ' invalido' : ''}`}>
      {lineas?.length ? (
        // ataque de escuadra: una línea por cada personaje de la escuadra que puede atacar al objetivo
        lineas.map((linea, i) => {
          const [de, hacia] = [centro(linea.desde), centro(linea.hasta)]
          return <line key={i} x1={de.x} y1={de.y} x2={hacia.x} y2={hacia.y} />
        })
      ) : (
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      )}
      <circle cx={b.x} cy={b.y} r={RADIO_ICONO} />
      <text x={b.x} y={b.y + 4}>
        {ICONO_ATAQUE[tipo]}
      </text>
      {motivo && (
        // en medio de la línea, donde hay más sitio a los dos lados para el texto
        <text className="vista-ataque-motivo" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8}>
          {motivo}
        </text>
      )}
      <title>{motivo ?? `Atacar a ${objetivo.nombre} ${tipo === 'cuerpo-a-cuerpo' ? 'cuerpo a cuerpo' : 'a distancia'}`}</title>
    </g>
  )
}

/** Largo aproximado de un carácter del texto de la corona, para medir su etiqueta */
const ANCHO_LETRA = 6.2

/** Radio del botón de cada acción de la corona */
const RADIO_ICONO = 12

/**
 * Menú en corona alrededor de la ficha centrada en `cx`, `cy`: un botón con
 * el icono de cada acción, en las direcciones que no tapan otras fichas
 * (`evitar`). Al pasar el ratón o enfocarlo se despliega su nombre; en
 * pantalla táctil, el primer toque lo despliega y el segundo ejecuta la acción
 */
function Corona({
  cx,
  cy,
  acciones,
  onAccion,
  evitar,
}: {
  cx: number
  cy: number
  acciones: Accion[]
  onAccion: (id: string) => void
  /** Casillas con otras fichas (en coordenadas de la estancia) que los botones no deben tapar */
  evitar: Casilla[]
}) {
  const radio = LADO * 1.3
  const [desplegada, setDesplegada] = useState<string>()
  const tactil = useRef(false)
  const sitios = sitiosDeBotones(cx, cy, acciones.length, evitar, LADO)
  const botones = acciones.map((accion, i) => ({ accion, ...sitios[i] }))
  const etiqueta = botones.find((b) => b.accion.id === desplegada)
  const plegar = (id: string) => setDesplegada((d) => (d === id ? undefined : d))

  return (
    <g className="vista-corona">
      <circle cx={cx} cy={cy} r={radio} />
      {botones.map(({ accion: { id, nombre, icono }, x, y }) => (
        <g
          key={id}
          className="vista-corona-accion"
          role="button"
          tabIndex={0}
          aria-label={nombre}
          onPointerDown={(ev) => (tactil.current = ev.pointerType !== 'mouse')}
          onPointerEnter={(ev) => ev.pointerType === 'mouse' && setDesplegada(id)}
          onPointerLeave={(ev) => ev.pointerType === 'mouse' && plegar(id)}
          onFocus={() => setDesplegada(id)}
          onBlur={() => plegar(id)}
          onClick={() => (tactil.current && desplegada !== id ? setDesplegada(id) : onAccion(id))}
          onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onAccion(id)}
        >
          <circle cx={x} cy={y} r={RADIO_ICONO} />
          <text x={x} y={y + 4}>
            {icono}
          </text>
        </g>
      ))}
      {etiqueta && (
        // encima de los demás botones y sin recibir el puntero: sigue siendo el botón el que se señala
        <g className="vista-corona-etiqueta">
          <rect
            x={etiqueta.x - RADIO_ICONO}
            y={etiqueta.y - RADIO_ICONO}
            width={2 * RADIO_ICONO + 8 + etiqueta.accion.nombre.length * ANCHO_LETRA}
            height={2 * RADIO_ICONO}
            rx={RADIO_ICONO}
          />
          <text className="icono" x={etiqueta.x} y={etiqueta.y + 4}>
            {etiqueta.accion.icono}
          </text>
          <text x={etiqueta.x + RADIO_ICONO + 4} y={etiqueta.y + 4}>
            {etiqueta.accion.nombre}
          </text>
        </g>
      )}
    </g>
  )
}

/** Cómo se pinta cada paso de la flecha: un color por tipo de movimiento y otro para los tramos que consumen otra acción */
const CLASES_FLECHA = ['normal', 'accion', 'carga', 'destrabarse', 'posicionarse', 'invalido'] as const

type ClaseFlecha = (typeof CLASES_FLECHA)[number]

function claseDelPaso(evaluado: RecorridoEvaluado | undefined, paso: number): ClaseFlecha {
  if (!evaluado || 'motivo' in evaluado) return 'invalido'
  if (evaluado.opcion.tipo !== 'normal') return evaluado.opcion.tipo
  return evaluado.opcion.tramos[evaluado.tramos[paso]]?.accion ? 'accion' : 'normal'
}

/**
 * Flecha del recorrido que se está arrastrando, por los centros de sus
 * casillas y en un tramo de color por cada parte del movimiento, con el nombre
 * de la opción que vale (o por qué no vale ninguna) junto al destino
 */
function Flecha({ recorrido, evaluado, marcador, coste }: { recorrido: Casilla[]; evaluado?: RecorridoEvaluado; marcador: string; coste: number }) {
  const centro = ({ x, y }: Casilla) => `${(x + 0.5) * LADO},${(y + 0.5) * LADO}`
  const tramos = recorrido.slice(1).reduce<{ clase: ClaseFlecha; casillas: Casilla[] }[]>((hechos, c, i) => {
    const clase = claseDelPaso(evaluado, i)
    const ultimo = hechos.at(-1)
    return ultimo?.clase === clase
      ? [...hechos.slice(0, -1), { clase, casillas: [...ultimo.casillas, c] }]
      : [...hechos, { clase, casillas: [recorrido[i], c] }]
  }, [])
  const destino = recorrido.at(-1)
  const pasos = recorrido.length - 1
  const etiqueta = !evaluado ? `${coste}…` : 'motivo' in evaluado ? evaluado.motivo : `${evaluado.opcion.nombre} · ${coste}`
  return (
    <g className="vista-recorrido">
      {tramos.map(({ clase, casillas }, i) => (
        <polyline
          key={i}
          className={clase}
          points={casillas.map(centro).join(' ')}
          markerEnd={i === tramos.length - 1 ? `url(#${marcador}-${clase})` : undefined}
        />
      ))}
      {destino && pasos > 0 && (
        <text x={(destino.x + 0.5) * LADO} y={destino.y * LADO - 4}>
          {etiqueta}
        </text>
      )}
    </g>
  )
}

type Arrastre = {
  ficha: Personaje
  /** Por qué casilla de su huella se agarró la ficha, respecto a su esquina: la de bajo el puntero es donde acabará esa casilla */
  agarre: Casilla
  /** Casilla del mapa bajo el puntero */
  puntero: Casilla
  /** Sin salir de la casilla agarrada, hacia qué borde se tira de ella: soltar ahí la encara hacia él */
  giro?: Direccion
  /** Casilla a la que va la ficha (su esquina; o la del enemigo, si lo ataca): la ruta va de la ficha hasta ella */
  objetivo: Casilla
  recorrido: Casilla[]
  /** Mientras llegan, sin definir; `null` si el personaje no puede moverse */
  opciones?: OpcionesMovimiento | null
  /** El puntero está en una casilla a la que no llega: soltar ahí no hace nada */
  fuera?: boolean
  /** El puntero está sobre un enemigo: soltar ahí lo ataca */
  ataque?: { objetivo: Personaje; tipo: TipoAtaque; motivo?: string; lineas?: LineaDeDisparo[] }
}

/** Línea de disparo de un ataque de escuadra (casillas del mapa): de cada atacante que puede atacar al objetivo */
type LineaDeDisparo = { desde: Casilla; hasta: Casilla }

const misma = (a?: Casilla, b?: Casilla) => !!a && !!b && a.x === b.x && a.y === b.y

/** Hacia qué borde de la casilla `c` está el punto `p` (en casillas con decimales), si se ha apartado lo bastante de su centro */
function giroHacia(p: { x: number; y: number }, c: Casilla): Direccion | undefined {
  const [dx, dy] = [p.x - (c.x + 0.5), p.y - (c.y + 0.5)]
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.2) return
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'derecha' : 'izquierda') : dy > 0 ? 'abajo' : 'arriba'
}

/** El recorrido recortado hasta donde llega el alcance, según la medición, el terreno y los giros del encaramiento */
function recortado(mapa: Mapa, recorrido: Casilla[], maximo: number, medicion: MedicionMovimiento, encaramiento: Encaramiento) {
  const pasa = costesDe(mapa, recorrido, medicion, { encaramiento }).findIndex((coste) => coste > maximo)
  return pasa < 0 ? recorrido : recorrido.slice(0, pasa + 1)
}

/**
 * La ruta de la ficha a la casilla `objetivo`, sea cual sea el camino que haya
 * hecho el puntero: la que decide el motor (`planearMovimiento`: cada forma
 * de moverse por su mejor camino, rodeando la zona de control si no es una
 * carga). Si ninguna llega, la más corta que ha intentado (o, mientras llegan
 * las opciones, la más corta): si pasa del alcance de sus opciones, se recorta
 * hasta donde llega y queda `fuera`; si no se puede llegar, la flecha se queda
 * como estaba y también queda `fuera`
 */
function trazar(mapa: Mapa, reglas: ReglasDeMovimiento, a: Arrastre, objetivo: Casilla): Arrastre {
  const plan = a.opciones ? planearMovimiento(mapa, reglas, a.ficha, objetivo, a.opciones) : undefined
  if (plan && 'opcion' in plan) return { ...a, objetivo, recorrido: plan.recorrido, fuera: false }
  const vista = conPersonajes(mapa, a.ficha.id, reglas.terrenoPersonajes)
  const encaramiento = encaramientoDe(a.ficha, reglas)
  const camino = plan?.recorrido ?? ruta(vista, a.recorrido[0], objetivo, reglas.medicionMovimiento, { encaramiento })
  if (!camino) return { ...a, objetivo, fuera: true }
  const recorrido = a.opciones ? recortado(vista, camino, alcance(a.opciones), reglas.medicionMovimiento, encaramiento) : camino
  return { ...a, objetivo, recorrido, fuera: recorrido.length < camino.length }
}

/** Lo que la vista deja hacer sobre las estancias; `onElegir` recibe la casilla en coordenadas de su estancia */
type Props = {
  onElegir?: (estancia: Estancia, c: Casilla) => void
  /** Id del elemento o personaje resaltado */
  elemento?: string
  onElegirElemento?: (id: string) => void
  /** Acciones que se dibujan en corona alrededor del elemento resaltado */
  corona?: { acciones: Accion[]; onAccion: (id: string) => void }
  /** Cómo puede moverse un personaje: se pregunta al empezar a arrastrar su ficha */
  opcionesMovimiento?: (personajeId: string) => Promise<OpcionesMovimiento | undefined>
  /** Al soltar una ficha arrastrada: sin esto, las fichas no se arrastran */
  onMover?: (personajeId: string, recorrido: Casilla[]) => void
  /** Al soltar una ficha tirando hacia un borde sin salir de la casilla agarrada: encararla hacia él. Sin esto, no se encara así */
  onGirar?: (personajeId: string, orientacion: Direccion) => void
  /** Al soltar una ficha arrastrada sobre la de un enemigo suyo: sin esto, no se ataca */
  onAtacar?: (personajeId: string, objetivoId: string) => void
  /** Al hacer doble click en una ficha de personaje de escuadra */
  onMostrarDetalle?: (personajeId: string) => void
  /** Por qué un personaje no puede atacar a ese enemigo (se pregunta al arrastrar su ficha por encima), o nada si puede */
  motivoParaNoAtacar?: (personajeId: string, objetivoId: string) => Promise<string | undefined>
  /** Con ataque de escuadra, quiénes de la escuadra del personaje atacarían al enemigo (se pregunta al arrastrar su ficha sobre él): una línea de disparo por cada uno que puede */
  planearAtaqueDeEscuadra?: (personajeId: string, objetivoId: string) => Promise<AtaqueDeEscuadra | string>
  /** Cómo se miden los movimientos al arrastrar (sin diagonales, si no se dice) */
  medicion?: MedicionMovimiento
  /** Cómo cuenta para moverse la casilla de otro personaje (se pasa por encima como si nada, si no se dice) */
  terrenoPersonajes?: Configuracion['terrenoPersonajes']
  /** Casillas alrededor de un personaje que controla: salvo cargando, no se entra en la de un enemigo (sin zona de control, si no se dice) */
  distanciaControl?: number
  /** Qué está en contacto para el cuerpo a cuerpo: en recto o también en diagonal (también, si no se dice) */
  cuerpoACuerpo?: Configuracion['cuerpoACuerpo']
  /** Lo que cuesta girar el encaramiento al moverse: cada giro de 90° y empezar a ir en diagonal (gratis, si no se dice) */
  costeGiro?: number
  costeGiroDiagonal?: number
  /** Por qué no puede actuar ahora un personaje de una escuadra: si lo hay, se ve apagado y no se arrastra (pulsarlo solo lo elige) */
  motivoParaNoActuar?: (personajeId: string) => string | undefined
  /** Jugador al que le toca: los personajes no jugadores enemigos suyos se marcan como tales */
  jugadorEnTurno?: Jugador
  /** Modo inicial o actual de un personaje no jugador */
  modoNoJugador?: (personajeId: string) => ModoActivacion | undefined
  /** Guías de coherencia de las escuadras: se dibuja sobre el mapa la de la escuadra del personaje elegido (`elemento`) */
  guiasDeCoherencia?: GuiaDeCoherencia[]
}

/** Personaje colocado en una estancia, con su escuadra */
type PersonajeColocado = { personaje: Personaje & { casilla: Casilla }; escuadra: Escuadra }

/** Personaje no jugador colocado en una estancia, y si es enemigo del jugador al que le toca */
type NoJugadorColocado = PersonajeNoJugador & { casilla: Casilla; enemigo: boolean }

/**
 * Una estancia del mapa en su sitio (`origen`, en casillas del mapa), con las
 * suyas dentro, sus puertas, sus objetos colocados y los personajes que están en
 * ella; las casillas se colorean por su tipo. Todo lo de dentro va en
 * coordenadas de la estancia
 */
function CapaEstancia({
  estancia,
  mapa,
  origen,
  personajes,
  noJugadores,
  patrones,
  fichas,
  numero,
  onElegir,
  elemento,
  onElegirElemento,
  onMostrarDetalle,
  corona,
  onArrastrar,
  arrastrando,
  motivoParaNoActuar,
  jugadorEnTurno,
  modoNoJugador,
}: Props & {
  estancia: Estancia
  mapa: Mapa
  origen: Casilla
  personajes: PersonajeColocado[]
  /** Personajes no jugadores que están en ella */
  noJugadores: NoJugadorColocado[]
  /** Prefijo de los ids de los rayados del terreno (`<prefijo>-dificil`…), definidos en el mapa */
  patrones: string
  /** Casillas de todas las fichas de personaje del mapa, en coordenadas de esta estancia */
  fichas: Casilla[]
  /** Número del turno en curso */
  numero: number
  /** Al pulsar una ficha de personaje que se puede arrastrar: el arrastre lo lleva el mapa */
  onArrastrar?: (ev: PointerEvent, personaje: Personaje) => void
  /** Mientras se arrastra una ficha no se muestra la corona */
  arrastrando: boolean
}) {
  const motivoBloqueo = (personaje: Personaje) => motivoParaNoActuar?.(personaje.id)
  const elegirBloqueado = (personaje: Personaje) => {
    const motivo = motivoBloqueo(personaje)
    if (motivo) console.warn(`[map-debug] ${personaje.nombre} (${personaje.id}) no puede moverse ahora: ${motivo}`)
    onElegirElemento?.(personaje.id)
  }
  const puedeMoverNoJugador = (personaje: NoJugadorColocado) => personaje.jugador === jugadorEnTurno?.id && jugadorEnTurno.tipo === 'ia'
  const elegido =
    personajes.find(({ personaje }) => personaje.id === elemento)?.personaje.casilla ??
    noJugadores.find((personaje) => personaje.id === elemento)?.casilla ??
    estancia.elementos.find((el) => el.id === elemento)?.posicion
  const medidaElegida = estancia.elementos.find((el) => el.id === elemento) ?? { columnas: 1, filas: 1 }

  return (
    <g transform={`translate(${origen.x * LADO} ${origen.y * LADO})`} aria-label={`Estancia ${estancia.id}`}>
      {Array.from({ length: estancia.columnas * estancia.filas }, (_, i) => {
        const c = { x: i % estancia.columnas, y: Math.floor(i / estancia.columnas) }
        return (
          <rect
            key={i}
            className={`vista-casilla ${estanciaEn(estancia, c)?.estancia.tipo}`}
            x={c.x * LADO}
            y={c.y * LADO}
            width={LADO}
            height={LADO}
            onClick={() => onElegir?.(estancia, c)}
          />
        )
      })}
      {estancia.terrenos?.map((t, i) => {
        const [x, y, width, height] = [t.posicion.x * LADO, t.posicion.y * LADO, t.columnas * LADO, t.filas * LADO]
        const tieneDecoracion = !!(t.decoracion?.imagen || t.decoracion?.fondo)
        const imagen = t.decoracion?.imagen ?? t.imagen
        const fill = t.decoracion?.fondo ?? `url(#${patrones}-${t.efecto ? 'efecto' : t.tipo})`
        const aviso = t.efecto && !tieneDecoracion
        return imagen ? (
          <image key={i} className="vista-terreno" href={imagen} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice">
            <title>{conCobertura(t)}</title>
          </image>
        ) : (
          <g key={i} className="vista-terreno">
            <rect className={t.efecto ? 'con-efecto' : t.tipo} x={x} y={y} width={width} height={height} fill={fill}>
              <title>{conCobertura(t)}</title>
            </rect>
            {aviso && (
              <text className="vista-terreno-aviso" x={x + width / 2} y={y + height / 2} dominantBaseline="central" textAnchor="middle">
                !
              </text>
            )}
          </g>
        )
      })}
      {estanciasDe(estancia).map(({ estancia: e, origen }) => (
        <g key={e.id} className="vista-muros">
          <rect x={origen.x * LADO} y={origen.y * LADO} width={e.columnas * LADO} height={e.filas * LADO} />
          {(e.muros ?? []).flatMap((muro) =>
            tramosDe(muro).map(({ casilla, lado }, i) => {
              // el borde derecho o de abajo de la casilla
              const [x, y] = [(origen.x + casilla.x + 1) * LADO, (origen.y + casilla.y + 1) * LADO]
              const [x1, y1] = lado === 'derecha' ? [x, y - LADO] : [x - LADO, y]
              return <line key={`${muro.id}-${i}`} className={muro.pasos?.includes(i) ? 'paso' : undefined} x1={x1} y1={y1} x2={x} y2={y} />
            }),
          )}
          <text x={origen.x * LADO + 4} y={origen.y * LADO + 12}>
            {e.id}
          </text>
        </g>
      ))}
      {estanciasDe(estancia).flatMap(({ estancia: e, origen }) =>
        e.elementos.flatMap((el) =>
          el.posicion
            ? [
                <g key={el.id} className={`vista-elemento ${el.tipo}${el.id === elemento ? ' activo' : ''}`} onClick={() => onElegirElemento?.(el.id)}>
                  <rect
                    x={(origen.x + el.posicion.x) * LADO + 3}
                    y={(origen.y + el.posicion.y) * LADO + 3}
                    width={el.columnas * LADO - 6}
                    height={el.filas * LADO - 6}
                  />
                  {el.tipo === 'mueble' && el.imagenVtt ? (
                    <image href={el.imagenVtt} x={(origen.x + el.posicion.x) * LADO + 3} y={(origen.y + el.posicion.y) * LADO + 3} width={el.columnas * LADO - 6} height={el.filas * LADO - 6} />
                  ) : (
                    <text x={(origen.x + el.posicion.x + el.columnas / 2) * LADO} y={(origen.y + el.posicion.y + el.filas / 2) * LADO + 4}>
                      {el.nombre}
                    </text>
                  )}
                  <title>{el.flags?.length ? `${el.nombre}: ${el.flags.join(', ')}` : el.nombre}</title>
                </g>,
              ]
            : [],
        ),
      )}
      {personajes.map(({ personaje, escuadra }) => {
        const activacion = turnoDeEscuadra(escuadra, numero).activacion
        const esperando = !!motivoBloqueo(personaje)
        return (
          <g
            key={personaje.id}
            className={`vista-elemento personaje${personaje.id === elemento ? ' activo' : ''}${esperando ? ' esperando' : ''}`}
            onDoubleClick={() => onMostrarDetalle?.(personaje.id)}
            {...(onArrastrar && !esperando
              ? { onPointerDown: (ev: PointerEvent) => onArrastrar(ev, personaje) }
              : { onClick: () => elegirBloqueado(personaje) })}
          >
            <FichaEnMapa
              ficha={personaje}
              x={personaje.casilla.x * LADO}
              y={personaje.casilla.y * LADO}
              activacion={activacion}
              ultimoModo={escuadra.modo === 'normal' ? undefined : escuadra.modo}
            />
          </g>
        )
      })}
      {noJugadores.map((p) => {
        const esperando = !!motivoBloqueo(p)
        return (
          <g
            key={p.id}
            className={`vista-elemento personaje no-jugador${p.enemigo ? ' enemigo' : ''}${esperando ? ' esperando' : ''}`}
            {...(onArrastrar && puedeMoverNoJugador(p) && !esperando ? { onPointerDown: (ev: PointerEvent) => onArrastrar(ev, p) } : { onClick: () => elegirBloqueado(p) })}
          >
            <FichaEnMapa
              ficha={p}
              x={p.casilla.x * LADO}
              y={p.casilla.y * LADO}
              activacion={activacionDeNoJugador(mapa, p.id)?.activacion}
              ultimoModo={modoNoJugador?.(p.id) === 'normal' ? undefined : modoNoJugador?.(p.id)}
            />
          </g>
        )
      })}
      <g className="vista-vidas">
        {personajes.map(({ personaje }) => (
          <IndicadorVida key={personaje.id} ficha={personaje} x={personaje.casilla.x * LADO} y={personaje.casilla.y * LADO} />
        ))}
        {noJugadores.map((p) => (
          <IndicadorVida key={p.id} ficha={p} x={p.casilla.x * LADO} y={p.casilla.y * LADO} />
        ))}
      </g>
      {estanciasDe(estancia).flatMap(({ estancia: e, origen }) =>
        e.puertas.map((p) => <PuertaEnMuro key={`${e.id}-${p.id}`} puerta={p} origen={origen} />),
      )}
      {!arrastrando && corona && corona.acciones.length > 0 && elegido && (
        <Corona
          cx={(elegido.x + medidaElegida.columnas / 2) * LADO}
          cy={(elegido.y + medidaElegida.filas / 2) * LADO}
          evitar={fichas.filter((c) => c.x !== elegido.x || c.y !== elegido.y)}
          {...corona}
        />
      )}
    </g>
  )
}

const NOMBRE_TERRENO: Record<TipoTerreno, string> = { dificil: 'Terreno difícil', 'muy-dificil': 'Terreno muy difícil', impasable: 'Terreno impasable' }

/** Nombre del terreno y, si los da, su efecto y su cobertura contra los disparos */
const conCobertura = ({ tipo, cobertura = 'ninguna', efecto }: Terreno) => `${NOMBRE_TERRENO[tipo]}${efecto ? `, efecto ${efecto}` : ''}${cobertura === 'ninguna' ? '' : `, cobertura ${cobertura}`}`

/**
 * Rayados con que se marca el terreno sin imagen: rayas sueltas el difícil,
 * trama cruzada el muy difícil y rayas densas sobre fondo oscuro el impasable
 */
function RayadosDeTerreno({ prefijo }: { prefijo: string }) {
  return (
    <>
      <pattern id={`${prefijo}-dificil`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line className="vista-rayado dificil" x1="0" y1="0" x2="0" y2="8" />
      </pattern>
      <pattern id={`${prefijo}-muy-dificil`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line className="vista-rayado muy-dificil" x1="0" y1="0" x2="0" y2="7" />
        <line className="vista-rayado muy-dificil" x1="0" y1="0" x2="7" y2="0" />
      </pattern>
      <pattern id={`${prefijo}-impasable`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect className="vista-rayado-fondo" width="5" height="5" />
        <line className="vista-rayado impasable" x1="0" y1="0" x2="0" y2="5" />
      </pattern>
      <pattern id={`${prefijo}-efecto`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect className="vista-rayado-fondo efecto" width="6" height="6" />
        <line className="vista-rayado efecto" x1="0" y1="0" x2="0" y2="6" />
      </pattern>
    </>
  )
}

/** Esquina de una estancia en las casillas del mapa */
const origenDe = (e: Estancia): Casilla => e.posicion ?? { x: 0, y: 0 }

/**
 * El mapa: cada estancia en su sitio, en un solo dibujo que las abarca a
 * todas. La estancia de la ficha elegida se pinta la última, para que su
 * corona quede por encima de las demás. Las fichas de personaje se arrastran
 * casilla a casilla por todo el mapa (cruzando puertas abiertas), con la
 * flecha del recorrido; pulsarlas sin arrastrar las elige
 */
export function VistaMapa({ mapa, ...props }: Props & { mapa: Mapa }) {
  const { opcionesMovimiento, onMover, onAtacar, onGirar, motivoParaNoAtacar, onElegirElemento, medicion = 'ortogonal', terrenoPersonajes = 'normal', distanciaControl = 0, cuerpoACuerpo = 'diagonal', costeGiro = 0, costeGiroDiagonal = 0 } = props
  /** El mapa como lo ve la ficha que se arrastra: los demás personajes, con su terreno */
  const vistoPor = (ficha: Personaje) => conPersonajes(mapa, ficha.id, terrenoPersonajes)
  const reglas: ReglasDeMovimiento = { medicionMovimiento: medicion, terrenoPersonajes, distanciaControl, cuerpoACuerpo, costeGiro, costeGiroDiagonal }
  const { estancias } = mapa
  const svg = useRef<SVGSVGElement>(null)
  // ids de las puntas de flecha, únicos aunque haya varios mapas en la página
  const marcador = `flecha${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [arrastre, setArrastre] = useState<Arrastre>()
  const ultimoClick = useRef<{ personaje: string; tiempo: number } | undefined>(undefined)

  /** Punto del mapa bajo el puntero, en casillas con decimales */
  const puntoBajo = (ev: PointerEvent): { x: number; y: number } | undefined => {
    const matriz = svg.current?.getScreenCTM()
    if (!matriz) return
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(matriz.inverse())
    return { x: p.x / LADO, y: p.y / LADO }
  }

  /** Casilla del mapa bajo el puntero */
  const casillaBajo = (ev: PointerEvent): Casilla | undefined => {
    const p = puntoBajo(ev)
    return p && { x: Math.floor(p.x), y: Math.floor(p.y) }
  }

  function empezar(ev: PointerEvent, ficha: Personaje) {
    const desde = enElMapa(mapa, ficha)
    const puntero = casillaBajo(ev)
    if (!desde || !puntero) return
    svg.current?.setPointerCapture(ev.pointerId)
    setArrastre({ ficha, agarre: { x: puntero.x - desde.x, y: puntero.y - desde.y }, puntero, objetivo: desde, recorrido: [desde] })
    // al llegar las opciones, la ruta que ya se estuviera mostrando se recorta a su alcance
    opcionesMovimiento?.(ficha.id).then((opciones) =>
      setArrastre((a) => (a?.ficha.id === ficha.id ? trazar(mapa, reglas, { ...a, opciones: opciones ?? null }, a.objetivo) : a)),
    )
  }

  function arrastrar(ev: PointerEvent) {
    const [p, c] = [puntoBajo(ev), casillaBajo(ev)]
    if (!p || !c || !arrastre) return
    const { ficha, agarre } = arrastre
    const desde = arrastre.recorrido[0]
    // sin salir de la casilla agarrada, tirando hacia uno de sus bordes: encarar sin moverse
    if (misma(c, { x: desde.x + agarre.x, y: desde.y + agarre.y })) return setArrastre((a) => a && { ...a, puntero: c, objetivo: desde, recorrido: [desde], fuera: false, ataque: undefined, giro: giroHacia(p, c) })
    if (misma(arrastre.puntero, c)) return
    // sobre un enemigo, en vez de la flecha del recorrido, el icono de ataque
    const enemigo = onAtacar && enemigoEn(mapa, ficha.id, c)
    const medida = enemigo && medirAtaque(mapa, reglas, ficha, enemigo)
    // la esquina de la ficha va donde deja la casilla agarrada bajo el puntero
    if (!enemigo || !medida) return setArrastre((a) => a && { ...trazar(mapa, reglas, a, { x: c.x - agarre.x, y: c.y - agarre.y }), puntero: c, giro: undefined, ataque: undefined })
    setArrastre((a) => a && { ...a, puntero: c, giro: undefined, objetivo: c, ataque: { objetivo: enemigo, tipo: medida.tipo } })
    // si no puede atacarlo, el icono lo dice; la respuesta solo vale si el puntero sigue sobre ese enemigo
    motivoParaNoAtacar?.(ficha.id, enemigo.id).then((motivo) =>
      setArrastre((a) => (a?.ataque?.objetivo.id === enemigo.id ? { ...a, ataque: { ...a.ataque, ...(motivo && { motivo }) } } : a)),
    )
    props.planearAtaqueDeEscuadra?.(ficha.id, enemigo.id).then((plan) => {
      if (typeof plan === 'string') return
      const lineas = plan.ataques.flatMap(({ atacante, objetivo }) => {
        const [desde, hasta] = [enElMapa(mapa, atacante), enElMapa(mapa, objetivo)]
        return desde && hasta ? [{ desde, hasta }] : []
      })
      setArrastre((a) => (a?.ataque?.objetivo.id === enemigo.id ? { ...a, ataque: { ...a.ataque, lineas } } : a))
    })
  }

  function soltar() {
    if (!arrastre) return
    const { ficha, recorrido, fuera, ataque, giro } = arrastre
    setArrastre(undefined)
    if (ataque) return onAtacar?.(ficha.id, ataque.objetivo.id)
    if (giro && giro !== (ficha.orientacion ?? ORIENTACION_INICIAL)) return onGirar?.(ficha.id, giro)
    if (fuera) return
    if (recorrido.length > 1) onMover?.(ficha.id, recorrido)
    else {
      const ahora = Date.now()
      if (props.elemento === ficha.id && ultimoClick.current?.personaje === ficha.id && ahora - ultimoClick.current.tiempo < 400) {
        ultimoClick.current = undefined
        return props.onMostrarDetalle?.(ficha.id)
      }
      ultimoClick.current = { personaje: ficha.id, tiempo: ahora }
      onElegirElemento?.(ficha.id)
    }
  }

  const reglasDelRecorrido = (ficha: Personaje) => ({ medicion, enemigos: casillasDeEnemigos(mapa, ficha.id), distanciaControl, cuerpoACuerpo, costeGiro, costeGiroDiagonal })
  const evaluado: RecorridoEvaluado | undefined =
    arrastre?.opciones === null
      ? { motivo: `${arrastre.ficha.nombre} no puede moverse ahora` }
      : arrastre?.opciones && evaluarRecorrido(vistoPor(arrastre.ficha), arrastre.ficha, arrastre.recorrido, arrastre.opciones, reglasDelRecorrido(arrastre.ficha))
  // banco de pruebas: si el recorrido no vale, se ve en la consola por qué no vale cada forma de moverse (una vez por recorrido)
  const rechazado = arrastre?.opciones && arrastre.recorrido.length > 1 && evaluado && 'motivo' in evaluado ? `${arrastre.ficha.id}: ${arrastre.recorrido.map(({ x, y }) => `${x},${y}`).join(' ')}` : undefined
  useEffect(() => {
    if (!rechazado || !arrastre?.opciones || !evaluado || !('motivo' in evaluado)) return
    const analisis = analizarRecorrido(vistoPor(arrastre.ficha), arrastre.ficha, arrastre.recorrido, arrastre.opciones, reglasDelRecorrido(arrastre.ficha))
    if ('motivo' in analisis) return console.log(`[map-debug] recorrido rechazado (${rechazado}): ${evaluado.motivo}`)
    const { opciones, ...zona } = analisis
    // lo que ya ha movido en el turno decide qué formas de moverse le ofrece su clase (sin carga, si ya se movió)
    const movimientos = turnoDePersonaje(arrastre.ficha, numeroDeTurno(mapa)).movimientos
    console.log(`[map-debug] recorrido rechazado (${rechazado}): ${evaluado.motivo}`, zona, { yaMovido: movimientos })
    console.table(
      opciones.map(({ opcion, pasa, coste, alcance, tramos, segunZona, terminaJuntoSiLoPide }) => ({
        opcion: `${opcion.nombre} (${opcion.tipo})`,
        pasa,
        coste: coste ?? '—',
        alcance,
        llega: !!tramos,
        zonaDeControl: segunZona,
        terminaJunto: terminaJuntoSiLoPide,
      })),
    )
    // solo cuando cambia el recorrido rechazado (lo demás se lee de ese momento): con todas las dependencias, se pintaría en cada repintado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechazado])
  if (!estancias.length) return null
  const x0 = Math.min(...estancias.map((e) => origenDe(e).x))
  const y0 = Math.min(...estancias.map((e) => origenDe(e).y))
  const x1 = Math.max(...estancias.map((e) => origenDe(e).x + e.columnas))
  const y1 = Math.max(...estancias.map((e) => origenDe(e).y + e.filas))
  const colocados = escuadrasDe(mapa).flatMap((escuadra) =>
    escuadra.personajes.flatMap((personaje) => (personaje.casilla ? [{ personaje: { ...personaje, casilla: personaje.casilla }, escuadra }] : [])),
  )
  const noJugadores = personajesNoJugadoresDe(mapa).flatMap((p) => (p.casilla ? [{ ...p, casilla: p.casilla, enemigo: esEnemigo(mapa, p.id, props.jugadorEnTurno?.alianza) }] : []))
  const numero = numeroDeTurno(mapa)
  const conElegido = (e: Estancia) =>
    Number(
      colocados.some(({ personaje }) => personaje.id === props.elemento && personaje.estancia === e.id) ||
        estanciasDe(e).some(({ estancia }) => estancia.elementos.some((el) => el.id === props.elemento)),
    )
  return (
    <svg
      ref={svg}
      onPointerMove={arrastre ? arrastrar : undefined}
      onPointerUp={soltar}
      onPointerCancel={() => setArrastre(undefined)}
      className="vista-estancia"
      viewBox={`${x0 * LADO - GROSOR} ${y0 * LADO - GROSOR} ${(x1 - x0) * LADO + 2 * GROSOR} ${(y1 - y0) * LADO + 2 * GROSOR}`}
      role="img"
      aria-label="Mapa"
    >
      <defs>
        <RayadosDeTerreno prefijo={marcador} />
        {CLASES_FLECHA.map((clase) => (
          <marker key={clase} id={`${marcador}-${clase}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path className={`vista-recorrido-punta ${clase}`} d="M0 0L10 5L0 10z" />
          </marker>
        ))}
      </defs>
      {[...estancias]
        .sort((a, b) => conElegido(a) - conElegido(b))
        .map((e) => (
          <CapaEstancia
            key={e.id}
            estancia={e}
            mapa={mapa}
            origen={origenDe(e)}
            personajes={colocados.filter(({ personaje }) => personaje.estancia === e.id)}
            noJugadores={noJugadores.filter((p) => p.estancia === e.id)}
            patrones={marcador}
            fichas={[...colocados.map(({ personaje }) => personaje), ...noJugadores].flatMap((personaje) => {
              const c = enElMapa(mapa, personaje)
              return c ? [{ x: c.x - origenDe(e).x, y: c.y - origenDe(e).y }] : []
            })}
            numero={numero}
            onArrastrar={onMover ? empezar : undefined}
            arrastrando={!!arrastre}
            {...props}
          />
        ))}
      {props.guiasDeCoherencia
        ?.filter((guia) => colocados.some(({ personaje, escuadra }) => personaje.id === props.elemento && escuadra.id === guia.escuadra))
        .map((guia) => <GuiaCoherencia key={guia.escuadra} guia={guia} mapa={mapa} />)}
      {arrastre?.giro && <IndicadorDeGiro ficha={arrastre.ficha} desde={arrastre.recorrido[0]} hacia={arrastre.giro} />}
      {arrastre?.ataque && <IconoAtaque desde={arrastre.recorrido[0]} hasta={arrastre.objetivo} {...arrastre.ataque} />}
      {arrastre && !arrastre.ataque && (
        <Flecha
          recorrido={arrastre.recorrido}
          evaluado={arrastre.fuera ? { motivo: 'Fuera de alcance' } : evaluado}
          marcador={marcador}
          coste={costeDe(vistoPor(arrastre.ficha), arrastre.recorrido, medicion, { ...(evaluado && 'opcion' in evaluado ? evaluado.opcion : {}), encaramiento: encaramientoDe(arrastre.ficha, reglas) })}
        />
      )}
    </svg>
  )
}
