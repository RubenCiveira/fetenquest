# Capacidades del motor y cómo usarlo en otros juegos

Este documento reúne lo que ofrece `gamemap` y analiza cómo montar con él tres
juegos cuyas reglas están en `ref/`:

- **FetenQuest: Aventuras Infinitas (FAI)** en solitario
  (`ref/md/aventuras-infinitas.md`, sobre `ref/md/fetenquest-4-1.md`).
- **One Page Rules: Grimdark Future** (`ref/page-page-rule-grimdark.html`).
- **One Page Rules: Grimdark Future Firefight**
  (`ref/one-page-rule-firefight.html`).

Los dos de OPR se analizan en solitario y uno contra uno.

Para cada juego indica qué cubre ya el motor, qué tiene que poner el proyecto
(los proveedores y las clases) y qué falta. La última sección junta los huecos
y propone un orden para cubrirlos.

## 1. Lo que ofrece el motor

El motor es TypeScript puro y no sabe de ningún juego. Lleva el **mapa**
(estancias, casillas, puertas, muros, terreno, objetos, muebles, personajes),
los **turnos y activaciones** y las **reglas geométricas** (por dónde se mueve
cada uno, qué ve un ataque, quién está trabado). Las reglas de cada juego
(dados, estadísticas, daño, IA) son del proyecto, que las conecta a través de
cinco proveedores y dos tipos de clase (ver `PROVEEDORES.md`).

| Área | Capacidad | Dónde |
| --- | --- | --- |
| Mapa | Estancias de tipo `sala`, `pasillo` o `exterior`, de cualquier tamaño en casillas. Se generan al vuelo al abrir puertas, pegadas a la puerta, conectadas a una estancia explorada al otro lado, o aparte con `nuevaEstancia()` | `ProveedorEstancias.describirEstancia`, `abrirPuerta` |
| Mapa | Puertas de salida y puertas interiores (en muros dentro de la estancia), abiertas o cerradas. Se pueden añadir a estancias ya construidas | `Puerta`, `puertaEn`, `anadirPuerta` |
| Mapa | Muros interiores con tramos de muro, paso o puerta. Bloquean el movimiento, la zona de control y el cuerpo a cuerpo, y dan cobertura | `DescripcionMuro`, `muros.ts` |
| Mapa | Terreno `dificil` (×2), `muy-dificil` (×3) e `impasable`, con una `cobertura` (`ligera`, `pesada`, `bloqueante`) independiente del tipo y un `efecto` opcional con decoración | `Terreno`, `terrenos.ts` |
| Mapa | Objetos (se colocan solos, se pueden coger) y muebles fijos | `elementos.ts` |
| Estado | Flags en estancias, escuadras, personajes, objetos, muebles y puertas (`sin_trampas`, `aturdido`, `revisado`…), guardadas en el mapa | `tieneFlag`, `marcarFlag`, `quitarFlag` |
| Mapa | Zona de espera para lo que no cabe o aún no está en juego, con zonas de despliegue opcionales por alianza | `Personaje.casilla` ausente, `colocarPersonaje`, `Configuracion.despliegue` |
| Jugadores | Jugadores `humano` o `ia`, en alianzas con posturas dirigidas (`aliada`, `neutral`, `hostil`), que se pueden cambiar en mitad de la partida | `Configuracion.jugadores`, `cambiarJugadores` |
| Turnos | Turnos numerados con activaciones `alternas` o `personajes-primero`, y aviso al proyecto de a quién le toca y de cuándo acaba el turno | `ProveedorTurnos.turnoDe`, `finDeTurno`, `terminarTurno` |
| Turnos | Modos de activación agresivo y sigiloso por escuadra | `modosActivacion` |
| Unidades | Escuadras (una activación para todos sus personajes) y personajes no jugadores (cada uno con su activación) | `ClaseDeEscuadra`, `PersonajeNoJugador` |
| Unidades | Historial por turno de las acciones y movimientos de cada personaje. La escuadra decide cuándo ha completado su activación, y la activación termina sola cuando no quedan acciones | `turnos`, `activar(acciones)`, `ResultadoAccion` |
| Unidades | Vida opcional, reducir vida, eliminar personaje y añadir PNJ en cualquier momento | `reducirVida`, `eliminarPersonaje`, `anadirPersonajes` |
| Movimiento | Medición `ortogonal`, `diagonal` o `euclidea` (se puede usar como pulgadas) | `medicionMovimiento` |
| Movimiento | Varias formas de moverse por personaje: una base y variaciones, con tramos que consumen acciones extra (6 + 3 deslizando) y tipos `normal`, `carga`, `destrabarse` y `posicionarse` | `OpcionesMovimiento` |
| Movimiento | Coste de terreno propio de cada forma de moverse (volar ignora el terreno, cruzar lo impasable…) y cruzar muros interiores | `OpcionMovimiento.terreno`, `cruzaMuros` |
| Movimiento | Pasar por encima de personajes no enemigos como `normal`, `dificil`, `muy-dificil` o `impasable`. Los enemigos son siempre impasables | `terrenoPersonajes` |
| Movimiento | Rutas A* que rodean obstáculos y la zona de control, validación de recorridos y planificación de la mejor opción para un destino | `ruta`, `evaluarRecorrido`, `planearMovimiento` |
| Movimiento | Agrupar la escuadra junto a un personaje con el movimiento que le queda | `recorridoParaAgrupar` |
| Control | Zona de control de N casillas que no atraviesa muros. Calcula trabado, quién traba y apoyos | `distanciaControl`, `PersonajeEnJuego.estaTrabado()`, `trabadoPor()`, `conApoyos()` |
| Ataques | Tipo de ataque (cuerpo a cuerpo según `cuerpoACuerpo`, o a distancia), distancia, coste para llegar y trayectoria (aliados, enemigos, coberturas, objetos y muros que cruza) | `medirAtaque`, `trayectoria` |
| Ataques | La clase del atacante decide si puede atacar y resuelve el ataque como promesa. También para PNJ, pasando su clase | `motivoParaNoAtacar`, `atacar`, `atacarNoJugador` |
| Ataques | Ataque uno a uno o de escuadra contra escuadra (`modoAtaque`, ver 1.1) | `atacar(personaje, objetivo)`, `planearAtaqueDeEscuadra`, `ClaseDeEscuadra.atacarEscuadra` |
| Acciones | Acciones propias como comandos con acceso al mapa en juego (abrir puertas, coger, revisar, marcar flags…) | `Accion`, `Comando`, `MapaEnJuego` |
| Estado | Mapa inmutable y serializable a JSON. Un gestor creado con un mapa guardado continúa la partida | `Mapa`, `GestorMapa.suscribir` |

