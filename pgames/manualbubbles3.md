# Manual Bubble Profearauco 3

Guia rapida para crear juegos con `bubbleprofearauco3.js`, usando JSON, burbujas con LaTeX y niveles progresivos.

## Archivos necesarios

Para usar el motor en una pagina HTML:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
<script defer src="./bubbleprofearauco3.js"></script>
```

KaTeX es recomendado para que las formulas se vean bien en el titulo, categorias y burbujas. Si KaTeX no carga, el motor intenta mostrar texto plano como respaldo.

## HTML minimo

El motor se inicializa solo cuando encuentra `.juegosprofearauco-bubble2-auto`.

```html
<div class="juegosprofearauco-bubble2-auto">
  <textarea class="juegosprofearauco-bubble2-dataset" hidden>
{
  "titulo": "Bubble Profearauco",
  "config": {
    "columnas": 8,
    "filasVisibles": 12,
    "filasIniciales": 4,
    "tamanoBurbuja": 44,
    "nivelInicial": 1,
    "tema": "arauco-dark"
  },
  "niveles": [
    { "id": 1, "nombre": "Nivel 1", "descensoCadaTiros": 8, "maxCategorias": 2 }
  ],
  "valores": [
    { "id": "medio", "texto": "[m]frac{1}{2}[/m]" },
    { "id": "tercio", "texto": "[m]frac{1}{3}[/m]" },
    { "id": "x2", "texto": "[m]x^2[/m]" }
  ],
  "categorias": [
    { "id": "fracciones", "nombre": "Fracciones", "niveles": [1], "valores": ["medio", "tercio"] },
    { "id": "potencias", "nombre": "Potencias", "niveles": [1], "valores": ["x2"] }
  ]
}
  </textarea>
