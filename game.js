const $ = (id) => document.getElementById(id);

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_CORAZONES = 5;
const MAX_COMODIN = 3;
const MAX_REPASO = 30;
const HITOS_RACHA = [3, 6, 10];
const CLAVES = {
  puntajes: "ahorcado.puntajes",
  logros: "ahorcado.logros",
  diccionario: "ahorcado.diccionario",
  repaso: "ahorcado.repaso",
  stats: "ahorcado.stats",
};

// Niveles: se activan según la racha de victorias.
const NIVELES = [
  { nombre: "Fácil",   color: "#3ddc97", desde: 0,  min: 4, max: 7,  intentos: 6, costePista: 5 },
  { nombre: "Medio",   color: "#ffd166", desde: 3,  min: 6, max: 9,  intentos: 5, costePista: 10 },
  { nombre: "Difícil", color: "#ff9f5a", desde: 6,  min: 8, max: 12, intentos: 4, costePista: 15 },
  { nombre: "Experto", color: "#ff5c7a", desde: 10, min: 9, max: 30, intentos: 3, costePista: 25 },
];

const COMODINES = {
  pista:   { icono: "💡", nombre: "Pista" },
  revelar: { icono: "🔤", nombre: "Revelar letra" },
  vida:    { icono: "❤️", nombre: "Corazón extra" },
  saltar:  { icono: "⏭️", nombre: "Saltar" },
};

const LOGROS = [
  { id: "primera",   texto: "Primera palabra ganada",    ok: (c) => c.victorias >= 1 },
  { id: "racha3",    texto: "Racha de 3",                ok: (c) => c.racha >= 3 },
  { id: "racha6",    texto: "Racha de 6: modo Difícil",  ok: (c) => c.racha >= 6 },
  { id: "racha10",   texto: "Racha de 10: modo Experto", ok: (c) => c.racha >= 10 },
  { id: "perfecta",  texto: "Palabra sin errores",       ok: (c) => c.sinErrores },
  { id: "puntos300", texto: "300 puntos en una partida", ok: (c) => c.puntos >= 300 },
  { id: "aprende10", texto: "10 palabras aprendidas",    ok: (c) => c.aprendidas >= 10 },
  { id: "aprende50", texto: "50 palabras aprendidas",    ok: (c) => c.aprendidas >= 50 },
];

// Partes del ahorcado. Cada parte es una lista de segmentos:
// [x1, y1, x2, y2] para líneas, o { arco: [cx, cy, radio] } para la cabeza.
const PARTES = [
  [[20, 280, 180, 280]],               // base
  [[60, 280, 60, 30]],                 // poste
  [[60, 30, 170, 30]],                 // viga
  [[170, 30, 170, 70]],                // cuerda
  [{ arco: [170, 90, 20] }],           // cabeza
  [[170, 110, 170, 190]],              // cuerpo
  [[170, 130, 140, 165]],              // brazo izquierdo
  [[170, 130, 200, 165]],              // brazo derecho
  [[170, 190, 140, 240]],              // pierna izquierda
  [[170, 190, 200, 240]],              // pierna derecha
];

// ---------- Utilidades ----------

function leer(clave, def) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: el juego sigue funcionando.
  }
}

const normalizar = (s) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esLetra = (ch) => /[A-Z]/.test(normalizar(ch));
const longitud = (p) => normalizar(p).replace(/[^A-Z]/g, "").length;
const nivelPara = (racha) => [...NIVELES].reverse().find((n) => racha >= n.desde);
const multiplicador = () => Math.min(3, 1 + Math.floor(juego.racha / 3) * 0.5);

function toast(texto) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = texto;
  $("toasts").appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function sacudir() {
  const c = $("canvas");
  c.classList.remove("sacudir");
  void c.offsetWidth; // reinicia la animación
  c.classList.add("sacudir");
}