**Lo que el motor no hace, a propósito:** no tira dados (el gestor solo
recibe una función `azar` para colocar cosas), no conoce estadísticas, armas
ni daño, no decide por la IA y no pinta (la vista es de `map-debug-imp` o del
proyecto).

### 1.1 Cómo atacan las escuadras

Hay dos formas de que una escuadra ataque, según el juego:

- **Uno a uno:** cada personaje que aún tenga acciones elige su objetivo y
  ataca por su cuenta. El daño va solo a ese objetivo y la acción se apunta
  solo a ese atacante. Es lo que hace hoy el motor: al soltar un personaje
  sobre un enemigo, `atacar(personaje, objetivo)` llama a la clase del
  atacante. Lo usan los héroes y los monstruos de FAI.
- **Escuadra contra escuadra:** al atacar a un personaje enemigo, atacan
  juntos a su escuadra **todos los personajes de la escuadra atacante que aún
  tengan acciones disponibles** y puedan atacarla (alcance y línea de visión,
  según `motivoParaNoAtacar`). Los impactos se suman y **el daño se reparte
  entre los personajes de la escuadra objetivo**, en el orden que decida el
  defensor (o la IA). Todos los atacantes gastan su acción. Es como disparan
  y luchan las unidades de OPR.

Se elige con `modoAtaque` en la configuración. Con `escuadra`, el gestor
reúne a los atacantes (los que aún tienen acciones y cuya clase les deja
atacar al objetivo elegido; a qué miembro de la escuadra objetivo se apunta
lo elige el jugador),
ordena a los defensores de los más cercanos a los más lejanos, llama a
`ClaseDeEscuadra.atacarEscuadra`, que reparte el daño, y apunta la acción a
todos (ver `PROVEEDORES.md`).

## 2. FetenQuest: Aventuras Infinitas en solitario

FAI es un modo cooperativo y automático para 1 a 4 héroes. No hay un Malvado
Brujo (MB) humano: la mazmorra se genera con mazos (Mazmorra o Tipos de Sala,
Salas, Pasillos, Atrezo, Cofres, Salas Especiales, Trampas) y tablas de
encuentros, y los monstruos se mueven con un algoritmo. El modelo del motor
(estancias que aparecen al abrir puertas) nació para esto, así que es el
juego que mejor encaja.

### 2.1 Configuración

| Opción | Valor | Por qué |
| --- | --- | --- |
| `medicionMovimiento` | `ortogonal` | En FetenQuest no se mueve en diagonal |
| `cuerpoACuerpo` | `ortogonal` (o `diagonal` para armas con ataque diagonal, ver huecos) | Área de ataque normal: la casilla de delante |
| `terrenoPersonajes` | `normal` | Se pasa por encima de los aliados, pero no se termina en su casilla. El motor ya lo hace así |
| `distanciaControl` | `1` | Con las «Nuevas reglas de movimiento», salir de una casilla del área de influencia enemiga hace perder el resto del movimiento |
| `ordenActivaciones` | `personajes-primero` o `iniciativa` | Los héroes juegan primero y el MB, al final de la ronda; con las cartas de iniciativa, en el orden que salga |
| `modosActivacion` | `normal` | |
| `coherencia` | `ninguna` | Cada héroe es su propia escuadra |
| `modoAtaque` | `uno-a-uno` | Cada héroe y cada monstruo ataca a su objetivo |
| `jugadores` | Alianza `heroes` (un jugador humano con todos los héroes, o uno por héroe) y alianza `mazmorra` (jugador `malvado-brujo` de tipo `ia`), hostiles entre sí | |

