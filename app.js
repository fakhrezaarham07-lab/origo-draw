/* =========================================================
   ORIGO DRAW — APP.JS
   Free Digital Drawing Workspace
   ========================================================= */

"use strict";

/* =========================
   HELPERS
========================= */

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

const canvas = $("canvas");
const guideCanvas = $("guideCanvas");

const ctx = canvas ? canvas.getContext("2d", {
  willReadFrequently: true
}) : null;

const guideCtx = guideCanvas ? guideCanvas.getContext("2d") : null;

const MAX_PIXELS = 3000000;

let uidCounter = 0;

function uid(prefix = "id") {
  uidCounter++;
  return `${prefix}-${Date.now()}-${uidCounter}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

/* =========================
   APPLICATION STATE
========================= */

const state = {
  width: 1200,
  height: 800,

  zoom: 1,
  rotation: 0,

  tool: "pencil",

  color: "#111111",
  secondaryColor: "#ffffff",

  size: 8,
  opacity: 1,
  hardness: 0.8,
  flow: 1,
  smoothing: 0.5,

  shadowIntensity: 0.5,
  shadowSoftness: 0.5,

  perspective: false,
  perspectiveType: "1",

  verticalSymmetry: false,
  horizontalSymmetry: false,
  radialSymmetry: false,

  isDrawing: false,

  startX: 0,
  startY: 0,

  lastX: 0,
  lastY: 0,

  tempCanvas: null,

  background: "white",
  backgroundColor: "#ffffff",

  activeLayerId: null,

  layers: [],

  history: [],
  historyIndex: -1,

  gallery: [],

  language: "en",

  theme: "dark"
};

/* =========================
   CANVAS / LAYERS
========================= */

function createLayer(name = "Layer 1") {
  const layerCanvas = document.createElement("canvas");

  layerCanvas.width = state.width;
  layerCanvas.height = state.height;

  const layerCtx = layerCanvas.getContext("2d", {
    willReadFrequently: true
  });

  return {
    id: uid("layer"),
    name,
    canvas: layerCanvas,
    ctx: layerCtx,
    visible: true,
    locked: false,
    opacity: 1
  };
}

function initializeLayers() {
  state.layers = [];

  const layer = createLayer("Layer 1");

  state.layers.push(layer);
  state.activeLayerId = layer.id;

  applyBackground();
  renderLayers();
  renderLayerList();
}

function getActiveLayer() {
  return state.layers.find(
    layer => layer.id === state.activeLayerId
  );
}

function getLayerById(id) {
  return state.layers.find(layer => layer.id === id);
}

function renderLayers() {
  if (!canvas || !ctx) return;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (const layer of state.layers) {
    if (!layer.visible) continue;

    ctx.globalAlpha = layer.opacity;

    ctx.drawImage(
      layer.canvas,
      0,
      0
    );
  }

  ctx.globalAlpha = 1;

  drawGuides();
}

function composite() {
  const output = document.createElement("canvas");

  output.width = state.width;
  output.height = state.height;

  const outputCtx = output.getContext("2d");

  for (const layer of state.layers) {
    if (!layer.visible) continue;

    outputCtx.globalAlpha = layer.opacity;

    outputCtx.drawImage(
      layer.canvas,
      0,
      0
    );
  }

  outputCtx.globalAlpha = 1;

  return output;
}

/* =========================
   BACKGROUND
========================= */

function applyBackground() {
  const layer = getActiveLayer();

  if (!layer) return;

  const c = layer.ctx;

  c.clearRect(
    0,
    0,
    state.width,
    state.height
  );

  if (state.background === "transparent") {
    return;
  }

  if (state.background === "custom") {
    c.fillStyle = state.backgroundColor;
  } else {
    c.fillStyle = "#ffffff";
  }

  c.fillRect(
    0,
    0,
    state.width,
    state.height
  );
}

/* =========================
   HISTORY
========================= */

function captureState() {
  const snapshot = state.layers.map(layer => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    image: layer.canvas.toDataURL("image/png")
  }));

  return {
    width: state.width,
    height: state.height,
    layers: snapshot,
    activeLayerId: state.activeLayerId
  };
}

function saveHistory() {
  const snapshot = captureState();

  if (state.historyIndex < state.history.length - 1) {
    state.history =
      state.history.slice(
        0,
        state.historyIndex + 1
      );
  }

  state.history.push(snapshot);

  if (state.history.length > 30) {
    state.history.shift();
  }

  state.historyIndex =
    state.history.length - 1;
}

async function restoreSnapshot(snapshot) {
  if (!snapshot) return;

  state.width = snapshot.width;
  state.height = snapshot.height;

  setupCanvasSize();

  state.layers = [];

  for (const savedLayer of snapshot.layers) {
    const layer = createLayer(
      savedLayer.name
    );

    layer.id = savedLayer.id;
    layer.visible = savedLayer.visible;
    layer.locked = savedLayer.locked;
    layer.opacity = savedLayer.opacity;

    await loadImageInto