function setVal(el, v) {
  if (el.textContent === String(v)) return;
  el.textContent = v;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

// ---------- Estado persistente ----------

const estado = {
  stats: leer(CLAVES.stats, { victorias: 0, mejorRacha: 0 }),
  logros: leer(CLAVES.logros, {}),
  diccionario: leer(CLAVES.diccionario, {}),
  repaso: leer(CLAVES.repaso, []),
};

// ---------- Estado de la partida ----------

let juego = null;

function poolPara(modo) {
  if (modo === "repaso") return [...estado.repaso];
  const cats = modo === "mezcla" ? Object.keys(CATEGORIAS) : [modo];
  return cats.flatMap((k) => CATEGORIAS[k].palabras.map((w) => ({ ...w, cat: CATEGORIAS[k].nombre })));
}

function nombreModo(modo) {
  if (modo === "mezcla") return "Mezcla";
  if (modo === "repaso") return "Repaso";
  return CATEGORIAS[modo].nombre;
}

function iniciarPartida(modo) {
  const pool = poolPara(modo);
  if (pool.length === 0) return;
  juego = {
    modo,
    pool,
    corazones: 3,
    racha: 0,
    mejorRacha: 0,
    puntos: 0,
    vistas: new Set(),
    comodines: { pista: 1, revelar: 1, vida: 0, saltar: 1 },
    palabra: null,
  };
  mostrar("juego");
  siguientePalabra();
}

function siguientePalabra() {
  const nivel = nivelPara(juego.racha);
  let candidatas = juego.pool.filter((w) => longitud(w.p) >= nivel.min && longitud(w.p) <= nivel.max);
  if (candidatas.length === 0) candidatas = juego.pool;

  let disponibles = candidatas.filter((w) => !juego.vistas.has(w.p));
  if (disponibles.length === 0) {
    juego.vistas.clear();
    disponibles = candidatas;
  }
  const w = disponibles[Math.floor(Math.random() * disponibles.length)];
  juego.vistas.add(w.p);

  const letras = [...w.p.toUpperCase()];
  juego.palabra = {
    ...w,
    nivel,
    letras,
    claves: letras.map((c) => normalizar(c)),
    reveladas: letras.map((c) => !esLetra(c)),
    usadas: new Set(),
    errores: 0,
    intentosMax: nivel.intentos,
    pista: false,
    limpia: true,
    cerrada: false,
    perdida: false,
    nuevas: [],
  };
  renderTodo();
}

// ---------- Mascota ----------

let temporizadorMascota = null;
const caraBase = () => (juego && juego.racha >= 6 ? "🤩" : "🙂");

function mascota(cara, clase = "", ms = 1100) {
  const m = $("mascota");
  clearTimeout(temporizadorMascota);
  m.textContent = cara;
  m.className = "mascota";
  void m.offsetWidth;
  if (clase) m.classList.add(clase);
  temporizadorMascota = setTimeout(() => {
    m.textContent = caraBase();
    m.className = "mascota";
  }, ms);
}

// ---------- Jugada ----------

function adivinar(letra) {
  const p = juego?.palabra;
  if (!p || p.cerrada || p.usadas.has(letra)) return;
  p.usadas.add(letra);
  Sonido.sfx("tecla");

  const pos = [];
  p.claves.forEach((k, i) => { if (k === letra) pos.push(i); });

  if (pos.length) {
    pos.forEach((i) => (p.reveladas[i] = true));
    p.nuevas = pos;
    const ganado = pos.length * Math.round(10 * multiplicador());
    juego.puntos += ganado;
    Sonido.sfx("acierto", pos.length);
    mascota("😄", "saltar", 900);
    Fx.texto(`+${ganado}`, $("puntos"), "#3ddc97");
    if (p.reveladas.every(Boolean)) return ganarPalabra();
  } else {
    p.errores++;
    p.limpia = false;
    juego.puntos = Math.max(0, juego.puntos - 5);
    Sonido.sfx("error");
    Sonido.vibrar(40);
    sacudir();
    Fx.destello("rgba(255, 92, 122, .22)");
    Fx.texto("-5", $("puntos"), "#ff5c7a");
    mascota("😰", "caer", 900);
    if (p.errores >= p.intentosMax) return perderPalabra();
  }
  renderTodo();
}

function definicionHTML(p) {
  return `
    <p class="cat">${p.cat}</p>
    <p class="definicion-palabra">${p.p.toUpperCase()}</p>
    <p class="definicion">${p.d}</p>`;
}

function ganarPalabra() {
  const p = juego.palabra;
  const nivelAntes = nivelPara(juego.racha);
  p.cerrada = true;
  juego.racha++;
  juego.mejorRacha = Math.max(juego.mejorRacha, juego.racha);

  const bonus = Math.round(50 * multiplicador()) + (p.limpia ? 30 : 0);
  juego.puntos += bonus;

  estado.stats.victorias++;
  estado.stats.mejorRacha = Math.max(estado.stats.mejorRacha, juego.racha);
  guardar(CLAVES.stats, estado.stats);

  aprender(p);
  quitarDeRepaso(p);

  const nivelAhora = nivelPara(juego.racha);
  const premio = juego.racha % 3 === 0 ? otorgarComodin() : null;

  renderTodo();
  Sonido.sfx("victoria");
  Sonido.vibrar([30, 40, 60]);
  mascota("🥳", "saltar", 2200);
  if (window.confetti) confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });

  // Hitos de racha y cambio de nivel: primero el banner, después el modal.
  const hito = HITOS_RACHA.includes(juego.racha);
  const demora = hito ? 1200 : 0;
  if (hito) {
    setTimeout(() => {
      Sonido.sfx("racha");
      Fx.banner(`¡RACHA ${juego.racha}! 🔥`);
      Fx.destello(nivelAhora.color + "55");
    }, 200);
  }
  if (nivelAhora !== nivelAntes) {
    setTimeout(() => Fx.banner(`NIVEL ${nivelAhora.nombre.toUpperCase()}`), demora + 200);
  }

  setTimeout(() => abrirModal({
    titulo: "¡Correcto! 🎉",
    texto: definicionHTML(p),
    extra: `<p>+${bonus} puntos${p.limpia ? " (incluye bonus sin errores)" : ""}</p>` +
      (premio ? `<p>🎁 Comodín ganado: <strong>${COMODINES[premio].nombre}</strong></p>` : ""),
    boton: "Siguiente palabra",
    onBoton: siguientePalabra,
  }), demora);
  revisarLogros({ sinErrores: p.limpia });
}