### 2.2 Héroes

- Cada héroe es una **escuadra de un solo personaje**, para que se activen por
  separado en el orden de la ronda. Su `ClaseDePersonaje` lleva Ataque,
  Defensa, Puntos de Cuerpo (`vida`), Puntos de Mente y equipo. El motor solo
  necesita la `vida`; lo demás es del proyecto.
- **Turno del héroe:** un movimiento, una acción y las acciones gratuitas que
  quiera, con la acción antes o después del movimiento pero no en medio.
  - `opcionesMovimiento(personaje, gastado)` devuelve el movimiento solo si
    aún no se ha movido. Si ya hizo la acción, devuelve lo que le quede.
  - `acciones()` ofrece la acción normal solo si no la ha hecho: atacar,
    hechizo, buscar tesoros, buscar trampas, buscar puertas secretas,
    desactivar trampa, usar pergamino, cambiar equipo, recoger héroe.
  - Las acciones gratuitas (revisar mueble, abrir cofre, beber poción) se
    ofrecen siempre.
  - `ClaseDeEscuadra.activar` responde `completo` cuando el héroe ha hecho su
    movimiento y su acción.
- **Movimiento:**
  - Clásico: 2D6. El proyecto tira al empezar el turno y guarda el resultado
    hasta que termine, porque `opcionesMovimiento` se llama en cada arrastre.
  - Nuevas reglas: puntos fijos según el tipo (4 a 10), en la `distancia` del
    tramo base.
  - **Correr:** una variación con un segundo tramo de 1D6 que consume la
    acción. Con un 1, la acción termina sin moverse.
  - **Obstaculizado:** un movimiento `destrabarse` de 1 casilla.
  - Volador o sin penalización por terreno: `terreno` en la opción.
- **Atacar:** uno a uno (1.1), cada héroe a su objetivo.
  `motivoParaNoAtacar` pide arma a distancia y que no haya
  enemigos adyacentes para disparar. Comprueba la línea de visión con
  `ataque.trayectoria`: un muro o una puerta cerrada la cortan, igual que los
  personajes no más pequeños que el atacante (el proyecto mira los de
  `trayectoria.casillas`). `atacar` tira los dados de combate (calaveras
  contra escudos), aplica la ventaja y llama a `reducirVida` o
  `eliminarPersonaje`.
  - **Ventajas:** la cobertura sale de `coberturaEn` y de la trayectoria. El
    terreno difícil del defensor sale de `terrenoEn`. Atacar por la espalda
    sale del encaramiento del atacante y del defensor (`orientacion`).

### 2.3 Exploración con `describirEstancia`

Cada vez que se abre una puerta, el proveedor de estancias hace la secuencia
de exploración de FAI y la devuelve como `DescripcionEstancia`:

1. **Roba la carta** del mazo (Mazmorra con losetas, Tipos de Sala y Pasillo
   con tablero):
   - una sala da `tipo: 'sala'`, `tamano` y `salidas` o `salidasPorMuro`;
   - un pasillo da `tipo: 'pasillo'` con su largo, bifurcaciones (más
     salidas) o callejón sin salida (`salidas: 0`).
2. **Atrezo:** las cartas de Atrezo son `muebles` con un id estable. Los muebles
   de pared y los cofres lejos del héroe van en `muebles` y el proyecto
   recuerda qué carta es cada uno para resolver «Revisar mueble» (1D6 sobre la
   carta) con `marcarFlag('elemento', id, 'revisado')`.
3. **Encuentros:**
   - En una sala, 1D20 + Nivel de Peligro en la tabla de la misión, en la
     columna del número de héroes. Los monstruos van en
     `personajesNoJugadores` del jugador `malvado-brujo`.
   - Para el **damero** desde la casilla inicial de despliegue (la de delante
     del héroe que entra), el proyecto calcula las casillas relativas a la
     entrada (`entrada` dice por qué muro se entra) y da a cada monstruo su
     `casilla`: los débiles delante, luego los fuertes, los de distancia y
     por último los de magia.
   - Con 1-10 no aparece nadie y el Peligro sube 1.
   - En un pasillo, la tabla de monstruos errantes (1D6) los pone a 1D6
     casillas del héroe, con una `zona` de esa franja.
4. **Sala especial:** se coloca su contenido desde la carta y el Peligro sube 1.
5. `estanciaCreada` asocia a la estancia su carta y sus reglas, y a cada
   puerta su objeto.
6. **Iniciativa:** si aparecieron monstruos, el turno sigue según el orden de
   juego (ver 2.5).

El héroe que abre la puerta entra y ocupa la primera casilla: es la acción de
la `Puerta` del proyecto (como hace `PuertaDePrueba`), que abre con
`mapa.abrirPuerta` y coloca al héroe.

**Puertas secretas:** el resultado (1D6 por pared libre, un 6 la encuentra) es
del proyecto. La puerta se coloca con `anadirPuerta`; al abrirla, si al otro
lado ya hay una estancia explorada, se conecta con ella.

