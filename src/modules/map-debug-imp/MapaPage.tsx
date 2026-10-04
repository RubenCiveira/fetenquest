import { useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate, useParams } from 'react-router'
import { Icono } from '../../components/Icono'
import { PageHeader } from '../../components/PageHeader'
import {
  activacionDe,
  escuadrasDe,
  estanciaEn,
  GestorMapa,
  jugadoresDe,
  jugadorEnTurno,
  numeroDeTurno,
  personajesNoJugadoresDe,
  BUSCAR_TRAMPAS,
  type Accion,
  type Casilla,
  type Direccion,
  type Estancia,
  type Mapa,
} from '../gamemap'
import { FormularioConfiguracion } from './FormularioConfiguracion'
import { AvisoTrampas } from './AvisoTurno'
import { ETIQUETA_ORIENTACION, guardarMapa, obtenerMapa } from './mapas'
import { PanelJugadores } from './PanelJugadores'
import { esCancelacion, useProveedorDebug } from './useProveedorDebug'
import { VistaMapa } from './VistaMapa'
import { movimientoDePrueba } from './modelo/personaje'
import { tieneEnemigosActivosEnEstancia } from './trampas'
import { textoDeIniciativa } from './iniciativa'
import './mapDebug.css'

/** Un mapa de prueba: pulsa una casilla para ver de qué estancia es */
export function MapaPage() {
  const id = useParams().id ?? ''
  const guardado = obtenerMapa(id)
  if (!guardado) return <Navigate to="/map-debug" replace />
  return (
    <>
      <PageHeader title={id} backTo="/map-debug" />
      <Gestionado key={id} id={id} inicial={guardado.mapa} />
    </>
  )
}

type Seleccion = { estancia: string; elemento: string }

/**
 * El mapa en manos de su gestor, con su propio proveedor: cada cambio se
 * dibuja y se guarda. El gestor se crea una sola vez: `inicial` se relee en
 * cada render de la página (al abrir el diálogo, p. ej.) y otro gestor
 * perdería la estancia que se pide. Las estancias del mapa guardado se avisan
 * como creadas, para que el proveedor les asocie sus puertas de prueba (sin
 * atarlas a este gestor: StrictMode crea dos y React se queda con uno)
 */