function perderPalabra() {
  const p = juego.palabra;
  p.cerrada = true;
  p.perdida = true;
  juego.racha = 0;
  juego.corazones--;
  agregarRepaso(p);
  Sonido.sfx("perder");
  Sonido.vibrar([60, 60, 60]);
  Fx.destello("rgba(255, 92, 122, .3)");
  renderTodo();

  if (juego.corazones > 0) {
    Sonido.sfx("corazon");
    mascota("💀", "caer", 2500);
    abrirModal({
      titulo: `Era: ${p.p.toUpperCase()}`,
      texto: definicionHTML(p),
      extra: "<p>Perdiste un corazón ❤️ y tu racha volvió a 0.</p>",
      boton: "Siguiente palabra",
      onBoton: siguientePalabra,
    });
    return;
  }

  mascota("💀", "caer", 4000);
  Fx.banner("GAME OVER");
  abrirModal({
    titulo: "Sin corazones",
    texto: definicionHTML(p) + `<p>Puntos: <strong>${juego.puntos}</strong> · Mejor racha: <strong>${juego.mejorRacha}</strong></p>`,
    extra: `<label for="iniciales">Tus iniciales (hasta 3 letras)</label>
      <input id="iniciales" maxlength="3" autocomplete="off">
      <p class="small">Se guardan en este navegador.</p>`,
    boton: "Guardar y volver",
    onBoton: () => {
      guardarPuntaje();
      mostrar("menu");
    },
  });
}