### 2.4 Trampas y búsquedas

- **Buscar trampas:** ya existe (`BUSCAR_TRAMPAS`) y marca la estancia con
  `sin_trampas`. Con FAI, la acción tira el Dado de Trampa de la misión (D4 a
  D12). Con 1-2 encuentra una trampa y pone su marcador (un objeto o terreno
  de la estancia). Las escuadras de monstruos y mercenarios no buscan
  trampas (`buscaTrampas: false`).
- **Dado de Trampa al moverse:** el héroe que entra en una casilla de una
  sección sin `sin_trampas` tira una vez por turno. Con un 1 se detiene allí,
  roba carta de trampa y termina su turno. Es `ClaseDePersonaje.alEntrar`
  respondiendo `terminar-turno`. El banco de pruebas lo simplifica: un 30%
  de pisar una trampa en cada casilla, que solo detiene el movimiento.

### 2.5 El Malvado Brujo automático

El jugador `malvado-brujo` es `tipo: 'ia'`. Cuando le toca, `turnoDe` lo
recibe y el proyecto juega por él con estas piezas:

- **Con monstruos en juego:** activa cada PNJ con el «Algoritmo de
  comportamiento de monstruos» de FetenQuest:
  - **Objetivo en rango:** para cada héroe, `medirAtaque` da distancia, tipo y
    `recorrido` (lo que cuesta llegar), y `planearMovimiento` comprueba si
    llega a una casilla en contacto.
  - **Cuerpo a cuerpo:** atacar al objetivo en rango con menos Defensa (y si
    empatan, con menos PC). Se mueve con `moverPersonajeNoJugador` y ataca con
    `atacarNoJugador`, pasando la clase del monstruo.
  - **A distancia:** apartarse lo justo y disparar al de menos Defensa en línea
    de visión (`trayectoria` sin bloqueantes).
  - **Al terminar:** `terminarActivacionJugador`.
- **Sin monstruos:**
  - **Tirada de Peligro** (1D6): calavera (1-3) obliga a una Tirada de Evento
    (1D10 ≤ Peligro); escudo negro (6) sube el Peligro 1.
  - **Eventos:** con `anadirPersonajes`, `cambiarJugadores` o lo que pida la
    tabla. Una **emboscada** busca una casilla sin línea de visión de ningún
    héroe (`trayectoria` desde cada uno) cerca del más vulnerable.
- **Nivel de Peligro (0-10)** y mazos: son estado del proyecto. En 5 y 9 se
  añade un cofre al mazo de Atrezo. Se guarda aparte del `Mapa`, con la
  partida del proyecto.
- **Orden de juego:** el clásico (héroes y luego MB) es `personajes-primero`.
  - Las **cartas de iniciativa** son `ordenActivaciones: 'iniciativa'`: al
    empezar cada turno, `ProveedorTurnos.ordenDelTurno` reparte las cartas
    y devuelve los huecos en orden, con un jugador por héroe.
  - Que el MB active «héroes − 1» monstruos en su hueco y el resto al final
    («turno escoba») son dos huecos suyos: `{ jugador: 'mb', activaciones:
    héroes − 1 }` y, al final, `{ jugador: 'mb' }`. El banco de pruebas ya
    lo hace así.

### 2.6 Exteriores

- Los tableros grandes son estancias `exterior` con terreno (agua, vegetación
  densa y telas de araña son difíciles; precipicios, impasables) y muros
  interiores para edificios.
- Los **elementos escenográficos con interior jugable** son salas con puerta.
- Los elementos **sin interior** tienen un **Área de Influencia** (3 a 6
  casillas) que, al pisarla, se resuelve como abrir una puerta. Se hace con
  `alEntrar`, como el Dado de Trampa, respondiendo `detenerse`.
- La **Tirada de Sigilo** (al mover o actuar fuera de esas áreas) y los
  **monstruos errantes** en cada turno del MB (1-2 en 1D6) son del proyecto.
  Los errantes aparecen donde ningún héroe los ve (`trayectoria`) con
  `anadirPersonajes`.
- Lava, abismos y suelos ardientes salen como **terreno con efecto**: la clase
  los recibe en `alEntrar` y decide si daña, detiene o termina el turno.

### 2.7 Resumen FAI

| Regla | Cobertura |
| --- | --- |
| Generación de la mazmorra al abrir puertas | ✅ `describirEstancia` y `abrirPuerta` |
| Mazos, tablas, Nivel de Peligro | 🟡 Proyecto, guardados aparte del `Mapa` |
| Damero de monstruos | 🟡 Proyecto, con `casilla` relativa a la entrada |
| Movimiento fijo o 2D6, correr, obstaculizado | ✅ Opciones de movimiento, tramos y `destrabarse` |
| Ataques, línea de visión y cobertura | ✅ `medirAtaque`, `trayectoria` y el encaramiento (`orientacion`) para que la clase decida el campo de visión |
| Buscar trampas y revisar muebles | ✅ |
| Dado de Trampa al entrar en una sección | ✅ `alEntrar` (en el banco de pruebas) |
| Puertas secretas | ✅ `anadirPuerta` y conexión con estancias exploradas |
| IA del MB | 🟡 Proyecto, con todas las consultas que necesita |
| Cartas de iniciativa y «turno escoba» | ✅ `iniciativa` y `ordenDelTurno` |
| Áreas de influencia de elementos escenográficos | 🟡 Proyecto, con `alEntrar` |

