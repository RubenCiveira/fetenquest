# Pendientes

## Validar jugadores de personajes no jugadores

Los `personajesNoJugadores` se pueden crear con un `jugador` inexistente.
La estancia inicial valida el reparto antes de añadir los PNJ de
`descripcion.personajesNoJugadores`, y `anadirPersonajes` tampoco valida cada
descripción antes de cambiar el mapa.

Esto puede dejar PNJ huérfanos que nunca serán enemigos y bloquear después
`cambiarJugadores` por un estado inválido. Conviene validar el reparto después
de incorporar los PNJ, o validar cada descripción antes de cambiar el mapa.

## Colocar PNJ desde la zona de espera

Los PNJ que no encuentran casilla quedan en la zona de espera, pero el gestor y
el mock de debug no ofrecen una forma de colocarlos después.

`GestorMapa.colocarPersonaje` solo actualiza personajes de escuadras, y
`map-debug-imp/MapaPage.tsx` solo lista en espera objetos y personajes de
escuadra. Hay que permitir colocar `personajesNoJugadores` en espera o ajustar
el comportamiento/documentación para que no queden inaccesibles.

## Distancia de coherencia para escuadras.
En los datos de tipoDeEscuadra tendremos un flag para indicarle al gestor de juego si la escuadra debe mantener coherencia, cual es la distancia de coherencia, y cual es el modo de coherencia (con alguno, con el centro, o con todos).

Al terminar un turno, tenemos que verificar qeu todas las unidades de la escuadra están en coherencia, para ello en función de la regla del modo de coherencia tendremos que verificar que algun personaje está a distancia de coherencia. Que todos están a distancia de coherencia; o que desde el punto central de la escuadra todos estan en coherencia.

Si al final del turno hay personajes fuera de coherencia, se ejecutará un método de escuadra sin coherencia del proveedor (que en la implementación de test levantará un dialogo para avisar al jugador y eliminará a los personajes fuera de coherencia).
