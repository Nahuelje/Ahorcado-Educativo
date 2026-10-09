// Motor de sonido: efectos y música generados con Web Audio API (sin archivos externos).
const Sonido = (() => {
  const CLAVE = "ahorcado.audio";
  let cfg = { efectos: true, musica: true };
  try {
    cfg = { ...cfg, ...JSON.parse(localStorage.getItem(CLAVE) || "{}") };
  } catch {
    // Configuración inválida: se usan los valores por defecto.
  }

  let ctx = null;
  let busEfectos = null;
  let busMusica = null;
  let ruido = null;
  let temporizador = null;
  let proximo = 0;
  let compas = 0;

  function guardarCfg() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(cfg));
    } catch {
      // Sin almacenamiento: la preferencia dura solo esta sesión.
    }
  }

  // Crea el contexto de audio la primera vez (requiere un gesto del usuario).
  function asegurar() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    busEfectos = ctx.createGain();
    busEfectos.gain.value = 0.7;
    busEfectos.connect(ctx.destination);
    busMusica = ctx.createGain();
    busMusica.gain.value = 0.06;
    busMusica.connect(ctx.destination);
    // Buffer de ruido reutilizable para los "clics" percusivos.
    ruido = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const datos = ruido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    return true;
  }

  const T = (s = 0) => ctx.currentTime + s;

  function tono({ f, f2, at, dur = 0.2, tipo = "triangle", vol = 0.2, bus }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(bus || busEfectos);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  function golpe({ at, dur = 0.05, f = 2000, vol = 0.3 }) {
    const s = ctx.createBufferSource();
    s.buffer = ruido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = f;
    filtro.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(filtro).connect(g).connect(busEfectos);
    s.start(at, Math.random() * 0.3, dur + 0.02);
  }

  const SONIDOS = {
    tecla: () => golpe({ at: T(), f: 1800, dur: 0.04, vol: 0.25 }),
    click: () => golpe({ at: T(), f: 3200, dur: 0.02, vol: 0.12 }),
    acierto: (n = 1) => {
      const k = Math.min(n, 5);
      tono({ f: 600 + 90 * k, f2: 820 + 90 * k, at: T(), dur: 0.16, tipo: "triangle", vol: 0.28 });
    },
    error: () => {
      tono({ f: 300, f2: 90, at: T(), dur: 0.35, tipo: "sawtooth", vol: 0.12 });
      golpe({ at: T(), f: 400, dur: 0.15, vol: 0.2 });
    },
    corazon: () => {
      tono({ f: 80, f2: 45, at: T(), dur: 0.2, tipo: "sine", vol: 0.5 });
      tono({ f: 80, f2: 45, at: T(0.25), dur: 0.2, tipo: "sine", vol: 0.5 });
    },
    comodin: () => [880, 1174.66, 1567.98].forEach((f, i) => tono({ f, at: T(i * 0.06), dur: 0.5, tipo: "sine", vol: 0.2 })),
    pista: () => tono({ f: 600, f2: 1200, at: T(), dur: 0.25, tipo: "sine", vol: 0.2 }),
    racha: () => {
      tono({ f: 300, f2: 1400, at: T(), dur: 0.45, tipo: "square", vol: 0.06 });
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tono({ f, at: T(0.3 + i * 0.08), dur: 0.35, vol: 0.25 }));
    },
    victoria: () => {
      [523.25, 659.25, 783.99].forEach((f, i) => tono({ f, at: T(i * 0.1), dur: 0.4, vol: 0.25 }));
      tono({ f: 1046.5, at: T(0.35), dur: 0.9, tipo: "sine", vol: 0.25 });
      golpe({ at: T(0.3), f: 6000, dur: 0.1, vol: 0.15 });
    },
    perder: () => [392, 329.63, 261.63, 196].forEach((f, i) => tono({ f, at: T(i * 0.22), dur: 0.4, tipo: "sawtooth", vol: 0.12 })),
  };

  // Música: loop de acordes (Am, F, C, G) con pad y arpegio, programado con antelación.
  const ACORDES = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
    [196, 246.94, 293.66],
  ];

  function programar() {
    if (proximo < ctx.currentTime) proximo = ctx.currentTime + 0.1;
    while (proximo < ctx.currentTime + 0.4) {
      const acorde = ACORDES[compas % ACORDES.length];
      acorde.forEach((f) => tono({ f: f / 2, at: proximo, dur: 2.1, tipo: "sine", vol: 0.5, bus: busMusica }));
      for (let i = 0; i < 8; i++) {
        tono({ f: acorde[i % 3] * 2, at: proximo + i * 0.25, dur: 0.22, tipo: "triangle", vol: 0.35, bus: busMusica });
      }
      proximo += 2;
      compas++;
    }
  }

  function iniciarMusica() {
    if (!asegurar() || temporizador) return;
    proximo = 0;
    programar();
    temporizador = setInterval(programar, 300);
  }

  function detenerMusica() {
    clearInterval(temporizador);
    temporizador = null;
  }

  return {
    sfx(nombre, arg) {
      if (cfg.efectos && asegurar()) SONIDOS[nombre]?.(arg);
    },
    iniciar() {
      asegurar();
      if (cfg.musica) iniciarMusica();
    },
    alternarEfectos() {
      cfg.efectos = !cfg.efectos;
      guardarCfg();
      return cfg.efectos;
    },
    alternarMusica() {
      cfg.musica = !cfg.musica;
      guardarCfg();
      if (cfg.musica) iniciarMusica();
      else detenerMusica();
      return cfg.musica;
    },
    get efectos() { return cfg.efectos; },
    get musica() { return cfg.musica; },
    vibrar(patron) {
      try {
        navigator.vibrate?.(patron);
      } catch {
        // Vibración no disponible en este dispositivo.
      }
    },
  };
})();