## 3. One Page Rules: Grimdark Future y Firefight

Los dos comparten el núcleo:

- **Activaciones:** alternas, una unidad cada vez y una acción por unidad.
  Las acciones son Mantener posición, Avanzar 6″ y disparar, Correr 12″ o
  Cargar 12″.
- **Combate:** tests de Calidad para impactar y de Defensa para bloquear.
- **Terreno:** cobertura (+1 a Defensa contra disparos), difícil (máximo 6″),
  peligroso, bloqueador e infranqueable.

Se juegan en mesa libre, en pulgadas. Con el motor, **1 casilla = 1″** y
medición `euclidea`: la mesa es una única estancia `exterior` de 48×48 o
72×48 casillas (Firefight en mesa pequeña, 24×24 o 36×36) sin puertas, con
`terrenos` y `muros` para ruinas y edificios.

| | Grimdark Future | Firefight |
| --- | --- | --- |
| Unidades | De 1 a 20 modelos | Pocos modelos, escaramuza |
| Coherencia | A 1″ de uno y a 9″ de todos | A 1″ de uno y a 6″ de todos |
| Heridas | Cada herida quita un modelo. Resistente(X) acumula | Cada herida quita un modelo hasta el último, que tira efectos de herida: Aturdido o Noqueado |
| Moral | Al acabar una activación con la mitad o menos: test de Calidad. Si falla, Aturdida (Shaken). En cuerpo a cuerpo, solo testea la que pierde | Al final de la ronda, si el ejército está a la mitad o menos: test para cada unidad. Si falla, Huye y se retira |
| Rondas | 4 | 4 |

### 3.1 Configuración

| Opción | Valor | Por qué |
| --- | --- | --- |
| `medicionMovimiento` | `euclidea` | Medición libre en pulgadas |
| `cuerpoACuerpo` | `diagonal` | El contacto es en cualquier dirección |
| `distanciaControl` | `1` | Nadie se mueve a menos de 1″ de un enemigo salvo cargando, que es justo lo que hacen las zonas de control con `normal` y `carga` |
| `terrenoPersonajes` | `impasable` | Los modelos no atraviesan otros modelos, ni propios |
| `ordenActivaciones` | `alternas` | Un jugador y otro, una unidad cada vez |
| `modosActivacion` | `normal` | |
| `coherencia` y `distanciaCoherencia` | `alguno` y `1` | La cadena de 1″ entre los modelos de cada unidad |
| `modoAtaque` | `escuadra` | La unidad dispara y lucha junta y reparte las heridas |
| `ajusteDelDefensor`, `consolidacionTrasCombate` y `retrocesoTrasCombate` | `3`, `3` y `1` | Los movimientos tras la carga y tras el combate |

### 3.2 Unidades

- Cada **unidad** es una **escuadra** y cada modelo, un personaje con su
  `ClaseDePersonaje` (Calidad, Defensa, armas y reglas especiales). La
  `vida` es Resistente(X) o 1.
- **La acción es de la unidad**, pero el motor mueve y ataca personaje a
  personaje. La clase de escuadra ofrece primero un comando para **declarar la
  acción** (Mantener, Avanzar, Correr, Cargar), la recuerda y, según ella:
  - `opcionesMovimiento` da a cada modelo un tramo base de 0, 6 o 12, o una
    opción `carga` de 12 con `terminarJuntoAEnemigo`;
  - `motivoParaNoAtacar` prohíbe disparar tras Correr;
  - `activar` responde `completo` cuando todos los modelos han movido y la
    unidad ha disparado o golpeado.
  - La acción declarada se guarda como flag de la escuadra
    (`marcarFlag('escuadra', id, 'avanzar')`), así que sobrevive a recargar
    la partida, y se quita al terminar la activación.
- **Terreno difícil:** en OPR no multiplica el coste, sino que limita todo el
  movimiento a 6″. Se aproxima con dos variaciones:
  - «Correr» de 12 con `terreno: { dificil: Infinity }` (no lo pisa);
  - «Correr por terreno difícil» de 6 con `terreno: { dificil: 1 }`.
- **Zancada** y **Volador:** `terreno` en la opción (difícil como abierto).
  Volador además cruza lo impasable y los muros (`cruzaMuros`). Volar por
  encima de otras unidades no se puede, porque `terreno` no cambia lo que pone
  el gestor.
- **Emboscada:** el modelo empieza sin `casilla`, en la zona de espera, y
  entra al inicio de una ronda posterior con `colocarPersonaje`, a más de 9″
  de enemigos (lo valida el proyecto).
- **Coherencia de unidad:** `coherencia: 'alguno'` y `distanciaCoherencia: 1`
  en la configuración (la cadena de 1″). La de 6″ o 9″ con todos sería otra
  regla: solo cabe una. Al terminar la activación, el proveedor recibe los que
  quedan fuera.

