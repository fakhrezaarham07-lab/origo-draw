"use strict";

/* =========================================================
   ORIGO DRAW - LIGHTWEIGHT DRAWING ENGINE
   Optimized for mobile / 3GB RAM devices
   ========================================================= */

const canvas = document.getElementById("drawingCanvas");
const ctx = canvas?.getContext("2d", {
  alpha: true,
  desynchronized: true
});

const canvasArea = document.getElementById("canvasArea");
const canvasWrapper = document.getElementById("canvasWrapper");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");

const state = {
  tool: "brush",
  color: "#111111",

  size: 8,
  opacity: 1,
  hardness: 100,
  flow: 100,
  smoothing: 50,

  zoom: 1,
  offsetX: 0,
  offsetY: 0,

  isDrawing: false,
  lastX: 0,
  lastY: 0,
  currentStroke: [],

  background: "white",
  documentName: "Untitled Artwork",

  grid: false,
  symmetry: false,
  perspective: false,
  ruler: false,

  layers: [],
  activeLayer: 0,

  undoStack: [],
  redoStack: [],

  maxHistory: 12,

  db: null
};


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function isLowMemoryDevice() {
  return navigator.deviceMemory
    ? navigator.deviceMemory <= 4
    : window.innerWidth < 600;
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*]+/g, "-")
    .trim()
    .slice(0, 80) || "origo-draw";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/* =========================================================
   LAYERS
   ========================================================= */

function createLayer(name) {
  return {
    id: Date.now() + Math.random(),
    name: name || "Layer",
    visible: true,
    opacity: 1,
    strokes: []
  };
}

function createDefaultLayers() {
  state.layers = [
    createLayer("Background"),
    createLayer("Layer 1")
  ];

  state.activeLayer = 1;
}


/* =========================================================
   CANVAS
   ========================================================= */

function setupCanvas(width, height, background = "white") {

  const maxPixels = isLowMemoryDevice()
    ? 3000000
    : 6000000;

  width = Math.max(64, Math.floor(width));
  height = Math.max(64, Math.floor(height));

  const pixels = width * height;

  if (pixels > maxPixels) {

    const ratio =
      Math.sqrt(maxPixels / pixels);

    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);

    showToast(
      `Canvas disesuaikan: ${width} × ${height}`
    );
  }

  canvas.width = width;
  canvas.height = height;

  canvasWrapper.style.width = `${width}px`;
  canvasWrapper.style.height = `${height}px`;

  state.background = background;

  state.undoStack = [];
  state.redoStack = [];

  createDefaultLayers();

  drawBackground();

  fitCanvas();

  renderLayers();
}

function drawBackground() {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (state.background === "transparent") {
    return;
  }

  ctx.fillStyle =
    state.background === "black"
      ? "#000000"
      : "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
}


/* =========================================================
   REDRAW
   ========================================================= */

function redraw() {

  drawBackground();

  for (const layer of state.layers) {

    if (!layer.visible) continue;

    ctx.save();

    ctx.globalAlpha = layer.opacity;

    for (const stroke of layer.strokes) {

      drawStroke(stroke);

    }

    ctx.restore();
  }
}


/* =========================================================
   STROKE RENDERER
   ========================================================= */

function drawStroke(stroke) {

  if (!stroke) return;

  if (stroke.tool === "fill") {

    ctx.save();

    ctx.globalAlpha =
      stroke.opacity ?? 1;

    ctx.fillStyle =
      stroke.color || "#000000";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.restore();

    return;
  }

  if (stroke.tool === "text") {

    ctx.save();

    ctx.globalAlpha =
      stroke.opacity ?? 1;

    ctx.fillStyle =
      stroke.color || "#000000";

    ctx.font =
      `${stroke.size || 24}px sans-serif`;

    ctx.textBaseline = "top";

    const p =
      stroke.points?.[0];

    if (p) {
      ctx.fillText(
        stroke.text || "",
        p.x,
        p.y
      );
    }

    ctx.restore();

    return;
  }

  const points = stroke.points;

  if (!points || !points.length) {
    return;
  }

  ctx.save();

  if (stroke.tool === "eraser") {

    ctx.globalCompositeOperation =
      "destination-out";

  } else {

    ctx.globalCompositeOperation =
      "source-over";
  }

  ctx.globalAlpha =
    stroke.opacity ?? 1;

  ctx.strokeStyle =
    stroke.color || "#111111";

  let width =
    stroke.size || 1;

  if (stroke.tool === "marker") {
    width *= 1.7;
    ctx.globalAlpha *= 0.35;
  }

  if (stroke.tool === "pencil") {
    ctx.globalAlpha *= 0.75;
  }

  if (stroke.tool === "pen") {
    width *= 0.8;
  }

  ctx.lineWidth = width;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  ctx.moveTo(
    points[0].x,
    points[0].y
  );

  for (let i = 1; i < points.length; i++) {

    ctx.lineTo(
      points[i].x,
      points[i].y
    );
  }

  ctx.stroke();

  ctx.restore();
}


/* =========================================================
   POINTER POSITION
   ========================================================= */

function getCanvasPoint(event) {

  const rect =
    canvas.getBoundingClientRect();

  return {
    x:
      (event.clientX - rect.left) *
      (canvas.width / rect.width),

    y:
      (event.clientY - rect.top) *
      (canvas.height / rect.height)
  };
}


/* =========================================================
   DRAWING
   ========================================================= */

