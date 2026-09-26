/* =========================================================
   ORIGO DRAW — APP.JS
   Create. Draw. Imagine.
========================================================= */

"use strict";


/* =========================================================
   HELPERS
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [
  ...document.querySelectorAll(selector)
];

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const uid = () =>
  Math.random().toString(36).slice(2) +
  Date.now().toString(36);

const canvas = $("#canvas");
const guideCanvas = $("#guideCanvas");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const guideCtx = guideCanvas.getContext("2d");


/* =========================================================
   STATE
========================================================= */

const state = {

  tool: "pencil",

  drawing: false,

  startX: 0,
  startY: 0,

  lastX: 0,
  lastY: 0,

  color: "#ffffff",

  size: 8,

  opacity: 1,

  hardness: 0.8,

  flow: 1,

  smoothing: 0.5,

  zoom: 1,

  rotation: 0,

  panMode: false,

  panX: 0,

  panY: 0,

  canvasWidth: 1200,

  canvasHeight: 800,

  layers: [],

  activeLayer: null,

  history: [],

  historyIndex: -1,

  maxHistory: 35,

  perspective: {

    visible: false,

    type: "1"

  },

  symmetry: {

    vertical: false,

    horizontal: false,

    radial: false

  },

  shadowIntensity: 0.5,

  shadowSoftness: 0.5,

  background: "white",

  backgroundColor: "#ffffff",

  importedImage: null,

  pointerId: null,

  shapeStart: null,

  tempCanvas: null,

  tempCtx: null,

  galleryDB: null

};


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2200);
}


/* =========================================================
   CANVAS
========================================================= */

function setupCanvasSize(width, height) {

  width = clamp(
    Math.round(Number(width) || 1200),
    100,
    10000
  );

  height = clamp(
    Math.round(Number(height) || 800),
    100,
    10000
  );

  state.canvasWidth = width;
  state.canvasHeight = height;

  canvas.width = width;
  canvas.height = height;

  guideCanvas.width = width;
  guideCanvas.height = height;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  guideCanvas.style.width = `${width}px`;
  guideCanvas.style.height = `${height}px`;

  $("#canvasSizeLabel").textContent =
    `${width} × ${height}`;

  applyBackground();

  fitCanvas();

  renderLayers();
  drawGuides();
}


function applyBackground() {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (state.background === "transparent") {
    return;
  }

  ctx.save();

  ctx.fillStyle =
    state.background === "color"
      ? state.backgroundColor
      : "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.restore();
}


/* =========================================================
   LAYERS
========================================================= */

function createLayer(
  name = `Layer ${state.layers.length + 1}`
) {

  const layerCanvas =
    document.createElement("canvas");

  layerCanvas.width = state.canvasWidth;
  layerCanvas.height = state.canvasHeight;

  const layerCtx =
    layerCanvas.getContext("2d", {
      willReadFrequently: true
    });

  return {

    id: uid(),

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

  const backgroundLayer =
    createLayer("Background");

  const drawingLayer =
    createLayer("Layer 1");

  state.layers.push(
    backgroundLayer,
    drawingLayer
  );

  state.activeLayer =
    drawingLayer.id;

  drawBackgroundToLayer(
    backgroundLayer
  );

  renderLayers();
  updateLayersUI();
}


function drawBackgroundToLayer(layer) {

  const context = layer.ctx;

  context.clearRect(
    0,
    0,
    layer.canvas.width,
    layer.canvas.height
  );

  if (state.background === "transparent") {
    return;
  }

  context.save();

  context.fillStyle =
    state.background === "color"
      ? state.backgroundColor
      : "#ffffff";

  context.fillRect(
    0,
    0,
    layer.canvas.width,
    layer.canvas.height
  );

  context.restore();
}


function getActiveLayer() {

  return state.layers.find(
    layer =>
      layer.id === state.activeLayer
  );
}


function renderLayers() {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (const layer of state.layers) {

    if (!layer.visible) continue;

    ctx.save();

    ctx.globalAlpha =
      clamp(layer.opacity, 0, 1);

    ctx.drawImage(
      layer.canvas,
      0,
      0
    );

    ctx.restore();
  }

  drawGuides();
  updateLayerThumbnails();
}


function updateLayersUI() {

  const container = $("#layers");

  if (!container) return;

  container.innerHTML = "";

  [...state.layers]
    .reverse()
    .