### 3.3 Disparo

OPR dispara **con toda la unidad**: es el ataque de escuadra contra escuadra
(1.1), con `modoAtaque: 'escuadra'`:

1. Al soltar un modelo sobre un enemigo, el gestor reúne a los de su unidad
   que pueden dispararle: los que aún tienen acciones y cuya clase les deja
   (`motivoParaNoAtacar`: alcance con `ataque.distancia`, línea de visión
   con la `trayectoria` sin cobertura bloqueante ni muros). Mientras se
   arrastra, la vista dibuja una línea de disparo hacia él desde cada uno.
   A qué modelo de la unidad enemiga se apunta (el más cercano, el más fácil
   de impactar…) lo elige el jugador: es una simplificación de OPR, que mide
   cada tirador hasta el modelo más cercano de la unidad.
2. `ClaseDeEscuadra.atacarEscuadra` suma los Ataques de sus armas y tira
   Calidad para impactar.
3. El defensor tira Defensa con +1 si la mayoría de su unidad está en
   cobertura o tras ella (`coberturaEn` y `trayectoria(...).coberturas`). PA(X)
   resta.
4. Retira bajas con `eliminarPersonaje` en el orden que elija el defensor
   (el gestor da los `objetivos` de los más cercanos a los más lejanos), o
   con `reducirVida` si es Resistente.
5. Resuelve `{ quedanAcciones: false }`: el gestor apunta el disparo a todos
   los que han disparado.

**Explosión(X)**, **Indirecto** y **Bloqueo** se calculan con las mismas
consultas: `personajesEn`, las distancias de `medirAtaque` y `trayectoria`.

### 3.4 Cuerpo a cuerpo

- **Carga:** cada modelo se mueve con su opción `carga`. Para contar como
  carga, al menos uno tiene que llegar a contacto.
- **Respuesta del defensor:** los modelos del defensor que no estén en
  contacto avanzan 3″ hacia los que cargan: `ajusteDelDefensor: 3` en la
  configuración. Para que no haya que cargar modelo a modelo, `apoyoALaCarga`
  (que no está en OPR) acerca a los demás de la unidad que carga cuando uno
  contacta.
- **Quién ataca:** los modelos a 2″ o menos del objetivo, todos juntos y
  repartiendo las heridas entre la unidad enemiga, como en el disparo (1.1). Es
  `medirAtaque` con `distancia ≤ 2`, porque `cuerpoACuerpo` solo da contacto.
- **Devolver el golpe:** lo resuelve el mismo `atacar`, preguntando al
  defensor (o decidiendo por la IA).
- **Fatiga:** solo impactan los 6 después del primer combate de la ronda. Es
  un flag `fatigada` de la escuadra, que el proyecto quita en `finDeTurno`.
- **Grimdark:** la unidad que causa menos heridas testea moral.
- **Consolidación:** moverse 3″ si el rival desaparece
  (`consolidacionTrasCombate: 3`, hacia el enemigo más cercano) o retroceder
  1″ el atacante (`retrocesoTrasCombate: 1`).

### 3.5 Moral, aturdidos y rondas

- **Aturdido:** un flag `aturdida` de la escuadra. La unidad está inactiva
  en su siguiente activación, tras la que se quita el flag. La clase
  de escuadra no ofrece movimiento ni acciones y el jugador (o la IA) termina
  la activación con «Terminar turno». En Firefight, aturdido y cargado o
  disparado pasa a **Noqueado**: `eliminarPersonaje`.
- **Moral de Grimdark:** se tira en `activar` (fin de la activación) con el
  tamaño inicial que guarda el proyecto.
- **Moral de Firefight:** se tira en `finDeTurno`. Las unidades que huyen se
  retiran con `eliminarPersonaje` de cada modelo.
- **Rondas:** `finDeTurno` cuenta `mapa.turno` y, tras la cuarta, comprueba los
  objetivos.
  - **Quién empieza:** con `alternas`, el motor continúa la rotación de un
    turno al siguiente. Para la regla de OPR (empieza quien terminó primero
    la ronda anterior), `ordenActivaciones: 'iniciativa'` con un
    `ordenDelTurno` que ponga primero a ese jugador; el resto va como
    `alternas`. Quién terminó primero lo apunta el proyecto (por ejemplo,
    con un flag al terminar la última activación de cada jugador).
- **Objetivos:** marcadores como objetos fijos (o muebles). Un objetivo está
  controlado si hay unidades sin aturdir a 3″ o menos y ninguna enemiga. Lo
  calcula el proyecto en `finDeTurno`.

### 3.6 Uno contra uno

- Dos jugadores `humano` en alianzas hostiles. Con `alternas`, el motor ya
  solo deja mover las miniaturas de quien tiene el turno
  (`gestor.jugadorEnTurno`).
- **En el mismo dispositivo** funciona tal cual: `turnoDe` muestra «Le toca a
  …».
- **En dos dispositivos**, el `Mapa` es JSON y el gestor avisa de cada cambio
  (`suscribir`). Sincronizarlo (Appwrite, websockets) y decidir quién tiene la
  autoridad es del proyecto.
