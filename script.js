/*
  Timer Ball – HTML, CSS e JS puros
  - Gera uma grade de "bolinhas" baseada no tempo total e no intervalo
  - Colore as bolinhas de verde → amarelo (atual) → vermelho (concluída)
  - Exibe hora atual e tempo restante
  - Controles: Start, Pausar/Continuar, Reset
*/

/** Utilidades **/
function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDuration(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** Estado Global **/
const state = {
  totalSeconds: 300,
  intervalSeconds: 60,
  numberOfDots: 5,
  isRunning: false,
  startedAtEpoch: null,
  pausedElapsedSeconds: 0,
  tickIntervalId: null,
  lastFinishedIntervals: -1,
};

/** Elementos **/
const currentTimeEl = document.getElementById("currentTime");
const timeLeftEl = document.getElementById("timeLeft");
const dotsGridEl = document.getElementById("dotsGrid");
const gridSummaryEl = document.getElementById("gridSummary");
const messageEl = document.getElementById("message");

const totalPresetEl = document.getElementById("totalPreset");
const customTotalGroupEl = document.getElementById("customTotalGroup");
const customTotalValueEl = document.getElementById("customTotalValue");
const customTotalUnitEl = document.getElementById("customTotalUnit");
const intervalValueEl = document.getElementById("intervalValue");
const intervalUnitEl = document.getElementById("intervalUnit");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

/** Inicialização **/
document.addEventListener("DOMContentLoaded", () => {
  // Hora atual atualiza sempre
  setInterval(() => {
    const d = new Date();
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    currentTimeEl.textContent = `${hh}:${mm}:${ss}`;
  }, 1000);

  // Mostrar/esconder total customizado
  totalPresetEl.addEventListener("change", () => {
    const isCustom = totalPresetEl.value === "custom";
    customTotalGroupEl.classList.toggle("hidden", !isCustom);
    customTotalGroupEl.setAttribute("aria-hidden", String(!isCustom));
    if (!isCustom) {
      // Ajusta intervalos sugeridos para minutos quando curto
      if (Number(totalPresetEl.value) <= 900) {
        intervalValueEl.value = 60;
        intervalUnitEl.value = "seconds";
      }
    }
    updateSummaryPreview();
  });

  [customTotalValueEl, customTotalUnitEl, intervalValueEl, intervalUnitEl].forEach((el) => {
    el.addEventListener("input", updateSummaryPreview);
    el.addEventListener("change", updateSummaryPreview);
  });

  startBtn.addEventListener("click", () => {
    configureFromInputs();
    if (!validateConfig()) return;
    buildDotsGrid();
    startTimer();
  });

  pauseBtn.addEventListener("click", togglePause);
  resetBtn.addEventListener("click", resetTimer);

  // Estado inicial e prévia
  updateSummaryPreview();
});

/** Lógica de entrada/configuração **/
function getTotalSecondsFromInputs() {
  if (totalPresetEl.value !== "custom") {
    return Number(totalPresetEl.value);
  }
  const qty = Math.max(1, Number(customTotalValueEl.value || 0));
  return customTotalUnitEl.value === "hours" ? qty * 3600 : qty * 60;
}

function getIntervalSecondsFromInputs() {
  const qty = Math.max(1, Number(intervalValueEl.value || 0));
  return intervalUnitEl.value === "minutes" ? qty * 60 : qty;
}

function configureFromInputs() {
  state.totalSeconds = getTotalSecondsFromInputs();
  state.intervalSeconds = getIntervalSecondsFromInputs();
  state.numberOfDots = Math.ceil(state.totalSeconds / state.intervalSeconds);
  state.lastFinishedIntervals = -1;
}

function validateConfig() {
  messageEl.textContent = "";
  if (state.totalSeconds <= 0) {
    messageEl.textContent = "Informe um tempo total válido.";
    return false;
  }
  if (state.intervalSeconds <= 0) {
    messageEl.textContent = "Informe um intervalo válido.";
    return false;
  }
  if (state.intervalSeconds > state.totalSeconds) {
    messageEl.textContent = "O intervalo não pode ser maior que o tempo total.";
    return false;
  }
  const maxDots = 300;
  if (Math.ceil(state.totalSeconds / state.intervalSeconds) > maxDots) {
    messageEl.textContent = `Muitos intervalos (>${maxDots}). Aumente o tamanho do intervalo.`;
    return false;
  }
  return true;
}

function updateSummaryPreview() {
  const total = getTotalSecondsFromInputs();
  const step = getIntervalSecondsFromInputs();
  const dots = Math.ceil(total / step);
  gridSummaryEl.textContent = `${dots} bolinhas de ${formatDuration(step)} para ${formatDuration(total)}`;
}

/** Construção da grade **/
function buildDotsGrid() {
  dotsGridEl.innerHTML = "";
  const totalDots = state.numberOfDots;

  // Ajusta número de colunas conforme a largura
  const containerWidth = dotsGridEl.clientWidth || dotsGridEl.offsetWidth || 800;
  const approxCols = Math.max(8, Math.min(16, Math.floor(containerWidth / (52 + 18))));
  dotsGridEl.style.setProperty("--cols", String(approxCols));

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < totalDots; index += 1) {
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.setAttribute("role", "listitem");
    dot.dataset.index = String(index);
    dot.title = `Intervalo ${index + 1}/${totalDots}`;
    fragment.appendChild(dot);
  }
  dotsGridEl.appendChild(fragment);
}