function Gestionado({ id, inicial }: { id: string; inicial: Mapa }) {
  const { proveedor, claseDeNoJugador, dialogo, configuracion, cambiarConfiguracion } = useProveedorDebug(inicial)
  const [gestor] = useState(() => {
    const nuevo = new GestorMapa(proveedor, inicial)
    inicial.estancias.forEach((e) => proveedor.estanciaCreada(e, nuevo))
    return nuevo
  })
  const mapa = useSyncExternalStore(gestor.suscribir, () => gestor.mapa)
  const [seleccion, setSeleccion] = useState<Seleccion>()
  const [nota, setNota] = useState<string>()
  const [avisoTrampas, setAvisoTrampas] = useState<{ titulo: string; texto: string }>()

  useEffect(() => gestor.suscribir((m) => guardarMapa(id, m)), [gestor, id])

  // la miniatura elegida, si es un personaje, muestra en corona sus acciones
  const escuadraDelElegido = escuadrasDe(mapa).find((e) => e.personajes.some((h) => h.id === seleccion?.elemento))
  const personajeElegido = escuadraDelElegido?.personajes.find((h) => h.id === seleccion?.elemento)
  const noJugadorElegido = personajesNoJugadoresDe(mapa).find((h) => h.id === seleccion?.elemento)
  const escuadraElegida = escuadraDelElegido?.id
  // un personaje ya en el mapa no se coloca a mano: se arrastra
  const personajeEnMapa = !!personajeElegido?.casilla || !!noJugadorElegido?.casilla
  const actorElegido = escuadraElegida ?? noJugadorElegido?.id
  const [acciones, setAcciones] = useState<{ actor: string; mapa: Mapa; lista: Accion[] }>()

  useEffect(() => {
    if (!actorElegido) return
    let vigente = true
    const disponibles = escuadraElegida ? gestor.accionesDisponibles(escuadraElegida, seleccion?.elemento) : Promise.resolve(gestor.accionesDisponiblesNoJugador(actorElegido))
    disponibles.then((lista) => vigente && setAcciones({ actor: actorElegido, mapa, lista }))
    return () => {
      vigente = false
    }
  }, [gestor, escuadraElegida, actorElegido, seleccion?.elemento, mapa])

  // las de otra escuadra o de un mapa anterior ya no valen
  const accionesVigentes = acciones?.actor === actorElegido && acciones?.mapa === mapa ? acciones.lista : []

  /** Ejecuta la acción de la corona; si abre un diálogo (una puerta pide una estancia nueva) y se cancela, no pasa nada */
  async function accionar(accion: string) {
    if (!actorElegido) return
    if (accion === BUSCAR_TRAMPAS.id && seleccion?.elemento && tieneEnemigosActivosEnEstancia(mapa, seleccion.elemento)) {
      setAvisoTrampas({ titulo: 'No se pueden buscar trampas', texto: 'Con enemigos activos no se pueden buscar trampas.' })
      return
    }
    try {
      const motivo = escuadraElegida ? await gestor.ejecutarAccion(escuadraElegida, accion, seleccion?.elemento) : gestor.ejecutarAccionNoJugador(actorElegido, accion)
      setNota(motivo)
      if (accion === BUSCAR_TRAMPAS.id && !motivo) setAvisoTrampas({ titulo: 'Trampas buscadas', texto: 'Se han buscado trampas en esta estancia.' })
    } catch (error) {
      if (!esCancelacion(error)) throw error
    }
  }

  async function nuevaEstancia() {
    try {
      await gestor.nuevaEstancia()
    } catch (error) {
      if (!esCancelacion(error)) throw error
    }
  }

  /** Encarar sin moverse, tras confirmarlo: un gesto tan pequeño puede ser sin querer */
  async function girar(personaje: string, orientacion: Direccion) {
    const nombre = gestor.personaje(personaje)?.nombre ?? personaje
    if (!(await proveedor.confirmar(`¿Encarar a ${nombre} hacia ${orientacion}, sin moverse?`))) return
    setNota(
      esNoJugador(personaje)
        ? await gestor.girarNoJugador(personaje, orientacion, gestor.opcionesMovimientoNoJugador(personaje, (_personaje, gastado) => movimientoDePrueba(gastado)))
        : await gestor.girar(personaje, orientacion),
    )
  }

  async function moverPersonaje(personaje: string, recorrido: Casilla[]) {
    const noJugador = personajesNoJugadoresDe(mapa).find((p) => p.id === personaje)
    const motivo = esNoJugador(personaje)
      ? await gestor.moverPersonajeNoJugador(personaje, recorrido, gestor.opcionesMovimientoNoJugador(personaje, (_personaje, gastado) => movimientoDePrueba(gastado)), noJugador && claseDeNoJugador(noJugador))
      : await gestor.moverPersonaje(personaje, recorrido)
    if (motivo) console.warn(`[map-debug] ${personaje} no puede moverse ahora: ${motivo}`)
    setNota(motivo)
  }

  /**
   * El personaje ataca al enemigo sobre el que se soltó su ficha (un no
   * jugador, con su clase de prueba); si se cancela el diálogo de ataque, no
   * pasa nada
   */
  async function atacar(personaje: string, objetivo: string) {
    const noJugador = personajesNoJugadoresDe(mapa).find((p) => p.id === personaje)
    try {
      setNota(noJugador ? await gestor.atacarNoJugador(personaje, objetivo, claseDeNoJugador(noJugador)) : await gestor.atacar(personaje, objetivo))
    } catch (error) {
      if (!esCancelacion(error)) setNota(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Con un elemento elegido que se coloca a mano, la casilla es su sitio
   * nuevo; si no (o es un personaje ya en el mapa, que se arrastra), se informa de
   * qué estancia es
   */
  function elegirCasilla(e: Estancia, c: Casilla) {
    if (seleccion?.estancia !== e.id || personajeEnMapa) {
      const en = estanciaEn(e, c)
      setNota(en && `Casilla ${c.x},${c.y}: ${en.estancia.id} (${en.estancia.tipo}), casilla ${en.casilla.x},${en.casilla.y}. Ruta: ${en.ruta.map((r) => r.id).join(' › ')}.`)
      return
    }
    const elemento = e.elementos.find((el) => el.id === seleccion.elemento)
    setNota(personajeElegido ? gestor.colocarPersonaje(personajeElegido.id, c) : elemento?.tipo === 'mueble' ? `El mueble «${elemento.nombre}» no se puede mover` : gestor.colocarElemento(e.id, seleccion.elemento, c))
    setSeleccion(undefined)
  }

  const numero = numeroDeTurno(mapa)
  const iniciativa = textoDeIniciativa(mapa)
  const enTurno = jugadorEnTurno(mapa, configuracion)
  const nombreDeJugador = (jugador: string) => jugadoresDe(mapa).jugadores.find((j) => j.id === jugador)?.nombre ?? jugador
  const esNoJugador = (personaje: string) => personajesNoJugadoresDe(mapa).some((p) => p.id === personaje)
  const noJugadorEnTurno = personajesNoJugadoresDe(mapa).find((p) => p.jugador === enTurno?.id)
  const modoNoJugador = noJugadorEnTurno && configuracion.modosActivacion === 'agresivo-sigiloso' ? gestor.modoActivacionNoJugador(noJugadorEnTurno.id) : undefined

  function aEspera() {
    if (!seleccion) return
    setNota(gestor.colocarElemento(seleccion.estancia, seleccion.elemento))
    setSeleccion(undefined)
  }

  return (
    <section className="map-debug">
      <button type="button" className="button" onClick={nuevaEstancia}>
        <Icono nombre="mas" />
        Nueva estancia
      </button>
      <FormularioConfiguracion configuracion={configuracion} onCambiar={cambiarConfiguracion} />
      <PanelJugadores jugadores={jugadoresDe(mapa)} enTurno={enTurno} onCambiar={(jugadores) => setNota(gestor.cambiarJugadores(jugadores))} />
      <div className="map-debug-turno">
        <strong>Turno {numero}</strong>
        <span className="nota">{enTurno ? `Le toca a ${enTurno.nombre}${modoNoJugador ? ` en modo ${modoNoJugador}` : ''}.` : 'Nadie tiene nada que activar: termina el turno.'}</span>
        {iniciativa && <span className="nota">Iniciativa: {iniciativa}.</span>}
        <button type="button" className="button secondary" onClick={() => setNota(gestor.terminarTurno())}>
          Terminar turno
        </button>
        {enTurno?.tipo === 'ia' && (
          <button type="button" className="button secondary" onClick={() => setNota(gestor.terminarActivacionJugador(enTurno.id))}>
            Terminar activación de IA
          </button>
        )}
      </div>
      <ul className="map-debug-escuadras">
        {escuadrasDe(mapa).map(({ id: escuadra, nombre, jugador, modo, activo, personajes }) => {
          const activacion = activacionDe(mapa, escuadra)
          return (
            <li key={escuadra} className="map-debug-turno">
              <strong>{nombre}</strong>
              <span className="nota">de {nombreDeJugador(jugador)}.</span>
              {activacion && !activacion.terminada && (
                <span className="nota">
                  Activándose en modo {activacion.modo}
                  {activo && ` con ${personajes.find((h) => h.id === activo)?.nombre ?? activo}`}.
                </span>
              )}
              {activacion?.terminada && <span className="nota">Activación completa en modo {activacion.modo}.</span>}
              {!activacion && modo && <span className="nota">Último modo: {modo}.</span>}
            </li>
          )
        })}
      </ul>
      {nota && <p className="nota">{nota}</p>}

      <VistaMapa
        mapa={mapa}
        elemento={seleccion?.elemento}
        onElegir={elegirCasilla}
        onElegirElemento={(elemento) => {
          const personaje = escuadrasDe(mapa).flatMap((e) => e.personajes).find((h) => h.id === elemento)
          const noJugador = personajesNoJugadoresDe(mapa).find((h) => h.id === elemento)
          const estancia = personaje?.estancia ?? noJugador?.estancia ?? mapa.estancias.find((e) => e.elementos.some((el) => el.id === elemento))?.id
          if (estancia) setSeleccion({ estancia, elemento })
        }}
        corona={actorElegido ? { acciones: accionesVigentes, onAccion: accionar } : undefined}
        opcionesMovimiento={(personaje) => (esNoJugador(personaje) ? Promise.resolve(gestor.opcionesMovimientoNoJugador(personaje, (_personaje, gastado) => movimientoDePrueba(gastado))) : gestor.opcionesMovimiento(personaje))}
        onMover={moverPersonaje}
        onGirar={girar}
        onAtacar={atacar}
        onMostrarDetalle={(personaje) => void gestor.mostrarDetalle(personaje).then(setNota)}
        motivoParaNoAtacar={(personaje, objetivo) => {
          const noJugador = personajesNoJugadoresDe(mapa).find((p) => p.id === personaje)
          return gestor.motivoParaNoAtacar(personaje, objetivo, noJugador && claseDeNoJugador(noJugador))
        }}
        planearAtaqueDeEscuadra={configuracion.modoAtaque === 'escuadra' ? (personaje, objetivo) => gestor.planearAtaqueDeEscuadra(personaje, objetivo) : undefined}
        medicion={configuracion.medicionMovimiento}
        terrenoPersonajes={configuracion.terrenoPersonajes}
        distanciaControl={configuracion.distanciaControl}
        cuerpoACuerpo={configuracion.cuerpoACuerpo}
        costeGiro={configuracion.costeGiro}
        costeGiroDiagonal={configuracion.costeGiroDiagonal}
        motivoParaNoActuar={(personaje) => (esNoJugador(personaje) ? gestor.motivoParaNoActuarNoJugador(personaje) : gestor.motivoParaNoActuar(personaje))}
        modoNoJugador={(personaje) => gestor.modoActivacionNoJugador(personaje)}
        jugadorEnTurno={enTurno}
        guiasDeCoherencia={gestor.guiasDeCoherencia()}
      />

      {avisoTrampas && <AvisoTrampas {...avisoTrampas} onCerrar={() => setAvisoTrampas(undefined)} />}
      {mapa.estancias.map((e) => {
        const enEspera = [
          ...e.elementos.filter((el) => !el.posicion).map((el) => ({ id: el.id, texto: `${el.nombre} (${el.columnas} × ${el.filas})` })),
          ...escuadrasDe(mapa).flatMap((esc) => esc.personajes.filter((h) => h.estancia === e.id && !h.casilla).map((h) => ({ id: h.id, texto: h.nombre }))),
        ]
        const elegido = seleccion?.estancia === e.id ? seleccion.elemento : undefined
        return (
          <article key={e.id} className="map-debug-estancia">
            <h2>
              {e.id} · {e.tipo} {e.columnas} × {e.filas}
              {e.orientacion && ` · ${ETIQUETA_ORIENTACION[e.orientacion]}`}
            </h2>
            <div className="map-debug-espera">
              <span className="nota">Zona de espera:</span>
              {enEspera.length === 0 && <span className="nota">vacía</span>}
              {enEspera.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  className={`button secondary${el.id === elegido ? ' activo' : ''}`}
                  aria-pressed={el.id === elegido}
                  onClick={() => setSeleccion({ estancia: e.id, elemento: el.id })}
                >
                  {el.texto}
                </button>
              ))}
              {elegido && !personajeEnMapa && e.elementos.find((el) => el.id === elegido && el.tipo !== 'mueble')?.posicion && (
                <button type="button" className="button secondary" onClick={aEspera}>
                  Devolver a la zona de espera
                </button>
              )}
            </div>
            {elegido && !personajeEnMapa && <p className="nota">Pulsa la casilla donde quieres su esquina superior izquierda.</p>}
            {elegido && personajeElegido && gestor.motivoParaNoActuar(personajeElegido.id) && <p className="nota">{gestor.motivoParaNoActuar(personajeElegido.id)}</p>}
          </article>
        )
      })}
      {dialogo}
    </section>
  )
}
