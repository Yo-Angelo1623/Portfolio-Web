# INFORME DE CONTINUIDAD — LA PIEDRA INVISIBLE

**Versión actual:** v1.1

**Motor y tecnologías:** Vite + Three.js + JavaScript ejecutado en navegador local mediante un prototipo web 3D.

**Estado de ejecución:** Para ejecutar el proyecto se deben instalar dependencias con `npm install` y arrancar el servidor con `npm run dev -- --host 0.0.0.0`. Se comprobó su funcionamiento real con `npm run build` y la carga del prototipo en el navegador.

**Fase actual de la hoja de ruta:** 9. Movimiento dinámico, persecución con navegación y finales de partida.

**Funcionalidades implementadas:**
- escena urbana básica con calle, aceras y edificios simples
- iluminación cálida de atardecer
- movimiento con aceleración/desaceleración, balanceo de cámara al caminar y campo visual ampliado al correr
- seis perros visibles con siluetas diferenciadas por raza: pastor alemán, terrier, mastín, labrador, husky y bulldog
- modelos de perros con proporciones, hocicos, orejas, patas y colas específicos, con animación sutil de patas y cola
- barra de vida en la interfaz
- menú funcional con iniciar, reanudar y alternar atardecer
- botón de reinicio que vuelve al estado inicial del prototipo
- selector de herramientas con botones de interfaz, teclas 1-5 y teclado numérico
- inventario limitado y lanzamiento con gravedad; objetos colisionan con perros, suelo y edificios
- colisiones circulares del jugador/perros con edificios y entre sí; contacto con perros causa daño gradual y separa los cuerpos
- ruta de evacuación con tres marcadores secuenciales, distancia y estado de tramo
- contacto con perros inflige 6 puntos de daño cada 1,4 segundos como máximo
- impactos muestran ondas/partículas diferenciadas y el daño recibido activa un destello periférico breve
- herramientas con comportamiento diferenciado: comida atrae, agua y otros recursos repelen, y la piedra invisible amenaza sin contacto físico
- comportamiento diferenciado por estado: tranquilo, alerta, persecución, ataque y agotamiento
- aviso textual temporal al recibir cada pulso de daño; la barra de vida cambia de verde a ámbar y rojo según el nivel y expone el valor con semántica de progreso accesible
- ajustes de rendimiento: resolución de render limitada a 1,5x, sombras de perros desactivadas y delta de simulación limitado a 50 ms para amortiguar pausas
- piedra invisible de uso ilimitado con enfriamiento entre pulsos
- botellas y ramas recogibles en la calle; sus cantidades vuelven a los valores de inicio al reiniciar
- tres bancos y tres árboles como refugios en altura activados con E; la resistencia baja mientras se permanece arriba y se recupera al volver al suelo
- el daño por contacto considera la altura del jugador y el alcance de cada raza; el banco protege de perros de menor alcance y el árbol protege de todos
- decoración de calle con postes de luz, bolsas de basura y tres vehículos estacionados con colisión
- mapa ampliado a seis manzanas en cuadrícula de dos columnas por tres filas, con cruces, edificios y ruta reubicada
- los perros detectan al jugador por visión/distancia y por el ruido de la carrera; cada raza tiene velocidad de persecución propia
- navegación por cuadrícula y colisiones para rodear edificios y elementos urbanos; patas articuladas con zancada sincronizada al movimiento
- WASD y flechas caminan; Q corre a mayor velocidad y consume resistencia; E escala y baja de refugios
- al ser alcanzado, cinco pulsaciones de Espacio dentro de un segundo agotan la resistencia del perro y liberan al jugador, siempre que conserve resistencia suficiente
- interfaz de forcejeo con barra de resistencia del perro y contador de pulsaciones; permanece el daño periódico por contacto
- completar los tres puntos de la ruta activa la victoria; llegar a cero de vida activa la derrota y muestra opciones para reintentar o volver al menú

**Funcionalidades parcialmente implementadas:**
- la respuesta de los animales todavía no incorpora señales complejas como ladridos o comunicación entre perros
- el inventario se reinicia al reiniciar la partida y no se guarda entre sesiones

**Pendientes conocidos:**
- revisar visualmente las seis siluetas desde varios ángulos y medir la fluidez/FPS en equipos de distinta capacidad
- probar el equilibrio del daño durante una partida completa y revisar la legibilidad de efectos con distintas condiciones de luz
- verificar en juego la accesibilidad de todos los recogibles y refugios, y ajustar ritmo de resistencia si hace falta
- probar en toda el área la persecución alrededor de obstáculos, la secuencia de forcejeo por raza y el rendimiento tras ampliar la escena

**Archivos principales:**
- index.html: estructura de la interfaz HUD y menú principal
- src/main.js: entrada del juego y arranque de la escena
- src/game.js: lógica del escenario, jugador, perros, herramientas y cámara
- src/style.css: estilo visual del HUD, menú y interfaz minimalista
- package.json: configuración del proyecto y scripts de ejecución

**Decisiones de diseño confirmadas:**
- perspectiva en primera persona
- estética minimalista y cálida con atardecer dominante
- controles de teclado y ratón para PC
- foco en supervivencia urbana no letal
- la ruta completada es victoria y la vida en cero es derrota

**Último cambio realizado:**
Se añadieron caminata con aceleración, carrera con Q, movimiento de cámara, detección progresiva de peligro, estados de ataque y agotamiento, navegación de perros alrededor de obstáculos, patas articuladas animadas y finales de victoria/derrota. Se verificaron build, controles, una ruta de persecución obstruida y ambos finales en navegador. Vite advierte que el bundle principal queda en 512,70 KB frente al umbral orientativo de 500 KB.

**Próxima tarea concreta:**
Probar las seis manzanas de extremo a extremo, ajustar rutas de persecución, validar forcejeo para todas las razas y medir FPS en un equipo modesto.

**Criterio de aceptación de la próxima tarea:**
El jugador debe recorrer las seis manzanas sin quedar bloqueado; Q acelera y consume resistencia; los perros alternan estados y rodean obstáculos con patas animadas; cinco pulsaciones de Espacio liberan al jugador; la ruta completa gana y la vida en cero pierde; E conserva la subida/bajada de refugios.

**Restricciones que deben mantenerse:**
- no añadir límite de tiempo ni progresión adicional
- mantener las herramientas y el forcejeo no letales
- mantener la experiencia en prototipo funcional y estable

## Reglas para el agente que retome el proyecto

1. Leer este informe y el prompt maestro antes de tocar el código.
2. Revisar los archivos reales del proyecto antes de modificar el contenido.
3. Mantener las decisiones ya verificadas y no reescribir sistemas que funcionen.
4. Trabajar sólo en la siguiente tarea acordada.
5. Ejecutar y comprobar el proyecto tras cambios importantes.
6. Actualizar este informe si se modifica el estado real del proyecto.
