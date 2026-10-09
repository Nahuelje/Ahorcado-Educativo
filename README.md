# 🎯 Ahorcado Educativo

Juego del ahorcado para el navegador pensado para **aprender vocabulario mientras jugás**. Cada palabra viene con su definición, así que al terminar una ronda (ganes o pierdas) aprendés qué significa.

Hecho con HTML, CSS y JavaScript puro: sin frameworks ni dependencias de instalación.

## ✨ Características

- **5 temas**: Programación, Bases de datos, Matemáticas, Ciencias y Geografía.
- **Dificultad progresiva**: cada victoria sube tu racha, las palabras se alargan y tenés menos intentos.
- **Corazones**: perder una palabra corta la racha y te quita un corazón; con 0 termina la partida.
- **Comodines** cada 3 victorias: 💡 pista, 🔤 revelar letra, ❤️ corazón extra o ⏭️ saltar.
- **Modo repaso** con las palabras que fallaste.
- **Ranking, diccionario y logros** guardados en el navegador (`localStorage`).
- **Música y efectos de sonido** generados con Web Audio API, más partículas y confeti.

## 🚀 Cómo jugar

Abrí `index.html` en el navegador, o levantá el servidor local incluido (requiere Node.js):

```bash
node serve.js
```

y entrá a http://localhost:8080.

## 📁 Estructura

| Archivo      | Contenido                                      |
|--------------|------------------------------------------------|
| `index.html` | Pantallas: menú, juego, ranking y modal         |
| `game.js`    | Lógica del juego, puntajes, comodines y logros |
| `words.js`   | Banco de palabras con sus definiciones         |
| `audio.js`   | Música y efectos con Web Audio API             |
| `fx.js`      | Efectos visuales (partículas, destellos)       |
| `style.css`  | Estilos                                        |
| `serve.js`   | Servidor estático mínimo para probar en local  |

## ➕ Agregar palabras

En `words.js`, copiá una categoría y cambiá las palabras. Cada entrada tiene la palabra (`p`) y su definición (`d`):

```js
{ p: "algoritmo", d: "Secuencia finita de pasos para resolver un problema." }
```