function aprender(p) {
  estado.diccionario[normalizar(p.p)] = { p: p.p, d: p.d, cat: p.cat };
  guardar(CLAVES.diccionario, estado.diccionario);
}

function agregarRepaso(p) {
  if (estado.repaso.some((w) => w.p === p.p)) return;
  estado.repaso = [{ p: p.p, d: p.d, cat: p.cat }, ...estado.repaso].slice(0, MAX_REPASO);
  guardar(CLAVES.repaso, estado.repaso);
}

function quitarDeRepaso(p) {
  const antes = estado.repaso.length;
  estado.repaso = estado.repaso.filter((w) => w.p !== p.p);
  if (estado.repaso.length !== antes) guardar(CLAVES.repaso, estado.repaso);
}

function guardarPuntaje() {
  const nombre = ($("iniciales")?.value || "").trim().toUpperCase().slice(0, 3) || "ANON";
  const lista = leer(CLAVES.puntajes, []);
  lista.push({
    nombre,
    puntos: juego.puntos,
    racha: juego.mejorRacha,
    modo: nombreModo(juego.modo),
    fecha: new Date().toLocaleDateString("es-AR"),
  });
  lista.sort((a, b) => b.puntos - a.puntos);
  guardar(CLAVES.puntajes, lista.slice(0, 10));
}

// ---------- Comodines ----------

function otorgarComodin() {
  const opciones = Object.keys(COMODINES).filter((k) => juego.comodines[k] < MAX_COMODIN);
  if (opciones.length === 0) return null;
  const k = opciones[Math.floor(Math.random() * opciones.length)];
  juego.comodines[k]++;
  return k;
}

function usarComodin(k) {
  const p = juego?.palabra;
  if (!p || p.cerrada || juego.comodines[k] <= 0) return;

  if (k === "pista") {
    if (p.pista) return;
    p.pista = true;
    juego.puntos = Math.max(0, juego.puntos - p.nivel.costePista);
    Sonido.sfx("pista");
    mascota("🤔", "", 1200);
  } else if (k === "revelar") {
    const pendientes = p.claves
      .map((c, i) => (!p.reveladas[i] && esLetra(p.letras[i]) ? i : -1))
      .filter((i) => i >= 0);
    if (pendientes.length === 0) return;
    const letra = p.claves[pendientes[Math.floor(Math.random() * pendientes.length)]];
    p.usadas.add(letra);
    p.nuevas = [];
    p.claves.forEach((c, i) => {
      if (c === letra && !p.reveladas[i]) {
        p.reveladas[i] = true;
        p.nuevas.push(i);
      }
    });
    Sonido.sfx("comodin");
  } else if (k === "vida") {
    if (juego.corazones >= MAX_CORAZONES) return;
    juego.corazones++;
    Sonido.sfx("comodin");
    Fx.texto("+❤️", $("corazones"), "#ff5c7a");
  } else if (k === "saltar") {
    juego.comodines.saltar--;
    agregarRepaso(p);
    juego.racha = 0;
    Sonido.sfx("click");
    siguientePalabra();
    return;
  }

  juego.comodines[k]--;
  if (p.reveladas.every(Boolean)) return ganarPalabra();
  renderTodo();
}

// ---------- Logros ----------

function revisarLogros(extra = {}) {
  const ctx = {
    victorias: estado.stats.victorias,
    racha: juego.racha,
    puntos: juego.puntos,
    sinErrores: false,
    aprendidas: Object.keys(estado.diccionario).length,
    ...extra,
  };
  for (const l of LOGROS) {
    if (!estado.logros[l.id] && l.ok(ctx)) {
      estado.logros[l.id] = true;
      toast(`🏆 Logro: ${l.texto}`);
      Sonido.sfx("comodin");
    }
  }
  guardar(CLAVES.logros, estado.logros);
}

// ---------- Render ----------