</div>
```

## Estructura del JSON

El JSON principal usa estas claves:

```json
{
  "titulo": "Bubble Profearauco",
  "config": {},
  "niveles": [],
  "valores": [],
  "categorias": []
}
```

### `titulo`

Texto superior del juego. Puede usar `[m]...[/m]`, pero conviene mantenerlo corto.

Ejemplo:

```json
"titulo": "Fracciones y potencias"
```

Evita titulos largos con muchas formulas, porque en pantallas angostas pueden partirse raro.

### `config`

Opciones generales:

```json
"config": {
  "columnas": 8,
  "filasVisibles": 12,
  "filasIniciales": 4,
  "tamanoBurbuja": 44,
  "nivelInicial": 1,
  "tema": "arauco-dark"
}
```

- `columnas`: cantidad de columnas del tablero.
- `filasVisibles`: alto total del tablero.
- `filasIniciales`: filas iniciales llenas con burbujas.
- `tamanoBurbuja`: diametro de cada burbuja en pixeles internos.
- `nivelInicial`: id del nivel donde empieza.
- `tema`: por ahora usar `"arauco-dark"`.

Recomendacion base:

```json
"columnas": 8,
"filasVisibles": 12,
"filasIniciales": 4,
"tamanoBurbuja": 44
```

### `niveles`

Cada nivel define dificultad y cuantas categorias pueden aparecer.

```json
{
  "id": 1,
  "nombre": "Fracciones",
  "descensoCadaTiros": 8,
  "maxCategorias": 2
}
```

- `id`: numero unico del nivel.
- `nombre`: nombre interno del nivel. Actualmente no se muestra como consigna.
- `descensoCadaTiros`: cada cuantos tiros baja el tablero. Si es `0`, no baja.
- `maxCategorias`: maximo de categorias activas en ese nivel.

Recomendaciones:

- Nivel facil: `descensoCadaTiros` entre 9 y 12.
- Nivel medio: `descensoCadaTiros` entre 7 y 8.
- Nivel dificil: `descensoCadaTiros` entre 5 y 6.
- Evita partir con demasiadas categorias. Dos categorias activas suelen ser buenas para un primer nivel.

### `valores`

Son las burbujas posibles.

```json
{ "id": "medio", "texto": "[m]frac{1}{2}[/m]" }
```

- `id`: identificador unico.
- `texto`: texto o formula que aparece en la burbuja.

Ejemplos:

```json
{ "id": "a", "texto": "A" }
{ "id": "medio", "texto": "[m]frac{1}{2}[/m]" }
{ "id": "raizx", "texto": "[m]sqrt{x}[/m]" }
{ "id": "leq", "texto": "[m]x leq 5[/m]" }
{ "id": "cdot", "texto": "[m]3 cdot x[/m]" }
```

### `categorias`

Las categorias indican que burbujas forman grupo entre si.

```json
{
  "id": "fracciones",
  "nombre": "Fracciones",
  "niveles": [1, 2],
  "valores": ["medio", "tercio", "cuarto"]
}
```

- `id`: identificador unico.
- `nombre`: nombre visible en los chips superiores.
- `niveles`: niveles donde puede aparecer.
- `nivel`: alternativa si solo pertenece a un nivel.
- `valores`: ids de valores que pertenecen a esta categoria.

Un valor puede estar en mas de una categoria. Eso crea burbujas mas versatiles, pero tambien puede hacer el juego mas facil o mas confuso.

## Sintaxis matematica `[m]...[/m]`

Usa `[m]...[/m]` para formulas en linea:

```json
{ "id": "medio", "texto": "[m]frac{1}{2}[/m]" }
```

El motor acepta comandos "amables" sin barra invertida:

```text
frac{1}{2}
sqrt{x}
x^2
alpha + beta
x leq 5
3 cdot x
```

Internamente se convierte a LaTeX:

```text
\frac{1}{2}
\sqrt{x}
x^2
\alpha + \beta
x \leq 5
3 \cdot x
```

Tambien puedes escribir LaTeX clasico con backslash, pero en JSON tendrias que escapar barras. Por eso se recomienda usar la sintaxis amable.

Mal comodo:

```json
{ "texto": "[m]\\frac{1}{2}[/m]" }
```

Mejor:

```json
{ "texto": "[m]frac{1}{2}[/m]" }
```

## Como funciona el juego

El jugador dispara una burbuja hacia el tablero.

Un grupo revienta cuando hay 3 o mas burbujas conectadas de una misma categoria.

Si una burbuja pertenece a varias categorias, puede ayudar a formar grupos en cualquiera de ellas.

El motor incluye:

- puntaje por burbujas reventadas,
- puntaje extra por colgantes,
- feedback visual de impacto,
- vibracion antes de que baje el tablero,
- evaluacion de oportunidad perdida,
- celebracion al limpiar nivel.

## Tiro seco y oportunidad perdida

El motor no castiga cualquier tiro que no revienta.

Un tiro cuenta como seco solo si:

- antes de disparar habia una posicion alcanzable para formar grupo de 3 o mas,
- la posicion era alcanzable por tiro directo o hasta 3 rebotes laterales,
- y el jugador no revento nada con ese tiro.

Si no habia forma realista de reventar, el tiro se considera preparacion.

Esto hace que el juego sea mas justo: no castiga al jugador por recibir una burbuja que solo sirve para preparar una jugada futura.

## Recomendaciones para disenar niveles

### 1. Categorias limpias

Cada categoria debe tener una idea clara.

Bueno:

```json
{ "id": "fracciones", "nombre": "Fracciones", "valores": ["medio", "tercio", "cuarto"] }
```

Confuso:

```json
{ "id": "simbolos", "nombre": "Simbolos", "valores": ["alpha", "pi", "leq", "cdot", "raizx"] }
```

Si mezclas demasiado, el jugador puede sentir que el criterio es arbitrario.

### 2. Pocos conceptos por nivel

Para niveles iniciales:

- 2 categorias activas.
- 3 a 5 valores por categoria.
- `filasIniciales` entre 3 y 4.

Para niveles avanzados:

- 3 categorias activas.
- valores que pertenecen a mas de una categoria.
- `descensoCadaTiros` mas bajo.

### 3. Cuidado con categorias muy pequenas

Una categoria con solo 1 valor puede generar grupos demasiado faciles si se repite mucho, o demasiado raros si aparece poco.

Ideal:

- 3 o mas valores por categoria.
- algunas repeticiones naturales.
- no demasiados valores unicos por nivel.

### 4. Usa solapamientos con intencion

Un valor puede pertenecer a dos categorias. Ejemplo:

```json
{
  "id": "medio",
  "texto": "[m]frac{1}{2}[/m]"
}
```

Puede pertenecer a:

```json
"fracciones"
"menoresQueUno"
```

Eso crea jugadas interesantes, pero si todos los valores pertenecen a muchas categorias el juego se vuelve demasiado facil.

### 5. Ajusta la presion

`descensoCadaTiros` controla la tension.

```json
"descensoCadaTiros": 8
```

Si el tablero baja muy seguido, el juego se vuelve ansioso. Si baja muy poco, pierde tension.

Valores recomendados:

- Practica: `0` o `10`.
- Normal: `7` u `8`.
- Desafio: `5` o `6`.

### 6. Mantener titulos cortos

El titulo debe orientar, no explicar todo.

Bueno:

```json
"titulo": "Fracciones y potencias"
```

Menos recomendable:

```json
"titulo": "Bubble Profearauco: [m]frac{1}{2}[/m], [m]sqrt{x}[/m] y [m]alpha[/m]"
```

Usa categorias para dar contexto y deja que las burbujas muestren el contenido.

## Ejemplo completo recomendado

```json
{
  "titulo": "Fracciones y potencias",
  "config": {
    "columnas": 8,
    "filasVisibles": 12,
    "filasIniciales": 4,
    "tamanoBurbuja": 44,
    "nivelInicial": 1,
    "tema": "arauco-dark"
  },
  "niveles": [
    {
      "id": 1,
      "nombre": "Fracciones y potencias",
      "descensoCadaTiros": 8,
      "maxCategorias": 2
    },
    {
      "id": 2,
      "nombre": "Raices y simbolos",
      "descensoCadaTiros": 7,
      "maxCategorias": 3
    }
  ],
  "valores": [
    { "id": "medio", "texto": "[m]frac{1}{2}[/m]" },
    { "id": "tercio", "texto": "[m]frac{1}{3}[/m]" },
    { "id": "cuarto", "texto": "[m]frac{1}{4}[/m]" },
    { "id": "x2", "texto": "[m]x^2[/m]" },
    { "id": "x3", "texto": "[m]x^3[/m]" },
    { "id": "raizx", "texto": "[m]sqrt{x}[/m]" },
    { "id": "raiz2", "texto": "[m]sqrt{2}[/m]" },
    { "id": "alpha", "texto": "[m]alpha[/m]" },
    { "id": "beta", "texto": "[m]beta[/m]" },
    { "id": "pi", "texto": "[m]pi[/m]" }
  ],
  "categorias": [
    {
      "id": "fracciones",
      "nombre": "Fracciones",
      "niveles": [1],
      "valores": ["medio", "tercio", "cuarto"]
    },
    {
      "id": "potencias",
      "nombre": "Potencias",
      "niveles": [1, 2],
      "valores": ["x2", "x3"]
    },
    {
      "id": "raices",
      "nombre": "Raices",
      "niveles": [2],
      "valores": ["raizx", "raiz2"]
    },
    {
      "id": "letrasGriegas",
      "nombre": "Letras griegas",
      "niveles": [2],
      "valores": ["alpha", "beta", "pi"]
    }
  ]
}
```

## Errores comunes

### Usar comillas simples

JSON requiere comillas dobles:

```json
{ "id": "medio" }
```

No:

```js
{ 'id': 'medio' }
```

### Repetir ids

Cada `id` debe ser unico dentro de su lista.

### Referenciar valores inexistentes

Si una categoria usa:

```json
"valores": ["medio", "quinto"]
```

debe existir un valor con:

```json
{ "id": "quinto", "texto": "..." }
```

### Poner demasiadas formulas en el titulo

El motor puede renderizarlas, pero visualmente puede quedar apretado.

## Recomendacion final

Primero crea el JSON con categorias muy limpias. Luego prueba el juego y ajusta:

1. `filasIniciales`,
2. `descensoCadaTiros`,
3. cantidad de valores por categoria,
4. solapamientos entre categorias,
5. `maxCategorias`.

El motor ya tiene feedback, presion, rebotes, oportunidad perdida, combos y celebracion. La calidad final del juego dependera sobre todo de un buen diseno del JSON.