- **Despliegue alterno en zonas:** los modelos pueden empezar en la zona de
  espera y cada jugador los coloca con `colocarPersonaje` dentro de su zona de
  `Configuracion.despliegue`.
- **Partidas por equipos y todos contra todos:** salen de las alianzas y las
  posturas.

### 3.7 En solitario contra la IA

OPR tiene reglas oficiales de solitario y cooperativo. El ejército de la IA son
**escuadras de un jugador `tipo: 'ia'`**, no PNJ, porque cada unidad tiene
varios modelos y una sola activación. Cuando `turnoDe` recibe a la IA, el
proyecto:

1. **Elige la unidad:** tira por la sección de la mesa (1-3 o 4-6) y por una
   unidad al azar de esa sección. Las aturdidas van al final.
2. **Aplica su árbol de decisión.** Las unidades son híbridas, de disparo o de
   cuerpo a cuerpo, y se preguntan:
   - **¿Hay objetivos sin controlar?** Lo calcula el proyecto.
   - **¿Hay enemigos en el camino?** Se traza `ruta` hasta el objetivo y se
     buscan enemigos a 6″ o menos de alguna de sus casillas.
   - **¿Llega con Correr pero no con Avanzar?** Con `planearMovimiento` con
     cada opción.
   - **Si avanza, ¿tendrá un enemigo a tiro?** Con `medirAtaque` desde las
     casillas candidatas.
   - **¿Puede cargar?** Con `planearMovimiento` con la opción `carga` hacia
     una casilla en contacto.
3. **Prefiere casillas con cobertura** (`coberturaEn`), mantiene la distancia
   al avanzar y rodea el terreno difícil y peligroso salvo que el objetivo
   esté dentro.
4. **Ejecuta** con `activarEscuadra`, `moverPersonaje` para cada modelo y
   `atacar`, como haría la interfaz. Siempre dispara al enemigo válido más
   cercano y carga contra el más cercano.
5. **Bonificación de dificultad:** +1 a impactar o a Defensa según los
   objetivos. Es del proyecto.

Las reglas especiales de la IA (PA contra la mejor Defensa, Mortal contra
Resistentes, Indirecto e Implacable mantienen posición) son criterios para
elegir objetivo y acción con las mismas consultas.

### 3.8 Resumen OPR

| Regla | Cobertura |
| --- | --- |
| Mesa en pulgadas, terreno, ruinas y edificios | ✅ Estancia `exterior`, `euclidea`, terreno y muros |
| Activación alterna de unidades | ✅ `alternas`, escuadras y `activar` |
| Acción única para toda la unidad | 🟡 Clase de escuadra, con la acción declarada como flag |
| Mantener, Avanzar, Correr y Cargar | ✅ Opciones de movimiento, `carga` y distancia de control 1 |
| Terreno difícil (máximo 6″) | 🟡 Dos variaciones de movimiento |
| Terreno peligroso | ✅ `Terreno.efecto` y `alEntrar` |
| Elevación, saltos y caídas | ❌ El mapa es plano |
| Peanas grandes (vehículos, monstruos) | ✅ `largo` × `ancho` en la clase o la descripción del personaje |
| Disparo de unidad, cobertura y PA | ✅ `modoAtaque: 'escuadra'` y `atacarEscuadra`; dados, cobertura y PA, del proyecto |
| Cuerpo a cuerpo a 2″, devolver golpe y fatiga | 🟡 Proyecto |
| Respuesta del defensor, consolidación y empujar | ✅ `ajusteDelDefensor`, `consolidacionTrasCombate` y `retrocesoTrasCombate` en la configuración; empujar, con `desplazar` |
| Coherencia de unidad | 🟡 `coherencia`: la cadena de 1″ o la distancia con todos, una de las dos |
| Aturdido y moral | 🟡 Proyecto, con aturdido y fatiga como flags |
| Quién empieza la ronda | 🟡 `iniciativa` y `ordenDelTurno`; quién terminó primero lo apunta el proyecto |
| Despliegue alterno en zonas y emboscada | ✅ Zona de espera, `Configuracion.despliegue`, validación en `colocarPersonaje` y veto opcional del proveedor |
| 1 contra 1 en el mismo dispositivo y equipos | ✅ |
| IA de solitario | 🟡 Proyecto, con las consultas del motor |

## 4. Huecos y propuesta

Los huecos ordenados por cuánto desbloquean. Ninguno obliga a meter reglas de
un juego en el motor: son puntos de extensión.