function renderTodo() {
  const p = juego.palabra;
  const nivel = p.nivel;

  $("nivel").textContent = nivel.nombre;
  $("nivel").style.background = nivel.color;
  $("nivel").style.color = "#14102a";
  $("categoria-juego").textContent = p.cat;
  setVal($("puntos"), juego.puntos);
  setVal($("racha"), juego.racha);

  const m = multiplicador();
  setVal($("mult"), "x" + (m % 1 ? m.toFixed(1) : m));
  $("corazones").textContent = "❤️".repeat(juego.corazones) + "🖤".repeat(MAX_CORAZONES - juego.corazones);

  renderBarraNivel();
  renderPalabra();
  renderTeclado();
  renderComodines();
  dibujar();
}

function renderBarraNivel() {
  const nivel = juego.palabra.nivel;
  const idx = NIVELES.indexOf(nivel);
  const sig = NIVELES[idx + 1];
  const pct = sig ? ((juego.racha - nivel.desde) / (sig.desde - nivel.desde)) * 100 : 100;
  const barra = $("barra-nivel");
  barra.style.width = Math.max(0, Math.min(100, pct)) + "%";
  barra.style.background = nivel.color;
  barra.style.color = nivel.color;
  $("barra-texto").textContent = sig
    ? `Próximo nivel: ${sig.nombre} (racha ${sig.desde})`
    : "¡Nivel máximo!";
}

function renderPalabra() {
  const p = juego.palabra;
  const nuevas = new Set(p.nuevas);
  p.nuevas = [];

  $("palabra").innerHTML = p.letras.map((c, i) => {
    if (!esLetra(c)) return `<span class="sep">${c === " " ? "&nbsp;" : c}</span>`;
    const visible = p.reveladas[i] || p.perdida;
    const clases = ["letra"];
    if (!visible) clases.push("hueco");
    if (nuevas.has(i)) clases.push("pop");
    if (p.perdida && !p.reveladas[i]) clases.push("falla");
    return `<span class="${clases.join(" ")}">${visible ? c : "_"}</span>`;
  }).join("");

  // Explosión de partículas en cada letra recién revelada.
  if (nuevas.size) {
    document.querySelectorAll("#palabra .pop").forEach((el) =>
      Fx.explotarEn(el, [p.nivel.color, "#ffffff", "#ffd166"]));
  }

  $("pista").innerHTML = p.pista
    ? `💡 <strong>${p.cat}</strong>: ${p.d}`
    : `Categoría: <strong>${p.cat}</strong> · Usá 💡 si necesitás una pista`;

  $("intentos").textContent = `Intentos: ${p.intentosMax - p.errores} de ${p.intentosMax}`;
}

function renderTeclado() {
  const p = juego.palabra;
  $("teclado").innerHTML = LETRAS.split("").map((l) => {
    const usada = p.usadas.has(l);
    const acierto = p.claves.includes(l);
    const clase = usada ? (acierto ? "ok" : "ko") : "";
    const off = usada || p.cerrada;
    return `<button class="tecla ${clase}" data-l="${l}" ${off ? "disabled" : ""}>${l}</button>`;
  }).join("");
}

function renderComodines() {
  const p = juego.palabra;
  $("comodines").innerHTML = Object.entries(COMODINES).map(([k, c]) => {
    const n = juego.comodines[k];
    const off = n <= 0 || p.cerrada
      || (k === "pista" && p.pista)
      || (k === "vida" && juego.corazones >= MAX_CORAZONES);
    const titulo = k === "pista" ? `title="Cuesta ${p.nivel.costePista} puntos"` : "";
    return `<button class="comodin" data-c="${k}" ${titulo} ${off ? "disabled" : ""}>${c.icono} ${c.nombre} <b>${n}</b></button>`;
  }).join("");
}

// ---------- Dibujo del ahorcado (con animación por parte) ----------

let dibujado = 0;   // partes completas en pantalla
let parcial = null; // { desde, hasta, t } partes en animación
let rafDibujo = 0;

