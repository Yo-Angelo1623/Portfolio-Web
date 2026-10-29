# La piedra invisible

Prototipo inicial de FPS de supervivencia urbana no letal en primera persona.

## Estado actual

Versión actual: v1.1
Motor y tecnologías: Vite + Three.js + JavaScript
Estado de ejecución: comprobado localmente con `npm run dev` y `npm run build`
Fase actual: Fase 9. Movimiento dinámico, persecución con navegación y finales de partida

## Funcionalidades implementadas

- Barrio en primera persona con seis manzanas (dos columnas por tres filas), calles transversales y edificios distribuidos por la zona.
- Iluminación cálida de atardecer con entorno simplificado.
- Seis perros con modelos de silueta diferenciada: pastor alemán, terrier, mastín, labrador, husky y bulldog.
- Modelos orgánicos con proporciones, hocicos, orejas, patas y colas específicos por raza; animación sutil de patas y cola.
- Cámara y movimiento en primera persona con aceleración, desaceleración, balanceo al caminar y cambio de campo visual al correr.
- Barra de vida visible.
- Menú con iniciar, reanudar y alternar atardecer.
- Botón de reinicio que restablece la posición, salud y herramienta.
- Selección de herramientas con teclas 1 a 5 (también teclado numérico) y botones HUD; clic izquierdo para usarlas.
- Inventario limitado y lanzamiento con gravedad; los objetos chocan con perros, suelo y edificios.
- Colisiones del jugador y de los perros con edificios, perros y personaje, con daño gradual por contacto.
- Reacción visible de los perros ante proximidad, distracción y la amenaza simbólica de la piedra invisible.
- Estados de perro: tranquilo, alerta, persecución, ataque y agotamiento.
- Ruta de evacuación con tres marcadores secuenciales, distancia y estado del tramo activo.
- Daño por contacto ajustado a 6 puntos cada 1,4 segundos mientras persista el contacto.
- Ondas y partículas breves con color por herramienta; el daño recibido activa un destello periférico.
- Aviso textual temporal por cada impacto y barra de vida verde/ámbar/roja según el nivel; la vida anuncia su valor a tecnologías de asistencia.
- Ajustes de fluidez: límite de salto de simulación tras pausas, menor resolución máxima de renderizado y sombras dinámicas desactivadas en los componentes de los perros.
- Piedra invisible con usos ilimitados y enfriamiento entre pulsos.
- Botellas y ramas recogibles al acercarse; reaparecen al reiniciar.
- Bancos y árboles escalables con E; la resistencia se agota mientras se permanece arriba y se recupera en el suelo. La altura del jugador se compara con el alcance de cada perro para decidir si puede infligir daño.
- Ambientación urbana añadida: postes de luz, bolsas de basura y vehículos estacionados que también bloquean el paso.
- Los perros alternan entre calma, alerta, persecución, ataque y agotamiento; detectan al jugador por visión/distancia y el ruido de la carrera.
- Persecución con navegación por cuadrícula y colisiones con obstáculos; los perros rodean edificios y elementos urbanos en vez de avanzar a través de ellos.
- Las seis razas tienen velocidades de persecución distintas, modelos con patas articuladas y animación de zancada, rebote corporal y patas sincronizada con el desplazamiento.
- WASD y flechas sirven para caminar; Q aumenta la velocidad a costa de resistencia. La cámara acompaña el movimiento con balanceo y campo visual dinámico.
- Si un perro alcanza al jugador, cinco pulsaciones de Espacio en un segundo gastan resistencia del jugador y del perro para liberarse.
- El panel de forcejeo muestra el esfuerzo realizado y la resistencia restante del perro; cinco pulsaciones consecutivas en un segundo agotan su resistencia y liberan al jugador. Tras zafarse, hay dos segundos para tomar distancia.
- Completar la ruta activa la victoria; llegar a cero de vida activa la derrota y muestra opciones para reintentar o volver al menú.

