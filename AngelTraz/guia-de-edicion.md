# Guía de edición — AngelTraz

Todo el diseño vive en **un solo archivo**: `css/styles.css`. Los tres HTML
(`index.html`, `blog.html`, `contacto.html`) solo contienen texto, imágenes
y estructura. Si cambias algo en `styles.css`, se actualiza en las tres
páginas a la vez porque las tres cargan el mismo archivo.

---

## 1. Cambiar colores

Todos los colores del sitio están escritos como códigos hexadecimales
(`#0d0d0c`, `#c9a35a`, etc.) repartidos en distintas reglas de
`styles.css`. Los tres que más vas a tocar:

| Color | Código actual | Dónde se usa |
|---|---|---|
| Fondo general | `#0d0d0c` (casi negro) | `body`, `.header` |
| Texto principal | `#f2f0ea` (blanco hueso) | `body`, `h1/h2/h3` |
| Acento (dorado) | `#c9a35a` | bordes al pasar el mouse, botón de "Enviar", `.marca`, `.numero` en servicios |

**Para cambiar el acento por otro color**, busca `#c9a35a` en `styles.css`
(Ctrl+F) y reemplázalo en cada lugar donde aparece — son unas 6 líneas.
Ejemplo, en el botón de contacto:

```css
.contacto button {
    background-color: #c9a35a;   /* ← cambia este código */
}
```

---

## 2. Cambiar la fuente (tipografía)

Al principio de `styles.css` está la fuente de todo el sitio:

```css
body {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}

h1, h2, h3 {
    font-family: 'Fraunces', Georgia, serif;
}
```

- La lista de nombres es un **orden de preferencia**: el navegador usa el
  primero que encuentre instalado, y si no encuentra ninguno, cae al
  último (`sans-serif` o `serif`).
- Para cambiar la fuente de los títulos, reemplaza `'Fraunces', Georgia`
  por otra fuente que ya tenga tu sistema (por ejemplo `'Times New Roman'`).

---

## 3. Cambiar el tamaño de un título

Cada bloque de texto tiene su propio `font-size`. Ejemplo, el título
grande de la portada:

```css
.portada-texto h1 {
    font-size: clamp(46px, 7vw, 76px);
}
```

`clamp(mínimo, preferido, máximo)` simplemente evita que el título se
vea gigante en pantallas pequeñas. Si no quieres pensar en eso, puedes
reemplazarlo por un número fijo:

```css
.portada-texto h1 {
    font-size: 60px;
}
```

Los demás títulos son más simples, por ejemplo en las áreas de "Sobre mí":

```css
.area h2 {
    font-size: 26px;   /* ← sube o baja este número */
}
```

---

## 4. Ubicar y cambiar imágenes

En el HTML, una imagen es una sola línea:

```html
<img src="img/portada.jpg" alt="Retrato de AngelTraz en su espacio de trabajo creativo">
```

- `src="img/portada.jpg"` es la **ruta**: dice que el archivo está dentro
  de la carpeta `img/`, junto a los HTML. Para cambiar la imagen, solo
  reemplaza `portada.jpg` por el nombre de tu archivo (debe estar en esa
  misma carpeta).
- `alt="..."` es el texto que describe la imagen para lectores de pantalla
  y para cuando la imagen no carga. Siempre debe describir lo que se ve.

No necesitas tocar CSS para que la imagen se ajuste: la regla

```css
img {
    max-width: 100%;
}
```

ya está aplicada a **todas** las imágenes del sitio, así que nunca se
desbordan de su contenedor.

---

## 5. El Box Model (margin, padding, border, width, height)

El Box Model es simplemente: **borde → relleno interno (padding) →
contenido → espacio exterior (margin)**. Un ejemplo real de tu CSS, la
tarjeta de cada servicio:

```css
.servicio {
    padding: 28px;              /* espacio entre el borde y el texto */
    border: 1px solid #262521;  /* línea del borde */
    border-radius: 6px;         /* esquinas redondeadas */
}
```