function colorDibujo() {
  return getComputedStyle(document.documentElement).getPropertyValue("--texto").trim() || "#eef0ff";
}

function trazarParte(c, segmentos, t) {
  if (t <= 0) return;
  c.beginPath();
  for (const s of segmentos) {
    if (s.arco) {
      const [cx, cy, r] = s.arco;
      c.moveTo(cx + r, cy);
      c.arc(cx, cy, r, 0, Math.PI * 2 * t);
    } else {
      const [x1, y1, x2, y2] = s;
      c.moveTo(x1, y1);
      c.lineTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }
  c.stroke();
}

function pintar() {
  const canvas = $("canvas");
  const c = canvas.getContext("2d");
  const color = colorDibujo();
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 5;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.shadowColor = color;
  c.shadowBlur = 8;

  for (let i = 0; i < dibujado; i++) trazarParte(c, PARTES[i], 1);
  if (parcial) {
    for (let i = parcial.desde; i < parcial.hasta; i++) trazarParte(c, PARTES[i], parcial.t);
  }

  // Cara de "X" cuando el muñeco está completo.
  if (dibujado >= PARTES.length && !parcial) {
    c.beginPath();
    c.moveTo(152, 80); c.lineTo(162, 90); c.moveTo(162, 80); c.lineTo(152, 90);
    c.moveTo(178, 80); c.lineTo(188, 90); c.moveTo(188, 80); c.lineTo(178, 90);
    c.stroke();
  }
}

function dibujar() {
  const p = juego.palabra;
  const total = PARTES.length;
  const objetivo = p.perdida
    ? total
    : (p.errores === 0 ? 0 : Math.min(total, Math.ceil((p.errores * total) / p.intentosMax)));

  if (objetivo < dibujado) {
    // Nueva palabra: se borra el muñeco.
    cancelAnimationFrame(rafDibujo);
    dibujado = objetivo;
    parcial = null;
  }

  if (objetivo > dibujado) {
    const desde = dibujado;
    const inicio = performance.now();
    cancelAnimationFrame(rafDibujo);
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / 350);
      parcial = { desde, hasta: objetivo, t };
      pintar();
      if (t < 1) {
        rafDibujo = requestAnimationFrame(paso);
      } else {
        dibujado = objetivo;
        parcial = null;
        pintar();
      }
    };
    rafDibujo = requestAnimationFrame(paso);
    return;
  }

  parcial = null;
  pintar();
}

// ---------- Modal ----------

function abrirModal({ titulo, texto = "", extra = "", boton, onBoton }) {
  $("modal-titulo").textContent = titulo;
  $("modal-texto").innerHTML = texto;
  $("modal-extra").innerHTML = extra;
  const b = $("modal-btn");
  b.textContent = boton;
  b.onclick = () => {
    cerrarModal();
    if (onBoton) onBoton();
  };
  $("modal").classList.remove("oculto");
  b.focus();
}

function cerrarModal() {
  $("modal").classList.add("oculto");
}

// ---------- Pantallas ----------

function mostrar(id) {
  document.querySelectorAll(".pantalla").forEach((s) => s.classList.toggle("activa", s.id === id));
  if (id === "menu") actualizarMenu();
  if (id === "ranking") renderProgreso();
}

function actualizarMenu() {
  const n = estado.repaso.length;
  $("n-repaso").textContent = n;
  $("btn-repaso").disabled = n === 0;
  $("btn-efectos").textContent = `Efectos: ${Sonido.efectos ? "on" : "off"}`;
  $("btn-musica").textContent = `Música: ${Sonido.musica ? "on" : "off"}`;
}