## Controles

- `W`, `A`, `S`, `D`: movimiento.
- Flechas: movimiento alternativo.
- `Q`: correr más rápido y gastar resistencia.
- `E`: subir a un banco o árbol cercano; pulsar de nuevo para bajar. La resistencia se consume en altura.
- `Espacio`: pulsar 5 veces en 1 segundo para zafarse si un perro alcanza al jugador.
- Ratón: mirar alrededor.
- `1` a `5` o teclado numérico `1` a `5`: elegir herramienta.
- Clic izquierdo: usar la herramienta seleccionada.
- `Esc`: abrir el menú.
- Botones del HUD: cambiar herramienta, menú y reinicio.

## Ejecución

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev -- --host 0.0.0.0`.
4. Abre la URL mostrada por Vite, normalmente `http://localhost:5173/`.

## Verificación realizada

- `npm install` completado correctamente.
- `npm run build` completado correctamente para v1.1; Vite advierte que el bundle principal queda en 512,70 KB, sobre su umbral orientativo de 500 KB.
- El servidor local arrancó correctamente en `http://localhost:5173/`.
- En navegador: teclas numéricas actualizan herramienta y HUD; jugador expulsado de edificios; perros separados del jugador; impacto de rama consume inventario y afecta al perro.
- Progreso secuencial probado en los tres marcadores; el HUD confirma el tramo actual y la llegada.
- Contacto sostenido simulado durante 5,1 s: 4 pulsos de daño, de 6 puntos cada uno; el destello se activó.
- Cada pulso de daño ahora muestra "-6 vida"; la barra cambia a estado de advertencia por debajo del 50 % y crítico al 25 % o menos.
- Impacto de rama probado: proyectil retirado, reacción del perro y efecto visual con partículas creados; sin errores de navegador.
- Seis modelos y razas inicializados en la escena; el reinicio restaura cada perro a su propia posición inicial.
- La simulación limita los saltos por frame a 50 ms y se reducen cálculos de color por frame; validar FPS en equipos de distinta capacidad queda pendiente.
- Prueba en navegador: piedra seleccionada y usada dos veces sin bajar de infinito; se recogió una botella (inventario de x3 a x4); E subió al banco y bajó del refugio, con consumo de resistencia en altura.
- Prueba en navegador: cinco pulsaciones de Espacio liberaron al jugador, agotaron la resistencia del perro y ocultaron el panel de forcejeo. El daño periódico se mantuvo mientras duró el forcejeo.
- Prueba en navegador: caminar recorrió 2,52 m en 0,6 s; correr con Q recorrió 4,74 m en 0,6 s y redujo resistencia de 100 % a 86 %.
- Prueba de navegación: una ruta con visión bloqueada produjo 13 puntos transitables; en otra prueba el perro siguió persiguiendo alrededor de un árbol.
- Pruebas de finales: vida cero mostró derrota; el botón de reintento restauró vida/ruta. Completar el último marcador mostró victoria; menú y reintento funcionaron.
- Probar en navegador rutas de persecución alrededor de edificios para cada raza y medir FPS en equipos modestos.

## Tareas pendientes

- Probar las seis manzanas de extremo a extremo, validar que cada perro rodea edificios y medir FPS en equipos modestos.
- Confirmar equilibrio de persecuciones, consumo de resistencia y secuencia de escape para cada raza.
- Revisar en navegador las seis siluetas desde varios ángulos y medir la fluidez/FPS en equipos modestos; ajustar detalle o resolución si hace falta.
- Completar una partida manual en atardecer y modo oscuro para confirmar la legibilidad del aviso de daño y de los impactos, además del equilibrio del daño y los finales.
- El contacto produce 6 puntos de daño cada 1,4 s; la vida llega a cero tras 17 pulsos completos y activa la derrota.
- Completar los tres marcadores secuenciales de la ruta activa la victoria.