Y el espacio entre tarjetas se controla en el contenedor con `gap`
(una forma moderna y simple de poner "margen" entre elementos de un
Flexbox, sin tener que calcularlo tarjeta por tarjeta):

```css
.lista-servicios {
    display: flex;
    gap: 24px;   /* espacio entre cada .servicio */
}
```

Regla general para modificar cualquier bloque: `padding` cambia el
espacio *interior*, `margin` cambia el espacio *alrededor*, `border`
dibuja el contorno, `width`/`height` fijan el tamaño (si no los ves en
una regla, el elemento se ajusta solo a su contenido).

---

## 6. Añadir o quitar un párrafo

Un párrafo es siempre `<p>texto</p>`. Para **añadir** uno, copia una línea
existente y cambia el texto. Ejemplo, dentro de "Sobre mí":

```html
<p>
    A partir de ahí, el trabajo se expande hacia diferentes medios.
</p>
```

Para **quitar** un párrafo, borra ese bloque completo (desde `<p>` hasta
`</p>`). No rompe nada más, siempre que borres la etiqueta completa.

---

## 7. Añadir una sección nueva con su propio enlace

Tienes dos casos distintos:

**A. Nueva página completa** (como `blog.html`):
1. Duplica `contacto.html` y renómbralo, por ejemplo `nueva-pagina.html`.
2. Cambia su contenido dentro de `<main>`.
3. Agrega el enlace en el menú de **las tres páginas** (dentro de `<nav class="nav">`):
   ```html
   <a href="nueva-pagina.html">Nueva sección</a>
   ```

**B. Nueva sección dentro de la misma página** (por ejemplo, agregar un
bloque nuevo debajo de "Servicios" en `index.html`):
1. Copia un `<section>...</section>` completo y dale un `id` único:
   ```html
   <section class="servicios" id="nueva-seccion">
       ...
   </section>
   ```
2. Enlázalo desde el menú usando `#` + ese mismo id:
   ```html
   <a href="index.html#nueva-seccion">Nueva sección</a>
   ```
   El `#` le dice al navegador "no cambies de página, solo desplázate
   hasta el elemento con ese id". Eso es todo lo que hace la navegación
   de este sitio — no hay nada más "mágico" detrás.

---

## 8. Efectos sencillos (el que creías complejo)

El efecto que viste en tu otra página — la tarjeta que sube unos
pixeles y el borde cambia de color al pasar el mouse — son solo **dos
propiedades** trabajando juntas. Ya lo agregué a las tarjetas del blog
(`.entrada-blog`) para que lo tengas de ejemplo real:

```css
.entrada-blog {
    border: 1px solid #262521;
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.entrada-blog:hover {
    transform: translateY(-4px);
    border-color: #c9a35a;
}
```

Desglosado:

- `:hover` — esta regla solo se activa mientras el mouse está encima
  del elemento. En cuanto lo quitas, vuelve a la regla normal.
- `transform: translateY(-4px)` — mueve el elemento 4 píxeles hacia
  arriba (`Y` es el eje vertical; un número negativo sube, uno positivo
  baja). No mueve nada más del diseño, solo esa tarjeta.
- `border-color: #c9a35a` — simplemente cambia el color del borde que
  ya existía.
- `transition: transform 0.2s ease, border-color 0.2s ease` — esta línea
  va en el elemento **normal**, no en el `:hover`. Le dice al navegador
  "cuando cambien `transform` o `border-color`, no lo hagas de golpe,
  anímalo durante 0.2 segundos". Si borras esta línea, el efecto sigue
  funcionando pero se ve instantáneo, sin animación.

Puedes copiar este mismo patrón (`transition` en la regla normal +
`:hover` con el cambio) sobre cualquier otro bloque del sitio, por
ejemplo las tarjetas de servicios (`.servicio:hover`) o las áreas de
"Sobre mí" (`.area:hover`).