/** Timer **/
function startTimer() {
  if (state.isRunning) return;
  state.isRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resetBtn.disabled = false;

  // Começa agora (respeitando pausa anterior)
  const alreadyElapsed = state.pausedElapsedSeconds;
  state.startedAtEpoch = nowSeconds() - alreadyElapsed;

  // Tique frequente para atualizar restante/dots
  if (state.tickIntervalId) clearInterval(state.tickIntervalId);
  state.tickIntervalId = setInterval(updateTick, 250);
}

function updateTick() {
  const elapsed = Math.max(0, nowSeconds() - state.startedAtEpoch);
  const remaining = Math.max(0, state.totalSeconds - elapsed);
  timeLeftEl.textContent = formatDuration(remaining);

  // Quantos intervalos terminaram
  const finishedIntervals = Math.floor(elapsed / state.intervalSeconds);
  if (finishedIntervals !== state.lastFinishedIntervals) {
    applyDotsProgress(finishedIntervals);
    state.lastFinishedIntervals = finishedIntervals;
  }

  // Dot atual (em progresso)
  const activeIndex = Math.min(state.numberOfDots - 1, finishedIntervals);
  markActiveDot(activeIndex);

  if (remaining <= 0) {
    finalizeTimer();
  }
}

function applyDotsProgress(finishedIntervals) {
  const dots = dotsGridEl.children;
  for (let i = 0; i < dots.length; i += 1) {
    const dot = dots[i];
    if (i < finishedIntervals) {
      dot.setAttribute("data-state", "done");
      dot.removeAttribute("aria-current");
    } else {
      dot.removeAttribute("data-state");
    }
  }
}

function markActiveDot(activeIndex) {
  const dots = dotsGridEl.children;
  for (let i = 0; i < dots.length; i += 1) {
    const dot = dots[i];
    if (i === activeIndex && !dot.dataset.state) {
      dot.setAttribute("aria-current", "true");
    } else {
      dot.removeAttribute("aria-current");
    }
  }
}

function togglePause() {
  // Permite tanto pausar quanto retomar (sem sair cedo quando pausado)
  if (state.tickIntervalId) {
    clearInterval(state.tickIntervalId);
    state.tickIntervalId = null;
  }

  // Se estava rodando, pausa. Se estava pausado, continua.
  const elapsedNow = Math.max(0, nowSeconds() - state.startedAtEpoch);
  const isPausing = pauseBtn.textContent === "Pausar";
  if (isPausing) {
    state.pausedElapsedSeconds = Math.min(state.totalSeconds, elapsedNow);
    state.isRunning = false;
    pauseBtn.textContent = "Continuar";
  } else {
    // Só continua se já foi iniciado ao menos uma vez
    if (state.startedAtEpoch == null) return;
    state.isRunning = true;
    state.startedAtEpoch = nowSeconds() - state.pausedElapsedSeconds;
    state.tickIntervalId = setInterval(updateTick, 250);
    pauseBtn.textContent = "Pausar";
  }
}

function resetTimer() {
  if (state.tickIntervalId) {
    clearInterval(state.tickIntervalId);
    state.tickIntervalId = null;
  }

  state.isRunning = false;
  state.startedAtEpoch = null;
  state.pausedElapsedSeconds = 0;
  state.lastFinishedIntervals = -1;

  timeLeftEl.textContent = formatDuration(state.totalSeconds);
  const dots = dotsGridEl.children;
  for (let i = 0; i < dots.length; i += 1) {
    const dot = dots[i];
    dot.removeAttribute("data-state");
    dot.removeAttribute("aria-current");
  }

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "Pausar";
  resetBtn.disabled = true;
}

function finalizeTimer() {
  if (state.tickIntervalId) {
    clearInterval(state.tickIntervalId);
    state.tickIntervalId = null;
  }
  timeLeftEl.textContent = "Concluído";
  applyDotsProgress(state.numberOfDots);
  pauseBtn.disabled = true;
  startBtn.disabled = false;
  state.isRunning = false;
}