function renderProgreso() {
  const lista = leer(CLAVES.puntajes, []);
  $("tab-puntajes").innerHTML = `
    <p class="small">Victorias totales: ${estado.stats.victorias} · Mejor racha: ${estado.stats.mejorRacha}</p>
    ${lista.length
      ? `<table>
          <thead><tr><th>#</th><th>Nombre</th><th>Puntos</th><th>Racha</th><th>Tema</th></tr></thead>
          <tbody>${lista.map((r, i) => `<tr><td>${i + 1}</td><td>${r.nombre}</td><td>${r.puntos}</td><td>${r.racha}</td><td>${r.modo}</td></tr>`).join("")}</tbody>
        </table>`
      : "<p>Todavía no hay puntajes. ¡Jugá una partida!</p>"}`;

  const entradas = Object.values(estado.diccionario).sort((a, b) => a.p.localeCompare(b.p, "es"));
  $("tab-diccionario").innerHTML = entradas.length
    ? `<p class="small">${entradas.length} palabras aprendidas</p>` +
      entradas.map((w) => `<details><summary>${w.p.toUpperCase()} <span class="chip">${w.cat}</span></summary><p>${w.d}</p></details>`).join("")
    : "<p>Acertá palabras para llenar tu diccionario.</p>";

  $("tab-logros").innerHTML = LOGROS.map((l) => {
    const ok = !!estado.logros[l.id];
    return `<div class="logro ${ok ? "desbloqueado" : ""}">${ok ? "🏆" : "🔒"} ${l.texto}</div>`;
  }).join("");
}

// ---------- Inicio ----------

function crearFondo() {
  const simbolos = ["{ }", "=>", "</>", "( )", "[ ]", ";", "01", "&&", "#", "λ", "∑", "π", "√", "∫", "A"];
  const fondo = $("fondo");
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("span");
    s.textContent = simbolos[i % simbolos.length];
    s.style.left = Math.random() * 100 + "%";
    s.style.fontSize = 14 + Math.random() * 28 + "px";
    s.style.animationDuration = 12 + Math.random() * 16 + "s";
    s.style.animationDelay = -Math.random() * 20 + "s";
    fondo.appendChild(s);
  }
}

function init() {
  const sel = $("categoria");
  sel.innerHTML = `<option value="mezcla">Mezcla de todos los temas</option>` +
    Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}">${c.nombre}</option>`).join("");

  crearFondo();

  // El audio necesita un gesto del usuario para empezar.
  document.addEventListener("pointerdown", () => Sonido.iniciar(), { once: true });
  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn")) Sonido.sfx("click");
  });

  $("btn-jugar").onclick = () => iniciarPartida(sel.value);
  $("btn-repaso").onclick = () => iniciarPartida("repaso");
  $("btn-ranking").onclick = () => mostrar("ranking");
  $("btn-volver-ranking").onclick = () => mostrar("menu");
  $("btn-efectos").onclick = () => {
    Sonido.alternarEfectos();
    actualizarMenu();
  };
  $("btn-musica").onclick = () => {
    Sonido.alternarMusica();
    actualizarMenu();
  };
  $("btn-salir").onclick = () => {
    if (confirm("¿Salir ahora? La partida actual se pierde.")) mostrar("menu");
  };

  $("teclado").onclick = (e) => {
    const b = e.target.closest("button[data-l]");
    if (b) adivinar(b.dataset.l);
  };
  $("comodines").onclick = (e) => {
    const b = e.target.closest("button[data-c]");
    if (b) usarComodin(b.dataset.c);
  };

  document.querySelectorAll(".tab").forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activa", x === t));
      document.querySelectorAll(".tabpanel").forEach((x) => x.classList.toggle("activo", x.id === "tab-" + t.dataset.tab));
    };
  });

  // Teclado físico: solo con la partida en pantalla y sin modal abierto.
  document.addEventListener("keydown", (e) => {
    if (!$("juego").classList.contains("activa")) return;
    if (!$("modal").classList.contains("oculto")) return;
    if (e.key.length !== 1) return;
    const l = normalizar(e.key);
    if (/^[A-Z]$/.test(l)) adivinar(l);
  });

  actualizarMenu();
  mostrar("menu");
}

init();