| # | Hueco | Juegos | Propuesta |
| --- | --- | --- | --- |
| 1 | ✅ **Marcas de estado en todo lo vivo:** acción declarada, aturdido, fatiga, trampa encontrada… | Todos | Hecho: `flags` en estancias, escuadras, personajes, objetos, muebles y puertas, con `tieneFlag`, `marcarFlag` y `quitarFlag`. El estado ajeno al mapa (Nivel de Peligro, mazos, tamaño inicial de las unidades) no se integra: lo guarda el proyecto aparte |
| 2 | ✅ **Aviso por casilla durante el movimiento y cortar el recorrido** | FAI (Dado de Trampa, áreas de influencia), OPR (terreno peligroso) | Hecho: `ClaseDePersonaje.alEntrar(personaje, donde, mapa)`, por cada casilla en que entra, responde `seguir`, `detenerse` o `terminar-turno`. También puede aplicarse al mover personajes no jugadores si se pasa su clase. Falta al agrupar |
| 3 | ✅ **Movimientos forzados** fuera de la activación y de las opciones de la clase | OPR (respuesta a la carga, consolidar, retroceder, empujar aturdidos), FetenQuest (empujar) | Hecho: `MapaEnJuego.desplazar` y `desplazarEscuadra`, hacia o lejos de una referencia (`casillas` que puede recorrer, `hasta` dónde) o por un recorrido, con las reglas del mapa y sin gastar movimiento; `planearDesplazamiento` para previsualizar |
| 4 | ✅ **Coherencia de escuadra** | OPR | Hecho: `coherencia` y `distanciaCoherencia` en la configuración (en cadena, con todos o desde el centro), comprobada al terminar la activación (`escuadraSinCoherencia`) y con guía para dibujarla. Falta combinar dos reglas (1″ en cadena y 6″ o 9″ con todos) |
| 5 | ✅ **Orden de activación del proyecto** | FAI (iniciativa, turno escoba), OPR (quién empieza la ronda, IA por secciones) | Hecho: `ordenActivaciones: 'iniciativa'` en la configuración y `ProveedorTurnos.ordenDelTurno(mapa)`, que al empezar cada turno da los huecos (jugador y cuántas activaciones seguidas; sin cupo, todas); lo que queda después va como `alternas` |
| 6 | ✅ **Ataque de escuadra contra escuadra** (1.1) | OPR (disparo y cuerpo a cuerpo de unidad) | Hecho: `modoAtaque` (`uno-a-uno` o `escuadra`) en la configuración y `ClaseDeEscuadra.atacarEscuadra(ataque, mapa)`: el gestor reúne a los de la escuadra con acciones a los que su clase deja atacar al objetivo elegido, ordena a los defensores (los más cercanos primero) y apunta la acción a todos; `planearAtaqueDeEscuadra` para dibujar las líneas de disparo. Falta mezclar los dos modos por escuadra |
| 7 | ✅ **Terreno con efecto** | FAI (lava, suelos ardientes), OPR (peligroso, bosques que no se ven a través) | Hecho: `efecto?: string` y `decoracion?: { imagen?, fondo? }` en `Terreno`; el gestor pasa el terreno en `alEntrar` y `MapaEnJuego.terrenoEn` deja consultarlo. Si no hay decoración, la vista usa un patrón de aviso |
| 8 | ✅ **Añadir puertas a estancias ya construidas** y saber si al otro lado hay algo explorado | FAI (puertas secretas, salas que conectan con zonas exploradas) | Hecho: `MapaEnJuego.anadirPuerta(estancia, casilla, lado)` crea puertas cerradas en muros exteriores, `abrirPuerta` conecta con una estancia explorada al otro lado y `describirEstancia` recibe el contexto de la puerta cuando genera una nueva |
| 9 | ✅ **Puertas en varios muros** | FAI (como mucho una puerta por pared, centrada) | Hecho: `DescripcionEstancia.salidasPorMuro` acepta salidas concretas por muro además de `orientacion` + `salidas` |
| 10 | ✅ **Despliegue** | OPR, y FAI con el damero | Hecho: `Configuracion.despliegue` define zonas por alianza, se usan en la estancia inicial y se validan en `colocarPersonaje`; el proveedor puede vetar colocaciones con `motivoParaNoColocar` |
| 11 | ✅ **Encaramiento** | FetenQuest (área de ataque, espalda, campo de visión) | Hecho: `Personaje.orientacion`, girar al moverse (`costeGiro` por cada 90° y `costeGiroDiagonal` al empezar a ir en diagonal, que solo se puede hacia las diagonales de delante) y girar sin moverse (`gestor.girar`). El área de ataque y el campo de visión los decide la clase con `ataque.atacante.orientacion` |
| 12 | ✅ **Personajes de varias casillas** | OPR (vehículos, monstruos), FetenQuest (miniaturas grandes) | Hecho: `largo` × `ancho` (hacia donde mira y de lado) en la clase o la descripción; la huella gira con el encaramiento y cuenta para colocar, moverse, ocupar, trabar, atacar (entre las casillas más cercanas) y la coherencia |
| 13 | **Elevación** | OPR (colinas, tejados, saltar, caer), FetenQuest (mesas, escaleras) | Fuera de alcance por ahora. Se aproxima con terreno y reglas de la clase |

Con 1 a 6 (hechos) se puede jugar FAI completo en solitario y OPR fiel a sus
reglas. Del 7 al 13 son mejoras de fidelidad.

**Orden recomendado:**

1. Un **prototipo de FAI** sobre `map-debug-imp`, que ya tiene puertas,
   trampas, muebles y monstruos de prueba, y que sería el primer juego real
   del motor.