function pointerDown(event) {

  if (
    state.tool === "move" ||
    state.tool === "text"
  ) {
    return;
  }

  event.preventDefault();

  canvas.setPointerCapture?.(
    event.pointerId
  );

  const point =
    getCanvasPoint(event);

  state.isDrawing = true;

  state.lastX = point.x;
  state.lastY = point.y;

  state.currentStroke = [point];

  if (state.tool === "fill") {

    fillCanvas();

    state.isDrawing = false;

  }
}


function pointerMove(event) {

  if (!state.isDrawing) {
    return;
  }

  event.preventDefault();

  const point =
    getCanvasPoint(event);

  const dx =
    point.x - state.lastX;

  const dy =
    point.y - state.lastY;

  const distance =
    Math.abs(dx) + Math.abs(dy);

  if (
    distance <
    Math.max(0.5, state.size * 0.05)
  ) {
    return;
  }

  state.currentStroke.push(point);

  drawLiveSegment(
    state.lastX,
    state.lastY,
    point.x,
    point.y
  );

  state.lastX = point.x;
  state.lastY = point.y;
}


function pointerUp(event) {

  if (!state.isDrawing) {
    return;
  }

  event.preventDefault();

  state.isDrawing = false;

  if (
    state.currentStroke.length === 0
  ) {
    return;
  }

  const layer =
    state.layers[state.activeLayer];

  if (!layer) return;

  layer.strokes.push({
    tool: state.tool,
    color: state.color,
    size: state.size,
    opacity: state.opacity,
    flow: state.flow,
    points: state.currentStroke
  });

  saveHistory();

  state.currentStroke = [];
}


/* =========================================================
   LIVE DRAWING
   ========================================================= */

function drawLiveSegment(
  x1,
  y1,
  x2,
  y2
) {

  ctx.save();

  if (state.tool === "eraser") {

    ctx.globalCompositeOperation =
      "destination-out";

  } else {

    ctx.globalCompositeOperation =
      "source-over";
  }

  ctx.globalAlpha =
    state.opacity *
    (state.flow / 100);

  ctx.strokeStyle =
    state.color;

  let width = state.size;

  if (state.tool === "marker") {
    width *= 1.7;
    ctx.globalAlpha *= 0.35;
  }

  if (state.tool === "pencil") {
    ctx.globalAlpha *= 0.75;
  }

  if (state.tool === "pen") {
    width *= 0.8;
  }

  ctx.lineWidth = width;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  ctx.stroke();

  /* Symmetry */

  if (state.symmetry) {

    ctx.beginPath();

    ctx.moveTo(
      canvas.width - x1,
      y1
    );

    ctx.lineTo(
      canvas.width - x2,
      y2
    );

    ctx.stroke();
  }

  ctx.restore();
}


/* =========================================================
   TOOLS
   ========================================================= */

function setTool(tool) {

  state.tool = tool;

  document
    .querySelectorAll(
      ".tool-btn, .mobile-tool"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.tool === tool
      );

    });

  if (tool === "fill") {
    showToast("Klik canvas untuk mengisi");
  }

  if (tool === "picker") {
    showToast("Klik warna pada canvas");
  }

  if (tool === "text") {
    openModal(
      $("textModal")
    );
  }
}


/* =========================================================
   COLOR PICKER
   ========================================================= */

function pickCanvasColor(event) {

  if (state.tool !== "picker") {
    return;
  }

  const point =
    getCanvasPoint(event);

  const pixel =
    ctx.getImageData(
      Math.floor(point.x),
      Math.floor(point.y),
      1,
      1
    ).data;

  const hex =
    "#" +
    [pixel[0], pixel[1], pixel[2]]
      .map(value =>
        value.toString(16).padStart(2, "0")
      )
      .join("");

  setColor(hex);

  setTool("brush");

  showToast(
    `Warna ${hex}`
  );
}


/* =========================================================
   FILL
   ========================================================= */

function fillCanvas() {

  const layer =
    state.layers[state.activeLayer];

  if (!layer) return;

  layer.strokes.push({
    tool: "fill",
    color: state.color,
    opacity: state.opacity,
    points: []
  });

  ctx.save();

  ctx.globalAlpha =
    state.opacity;

  ctx.fillStyle =
    state.color;

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.restore();

  saveHistory();
}


/* =========================================================
   HISTORY
   ========================================================= */

function cloneLayers() {

  return state.layers.map(layer => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,

    strokes:
      layer.strokes.map(stroke => ({
        ...stroke,

        points:
          stroke.points
            ? stroke.points.map(p => ({
                x: p.x,
                y: p.y
              }))
            : []
      }))
  }));
}


function saveHistory() {

  state.undoStack.push(
    cloneLayers()
  );

  if (
    state.undoStack.length >
    state.maxHistory
  ) {
    state.undoStack.shift();
  }

  state.redoStack = [];
}


function restoreLayers(snapshot) {

  state.layers =
    snapshot.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      strokes: layer.strokes
    }));

  state.activeLayer =
    Math.min(
      state.activeLayer,
      state.layers.length - 1
    );

  redraw();
  renderLayers();
}


function undo() {

  if (!state.undoStack.length) {
    showToast("Tidak ada Undo");
    return;
  }

  state.redoStack.push(
    cloneLayers()
  );

  const snapshot =
    state.undoStack.pop();

  restoreLayers(snapshot);
}


function redo() {

  if (!state.redoStack.length) {
    showToast("Tidak ada Redo");
    return;
  }

  state.undoStack.push(
    cloneLayers()
  );

  const snapshot =
    state.redoStack.pop();

  restoreLayers(snapshot);
}


/* =========================================================
   LAYERS
