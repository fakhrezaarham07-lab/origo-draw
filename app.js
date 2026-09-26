/* =========================================================
   ORIGO DRAW — APP.JS
   Create. Draw. Imagine.
   Complete defensive version
========================================================= */

"use strict";

/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector, parent = document) => {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    return null;
  }
};

const $$ = (selector, parent = document) => {
  try {
    return [...parent.querySelectorAll(selector)];
  } catch (error) {
    return [];
  }
};

const byId = (id) => document.getElementById(id);

const on = (element, event, handler, options) => {
  if (!element) return;
  element.addEventListener(event, handler, options || false);
};

const onId = (id, event, handler, options) => {
  const element = byId(id);
  on(element, event, handler, options);
};

const setText = (id, value) => {
  const element = byId(id);
  if (element) element.textContent = value;
};

const setValue = (id, value) => {
  const element = byId(id);
  if (element) element.value = value;
};

const getValue = (id, fallback = "") => {
  const element = byId(id);
  return element ? element.value : fallback;
};

const show = (element) => {
  if (!element) return;
  element.classList.remove("hidden");
};

const hide = (element) => {
  if (!element) return;
  element.classList.add("hidden");
};

const toggleHidden = (element, visible) => {
  if (!element) return;
  element.classList.toggle("hidden", !visible);
};


/* =========================================================
   APP STATE
========================================================= */

const state = {
  started: false,

  tool: "brush",

  color: "#111111",
  background: "#ffffff",

  brushSize: 12,
  opacity: 1,
  hardness: 100,
  flow: 100,
  smoothing: 0,

  zoom: 1,
  rotation: 0,

  isDrawing: false,
  isPanning: false,

  lastX: 0,
  lastY: 0,

  panX: 0,
  panY: 0,

  startX: 0,
  startY: 0,

  currentShape: null,

  history: [],
  historyIndex: -1,

  layers: [],

  activeLayerId: null,

  guides: {
    perspective: false,
    perspectiveType: "1-point",
    ruler: false,
    grid: false,
    symmetry: false,
    symmetryType: "vertical"
  },

  shadow: {
    angle: 45,
    intensity: 50,
    softness: 50
  },

  canvas: {
    width: 1200,
    height: 800,
    background: "#ffffff"
  },

  importedImage: null,

  gallery: [],

  theme: "dark",

  language: "id",

  pointer: {
    id: null,
    type: "mouse"
  }
};


/* =========================================================
   CANVAS REFERENCES
========================================================= */

let canvas = null;
let ctx = null;
let canvasWrap = null;


/* =========================================================
   ID GENERATOR
========================================================= */

function uid(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function toast(message, type = "info") {
  const element = byId("toast");

  if (!element) {
    console.log("[Origo Draw]", message);
    return;
  }

  element.textContent = message;
  element.dataset.type = type;
  element.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2200);
}


/* =========================================================
   CANVAS INITIALIZATION
========================================================= */

function findCanvas() {
  canvas =
    byId("canvas") ||
    $("canvas") ||
    $("main canvas") ||
    $(".canvas");

  if (!canvas) return false;

  ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  canvasWrap =
    byId("canvasWrap") ||
    byId("canvasArea") ||
    $(".canvas-area") ||
    canvas.parentElement;

  return !!ctx;
}


function resizeCanvas(width, height) {
  if (!canvas || !ctx) return;

  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  const oldCanvas = document.createElement("canvas");
  oldCanvas.width = canvas.width || width;
  oldCanvas.height = canvas.height || height;

  if (canvas.width && canvas.height) {
    const oldCtx = oldCanvas.getContext("2d");
    oldCtx.drawImage(canvas, 0, 0);
  }

  canvas.width = width;
  canvas.height = height;

  drawCanvasBackground();

  if (oldCanvas.width > 0 && oldCanvas.height > 0) {
    try {
      ctx.drawImage(oldCanvas, 0, 0);
    } catch (error) {
      console.warn("Unable to restore old canvas.", error);
    }
  }

  state.canvas.width = width;
  state.canvas.height = height;

  updateCanvasInfo();
  updateCanvasTransform();
}


function createBlankCanvas(width, height, background = "#ffffff") {
  if (!canvas || !ctx) return;

  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  canvas.width = width;
  canvas.height = height;

  state.canvas.width = width;
  state.canvas.height = height;
  state.canvas.background = background;

  drawCanvasBackground();

  state.history = [];
  state.historyIndex = -1;

  saveHistory();
  updateCanvasInfo();
  updateCanvasTransform();
}


function drawCanvasBackground() {
  if (!canvas || !ctx) return;

  ctx.save();

  if (
    state.canvas.background === "transparent" ||
    state.canvas.background === "none"
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = state.canvas.background || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
}


/* =========================================================
   CANVAS INFO
========================================================= */

function updateCanvasInfo() {
  const text =
    `${state.canvas.width} × ${state.canvas.height}`;

  setText("canvasSizeLabel", text);
  setText("canvasSize", text);
  setText("sizeLabel", text);
}


/* =========================================================
   CANVAS TRANSFORM
========================================================= */

function updateCanvasTransform() {
  if (!canvas) return;

  canvas.style.transform =
    `translate(${state.panX}px, ${state.panY}px) ` +
    `scale(${state.zoom}) ` +
    `rotate(${state.rotation}deg)`;

  setText(
    "zoomLabel",
    `${Math.round(state.zoom * 100)}%`
  );

  setText(
    "zoomValue",
    `${Math.round(state.zoom * 100)}%`
  );
}


function setZoom(value) {
  value = Number(value);

  if (!Number.isFinite(value)) {
    value = 1;
  }

  state.zoom = Math.min(8, Math.max(0.1, value));

  updateCanvasTransform();
}


function zoomIn() {
  setZoom(state.zoom + 0.1);
}


function zoomOut() {
  setZoom(state.zoom - 0.1);
}


function resetView() {
  state.zoom = 1;
  state.rotation = 0;
  state.panX = 0;
  state.panY = 0;

  updateCanvasTransform();

  toast("View direset");
}


function fitCanvas() {
  if (!canvas || !canvasWrap) return;

  const rect = canvasWrap.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const scaleX = (rect.width - 80) / canvas.width;
  const scaleY = (rect.height - 100) / canvas.height;

  setZoom(Math.min(scaleX, scaleY, 1));

  state.panX = 0;
  state.panY = 0;

  updateCanvasTransform();
}


/* =========================================================
   COORDINATES
========================================================= */

function getCanvasPoint(event) {
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();

  const scaleX =
    canvas.width / Math.max(1, rect.width);

  const scaleY =
    canvas.height / Math.max(1, rect.height);

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}


/* =========================================================
   DRAWING SETTINGS
========================================================= */

function applyBrushSettings() {
  if (!ctx) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.lineWidth = Math.max(
    1,
    Number(state.brushSize) || 1
  );

  ctx.globalAlpha = Math.max(
    0,
    Math.min(1, Number(state.opacity))
  );

  ctx.strokeStyle = state.color;
  ctx.fillStyle = state.color;
}


function updateBrushSettings() {
  state.brushSize = Number(
    getValue("brushSize", state.brushSize)
  );

  state.opacity =
    Number(getValue("opacity", state.opacity * 100)) / 100;

  if (!Number.isFinite(state.opacity)) {
    state.opacity = 1;
  }

  state.opacity = Math.max(
    0,
    Math.min(1, state.opacity)
  );

  state.hardness = Number(
    getValue("hardness", state.hardness)
  );

  state.flow = Number(
    getValue("flow", state.flow)
  );

  state.smoothing = Number(
    getValue("smoothing", state.smoothing)
  );

  setText(
    "brushSizeOut",
    `${state.brushSize}px`
  );

  setText(
    "sizeOut",
    `${state.brushSize}px`
  );

  setText(
    "opacityOut",
    `${Math.round(state.opacity * 100)}%`
  );

  setText(
    "hardnessOut",
    `${state.hardness}%`
  );

  setText(
    "flowOut",
    `${state.flow}%`
  );

  setText(
    "smoothOut",
    `${state.smoothing}%`
  );
}


/* =========================================================
   TOOL SELECTION
========================================================= */

const TOOL_ALIASES = {
  brush: "brush",
  pencil: "pencil",
  pen: "pen",
  marker: "marker",
  eraser: "eraser",
  fill: "fill",
  bucket: "fill",
  picker: "picker",
  eyedropper: "picker",
  line: "line",
  rectangle: "rectangle",
  rect: "rectangle",
  circle: "circle",
  ellipse: "circle",
  polygon: "polygon",
  select: "select",
  selection: "select",
  move: "move",
  crop: "crop",
  transform: "transform",
  text: "text",
  gradient: "gradient",
  blur: "blur",
  smudge: "smudge",
  shadow: "shadow",
  highlight: "highlight",
  ruler: "ruler",
  hand: "move",
  pan: "move"
};


function setTool(tool) {
  tool = String(tool || "").toLowerCase();

  state.tool =
    TOOL_ALIASES[tool] ||
    tool ||
    "brush";

  $$(".tool-btn").forEach((button) => {
    const buttonTool =
      button.dataset.tool ||
      button.dataset.action ||
      button.getAttribute("data-tool");

    button.classList.toggle(
      "active",
      TOOL_ALIASES[buttonTool] === state.tool ||
      buttonTool === state.tool
    );
  });

  $$(".tool-button").forEach((button) => {
    const buttonTool = button.dataset.tool;

    button.classList.toggle(
      "active",
      TOOL_ALIASES[buttonTool] === state.tool ||
      buttonTool === state.tool
    );
  });

  setText(
    "activeTool",
    state.tool
  );
}


/* =========================================================
   HISTORY
========================================================= */

function getCanvasSnapshot() {
  if (!canvas) return null;

  try {
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Could not create history snapshot.", error);
    return null;
  }
}


function saveHistory() {
  if (!canvas) return;

  const snapshot = getCanvasSnapshot();

  if (!snapshot) return;

  if (
    state.historyIndex >= 0 &&
    state.history[state.historyIndex] === snapshot
  ) {
    return;
  }

  state.history =
    state.history.slice(0, state.historyIndex + 1);

  state.history.push(snapshot);

  if (state.history.length > 40) {
    state.history.shift();
  }

  state.historyIndex =
    state.history.length - 1;

  updateHistoryButtons();
}


function restoreSnapshot(snapshot) {
  if (!snapshot || !canvas || !ctx) return;

  const image = new Image();

  image.onload = () => {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    updateHistoryButtons();
  };

  image.src = snapshot;
}


function undo() {
  if (state.historyIndex <= 0) {
    toast("Tidak ada aksi untuk dibatalkan");
    return;
  }

  state.historyIndex--;

  restoreSnapshot(
    state.history[state.historyIndex]
  );

  updateHistoryButtons();
}


function redo() {
  if (
    state.historyIndex >=
    state.history.length - 1
  ) {
    toast("Tidak ada aksi untuk diulang");
    return;
  }

  state.historyIndex++;

  restoreSnapshot(
    state.history[state.historyIndex]
  );

  updateHistoryButtons();
}


function updateHistoryButtons() {
  const undoButton =
    byId("undoBtn") ||
    $('[data-action="undo"]');

  const redoButton =
    byId("redoBtn") ||
    $('[data-action="redo"]');

  if (undoButton) {
    undoButton.disabled =
      state.historyIndex <= 0;
  }

  if (redoButton) {
    redoButton.disabled =
      state.historyIndex >=
      state.history.length - 1;
  }
}


/* =========================================================
   POINTER DRAWING
========================================================= */

function beginDrawing(event) {
  if (!canvas || !ctx) return;

  if (
    event.pointerType === "mouse" &&
    event.button !== 0
  ) {
    return;
  }

  const point = getCanvasPoint(event);

  state.pointer.id = event.pointerId;
  state.pointer.type = event.pointerType || "mouse";

  state.lastX = point.x;
  state.lastY = point.y;

  state.startX = point.x;
  state.startY = point.y;

  state.isDrawing = true;

  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {}

  if (
    state.tool === "picker"
  ) {
    pickColor(point.x, point.y);
    state.isDrawing = false;
    return;
  }

  if (
    state.tool === "fill"
  ) {
    fillCanvas(point.x, point.y);
    state.isDrawing = false;
    saveHistory();
    return;
  }

  if (
    state.tool === "text"
  ) {
    createTextAt(point.x, point.y);
    state.isDrawing = false;
    return;
  }

  if (
    state.tool === "move"
  ) {
    state.isPanning = true;
    return;
  }

  applyBrushSettings();

  if (
    ["line", "rectangle", "circle", "polygon"]
      .includes(state.tool)
  ) {
    state.currentShape = getCanvasSnapshot();
    return;
  }

  drawPoint(point.x, point.y);
}


function moveDrawing(event) {
  if (!canvas || !ctx) return;

  if (
    state.pointer.id !== null &&
    event.pointerId !== state.pointer.id
  ) {
    return;
  }

  if (state.isPanning) {
    const dx =
      event.movementX ||
      0;

    const dy =
      event.movementY ||
      0;

    state.panX += dx;
    state.panY += dy;

    updateCanvasTransform();

    return;
  }

  if (!state.isDrawing) return;

  const point = getCanvasPoint(event);

  if (
    ["line", "rectangle", "circle", "polygon"]
      .includes(state.tool)
  ) {
    previewShape(point.x, point.y);
    return;
  }

  drawLine(
    state.lastX,
    state.lastY,
    point.x,
    point.y
  );

  state.lastX = point.x;
  state.lastY = point.y;
}


function endDrawing(event) {
  if (
    state.pointer.id !== null &&
    event &&
    event.pointerId !== state.pointer.id
  ) {
    return;
  }

  const wasDrawing =
    state.isDrawing ||
    state.isPanning;

  state.isDrawing = false;
  state.isPanning = false;
  state.currentShape = null;

  if (canvas && event) {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (error) {}
  }

  if (wasDrawing) {
    saveHistory();
  }
}


function drawPoint(x, y) {
  if (!ctx) return;

  applyBrushSettings();

  const radius =
    Math.max(
      0.5,
      state.brushSize / 2
    );

  if (state.tool === "eraser") {
    ctx.save();

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.globalAlpha =
      Math.max(
        0.05,
        state.opacity
      );

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      radius,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    return;
  }

  if (state.tool === "pencil") {
    ctx.save();
    ctx.globalAlpha =
      Math.min(1, state.opacity * 0.7);
    ctx.lineWidth =
      Math.max(1, state.brushSize * 0.55);
    ctx.strokeStyle = state.color;

    ctx.beginPath();
    ctx.arc(
      x,
      y,
      Math.max(
        0.5,
        state.brushSize * 0.275
      ),
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();

    return;
  }

  if (state.tool === "marker") {
    ctx.save();
    ctx.globalAlpha =
      Math.min(1, state.opacity * 0.35);
    ctx.lineWidth =
      Math.max(2, state.brushSize * 1.4);
    ctx.strokeStyle = state.color;

    ctx.beginPath();
    ctx.arc(
      x,
      y,
      Math.max(
        1,
        state.brushSize * 0.7
      ),
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();

    return;
  }

  if (state.tool === "highlight") {
    ctx.save();

    ctx.globalAlpha =
      Math.min(1, state.opacity * 0.35);

    ctx.strokeStyle =
      "#fff7a8";

    ctx.lineWidth =
      Math.max(
        2,
        state.brushSize * 1.3
      );

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      Math.max(
        1,
        state.brushSize / 2
      ),
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    return;
  }

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    radius,
    0,
    Math.PI * 2
  );

  ctx.fill();
}


function drawLine(x1, y1, x2, y2) {
  if (!ctx) return;

  applyBrushSettings();

  if (state.tool === "eraser") {
    ctx.save();

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.globalAlpha =
      Math.max(
        0.05,
        state.opacity
      );

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    ctx.restore();

    return;
  }

  if (state.tool === "pencil") {
    ctx.save();

    ctx.globalAlpha =
      Math.min(
        1,
        state.opacity * 0.7
      );

    ctx.lineWidth =
      Math.max(
        1,
        state.brushSize * 0.55
      );

    ctx.strokeStyle =
      state.color;

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    ctx.restore();

    return;
  }

  if (state.tool === "marker") {
    ctx.save();

    ctx.globalAlpha =
      Math.min(
        1,
        state.opacity * 0.35
      );

    ctx.lineWidth =
      Math.max(
        2,
        state.brushSize * 1.4
      );

    ctx.strokeStyle =
      state.color;

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    ctx.restore();

    return;
  }

  if (state.tool === "shadow") {
    drawShadowStroke(
      x1,
      y1,
      x2,
      y2
    );

    return;
  }

  if (state.tool === "highlight") {
    ctx.save();

    ctx.globalAlpha =
      Math.min(
        1,
        state.opacity * 0.35
      );

    ctx.strokeStyle =
      "#fff7a8";

    ctx.lineWidth =
      Math.max(
        2,
        state.brushSize * 1.3
      );

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    ctx.restore();

    return;
  }

  ctx.beginPath();

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  ctx.stroke();
}


/* =========================================================
   SHAPES
========================================================= */

function previewShape(x, y) {
  if (!state.currentShape) return;

  restoreSnapshotImmediate(
    state.currentShape
  );

  applyBrushSettings();

  const x0 = state.startX;
  const y0 = state.startY;

  ctx.save();

  if (state.tool === "line") {
    ctx.beginPath();

    ctx.moveTo(x0, y0);
    ctx.lineTo(x, y);

    ctx.stroke();
  }

  if (state.tool === "rectangle") {
    ctx.strokeRect(
      x0,
      y0,
      x - x0,
      y - y0
    );
  }

  if (state.tool === "circle") {
    const dx = x - x0;
    const dy = y - y0;

    const radius =
      Math.sqrt(
        dx * dx +
        dy * dy
      );

    ctx.beginPath();

    ctx.arc(
      x0,
      y0,
      radius,
      0,
      Math.PI * 2
    );

    ctx.stroke();
  }

  if (state.tool === "polygon") {
    drawPolygon(
      x0,
      y0,
      x,
      y
    );
  }

  ctx.restore();
}


function drawPolygon(x0, y0, x, y) {
  if (!ctx) return;

  const dx = x - x0;
  const dy = y - y0;

  const radius =
    Math.sqrt(
      dx * dx +
      dy * dy
    );

  const sides = 6;

  const angle =
    Math.atan2(dy, dx);

  ctx.beginPath();

  for (let i = 0; i < sides; i++) {
    const a =
      angle +
      (Math.PI * 2 * i) /
        sides;

    const px =
      x0 +
      Math.cos(a) * radius;

    const py =
      y0 +
      Math.sin(a) * radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.stroke();
}


function restoreSnapshotImmediate(snapshot) {
  if (!snapshot || !ctx || !canvas) return;

  const image = new Image();

  image.onload = () => {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );
  };

  image.src = snapshot;
}


/* =========================================================
   COLOR PICKER
========================================================= */

function pickColor(x, y) {
  if (!ctx || !canvas) return;

  try {
    const pixel =
      ctx.getImageData(
        Math.round(x),
        Math.round(y),
        1,
        1
      ).data;

    const hex =
      "#" +
      [pixel[0], pixel[1], pixel[2]]
        .map((value) =>
          value.toString(16).padStart(2, "0")
        )
        .join("");

    state.color = hex;

    updateColorInputs();

    toast(`Warna dipilih: ${hex}`);
  } catch (error) {
    toast("Tidak bisa mengambil warna");
  }
}


function updateColorInputs() {
  [
    "color",
    "colorInput",
    "brushColor",
    "primaryColor"
  ].forEach((id) => {
    const input = byId(id);

    if (input && input.type === "color") {
      input.value = state.color;
    }
  });

  $$(".color-input").forEach((input) => {
    if (input.type === "color") {
      input.value = state.color;
    }
  });
}


/* =========================================================
   FILL
========================================================= */

function fillCanvas(x, y) {
  if (!canvas || !ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  const imageData =
    ctx.getImageData(
      0,
      0,
      width,
      height
    );

  const data = imageData.data;

  const startX =
    Math.max(
      0,
      Math.min(
        width - 1,
        Math.floor(x)
      )
    );

  const startY =
    Math.max(
      0,
      Math.min(
        height - 1,
        Math.floor(y)
      )
    );

  const startIndex =
    (startY * width + startX) * 4;

  const target = [
    data[startIndex],
    data[startIndex + 1],
    data[startIndex + 2],
    data[startIndex + 3]
  ];

  const fill = hexToRgba(
    state.color
  );

  if (
    target[0] === fill[0] &&
    target[1] === fill[1] &&
    target[2] === fill[2] &&
    target[3] === fill[3]
  ) {
    return;
  }

  const stack = [
    [startX, startY]
  ];

  const visited =
    new Uint8Array(
      width * height
    );

  const tolerance = 20;

  while (stack.length) {
    const [cx, cy] =
      stack.pop();

    if (
      cx < 0 ||
      cy < 0 ||
      cx >= width ||
      cy >= height
    ) {
      continue;
    }

    const position =
      cy * width + cx;

    if (visited[position]) {
      continue;
    }

    visited[position] = 1;

    const index =
      position * 4;

    const match =
      Math.abs(
        data[index] -
        target[0]
      ) <= tolerance &&
      Math.abs(
        data[index + 1] -
        target[1]
      ) <= tolerance &&
      Math.abs(
        data[index + 2] -
        target[2]
      ) <= tolerance &&
      Math.abs(
        data[index + 3] -
        target[3]
      ) <= tolerance;

    if (!match) continue;

    data[index] = fill[0];
    data[index + 1] = fill[1];
    data[index + 2] = fill[2];
    data[index + 3] = fill[3];

    stack.push(
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    );
  }

  ctx.putImageData(
    imageData,
    0,
    0
  );
}


function hexToRgba(hex) {
  hex =
    String(hex || "#000000")
      .replace("#", "");

  if (hex.length === 3) {
    hex =
      hex
        .split("")
        .map((x) => x + x)
        .join("");
  }

  const value =
    parseInt(hex, 16);

  if (!Number.isFinite(value)) {
    return [0, 0, 0, 255];
  }

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
    255
  ];
}


/* =========================================================
   TEXT
========================================================= */

function createTextAt(x, y) {
  const text =
    window.prompt(
      "Masukkan teks:"
    );

  if (!text) return;

  const size =
    Math.max(
      8,
      state.brushSize * 2
    );

  ctx.save();

  ctx.globalAlpha =
    state.opacity;

  ctx.fillStyle =
    state.color;

  ctx.font =
    `${size}px sans-serif`;

  ctx.textBaseline =
    "top";

  ctx.fillText(
    text,
    x,
    y
  );

  ctx.restore();

  saveHistory();
}


/* =========================================================
   BLUR
========================================================= */

function blurArea() {
  if (!canvas || !ctx) return;

  ctx.save();

  ctx.filter =
    `blur(${Math.max(
      1,
      state.brushSize / 3
    )}px)`;

  const copy =
    document.createElement("canvas");

  copy.width = canvas.width;
  copy.height = canvas.height;

  const copyCtx =
    copy.getContext("2d");

  copyCtx.drawImage(
    canvas,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.drawImage(
    copy,
    0,
    0
  );

  ctx.restore();
}


/* =========================================================
   SMUDGE
========================================================= */

function smudgeAt(x, y) {
  if (!canvas || !ctx) return;

  const size =
    Math.max(
      5,
      state.brushSize
    );

  const half =
    size / 2;

  try {
    const image =
      ctx.getImageData(
        Math.max(
          0,
          x - half
        ),
        Math.max(
          0,
          y - half
        ),
        Math.min(
          size,
          canvas.width
        ),
        Math.min(
          size,
          canvas.height
        )
      );

    ctx.putImageData(
      image,
      Math.max(
        0,
        x - half + 1
      ),
      Math.max(
        0,
        y - half + 1
      )
    );
  } catch (error) {}
}


/* =========================================================
   SHADOW
========================================================= */

function drawShadowStroke(x1, y1, x2, y2) {
  if (!ctx) return;

  const angle =
    Number(state.shadow.angle) *
    Math.PI /
    180;

  const offset =
    Number(state.shadow.intensity) /
    5;

  const dx =
    Math.cos(angle) *
    offset;

  const dy =
    Math.sin(angle) *
    offset;

  ctx.save();

  ctx.globalAlpha =
    Math.max(
      0.05,
      Math.min(
        1,
        state.opacity *
        (state.shadow.intensity / 100)
      )
    );

  ctx.strokeStyle =
    "rgba(0,0,0,0.8)";

  ctx.lineWidth =
    Math.max(
      1,
      state.brushSize
    );

  ctx.filter =
    `blur(${Math.max(
      0,
      state.shadow.softness / 10
    )}px)`;

  ctx.beginPath();

  ctx.moveTo(
    x1 + dx,
    y1 + dy
  );

  ctx.lineTo(
    x2 + dx,
    y2 + dy
  );

  ctx.stroke();

  ctx.restore();
}


/* =========================================================
   CLEAR CANVAS
========================================================= */

function clearCanvas() {
  if (!canvas || !ctx) return;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  drawCanvasBackground();

  saveHistory();

  toast("Canvas dibersihkan");
}


/* =========================================================
   NEW CANVAS
========================================================= */

function openNewCanvas() {
  const modal =
    byId("newCanvasModal") ||
    byId("newModal");

  if (modal) {
    show(modal);
    return;
  }

  createNewCanvasFromValues();
}


function createNewCanvasFromValues() {
  const preset =
    getValue(
      "canvasSize",
      "custom"
    );

  let width = 1200;
  let height = 800;

  const presets = {
    a5: [1480, 2100],
    a4: [2480, 3508],
    a3: [3508, 4961],
    square: [2000, 2000],
    portrait: [1200, 1600],
    landscape: [1600, 1200],
    "16:9": [1920, 1080],
    "4:3": [1600, 1200]
  };

  if (presets[preset]) {
    width = presets[preset][0];
    height = presets[preset][1];
  } else {
    width =
      Number(
        getValue(
          "newCanvasWidth",
          getValue(
            "canvasWidth",
            1200
          )
        )
      ) || 1200;

    height =
      Number(
        getValue(
          "newCanvasHeight",
          getValue(
            "canvasHeight",
            800
          )
        )
      ) || 800;
  }

  const background =
    getValue(
      "canvasBackground",
      "#ffffff"
    );

  createBlankCanvas(
    width,
    height,
    background
  );

  closeModals();

  toast(
    `Canvas baru ${width} × ${height}`
  );
}


/* =========================================================
   IMPORT IMAGE
========================================================= */

function importImage(file) {
  if (!file) return;

  if (
    !file.type.startsWith("image/")
  ) {
    toast(
      "File harus berupa gambar",
      "error"
    );
    return;
  }

  const reader =
    new FileReader();

  reader.onload = (event) => {
    const image =
      new Image();

    image.onload = () => {
      if (!canvas || !ctx) return;

      const scale =
        Math.min(
          1,
          canvas.width / image.width,
          canvas.height / image.height
        );

      const width =
        image.width * scale;

      const height =
        image.height * scale;

      const x =
        (canvas.width - width) / 2;

      const y =
        (canvas.height - height) / 2;

      ctx.drawImage(
        image,
        x,
        y,
        width,
        height
      );

      saveHistory();

      toast("Gambar berhasil diimpor");
    };

    image.src =
      event.target.result;
  };

  reader.readAsDataURL(file);
}


function openImportDialog() {
  const input =
    byId("imageInput") ||
    byId("fileInput") ||
    $("input[type='file']");

  if (input) {
    input.click();
    return;
  }

  const temporary =
    document.createElement("input");

  temporary.type = "file";
  temporary.accept =
    "image/png,image/jpeg,image/webp";

  temporary.onchange = () => {
    importImage(
      temporary.files[0]
    );
  };

  temporary.click();
}


/* =========================================================
   EXPORT
========================================================= */

function exportCanvas(format = "png") {
  if (!canvas) {
    toast("Canvas belum tersedia", "error");
    return;
  }

  const typeMap = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp"
  };

  const mime =
    typeMap[
      String(format).toLowerCase()
    ] || "image/png";

  let dataURL;

  try {
    dataURL =
      canvas.toDataURL(
        mime,
        0.92
      );
  } catch (error) {
    toast(
      "Gagal membuat file",
      "error"
    );
    return;
  }

  const extension =
    mime === "image/jpeg"
      ? "jpg"
      : mime.split("/")[1];

  const link =
    document.createElement("a");

  link.href = dataURL;

  link.download =
    `origo-draw-${Date.now()}.${extension}`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  toast(
    `Berhasil export ${extension.toUpperCase()}`
  );
}


function exportPDF() {
  if (!canvas) return;

  const imageData =
    canvas.toDataURL(
      "image/jpeg",
      0.95
    );

  const popup =
    window.open(
      "",
      "_blank"
    );

  if (!popup) {
    toast(
      "Izinkan pop-up untuk export PDF",
      "error"
    );
    return;
  }

  popup.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Origo Draw PDF</title>
        <style>
          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
          }

          img {
            display: block;
            width: 100%;
            height: auto;
          }
        </style>
      </head>

      <body>
        <img src="${imageData}">
      </body>
    </html>
  `);

  popup.document.close();

  popup.onload = () => {
    popup.focus();
    popup.print();
  };

  toast("Dialog print PDF dibuka");
}


/* =========================================================
   GALLERY — LOCAL STORAGE
========================================================= */

function loadGallery() {
  try {
    const saved =
      localStorage.getItem(
        "origo_gallery"
      );

    state.gallery =
      saved
        ? JSON.parse(saved)
        : [];
  } catch (error) {
    state.gallery = [];
  }
}


function saveGallery() {
  try {
    localStorage.setItem(
      "origo_gallery",
      JSON.stringify(
        state.gallery.slice(0, 30)
      )
    );
  } catch (error) {
    console.warn(
      "Gallery storage unavailable."
    );
  }
}


function saveCurrentToGallery() {
  if (!canvas) return;

  const item = {
    id: uid("art"),
    title:
      `Artwork ${state.gallery.length + 1}`,
    date:
      new Date().toISOString(),
    width:
      canvas.width,
    height:
      canvas.height,
    image:
      canvas.toDataURL(
        "image/png"
      )
  };

  state.gallery.unshift(item);

  state.gallery =
    state.gallery.slice(
      0,
      30
    );

  saveGallery();
  renderGallery();

  toast(
    "Artwork disimpan ke Gallery"
  );
}


function renderGallery() {
  const gallery =
    byId("gallery");

  if (!gallery) return;

  gallery.innerHTML = "";

  if (!state.gallery.length) {
    gallery.innerHTML =
      `<div class="empty-state">
        Belum ada artwork tersimpan.
      </div>`;

    return;
  }

  state.gallery.forEach((item) => {
    const card =
      document.createElement("article");

    card.className =
      "gallery-card";

    card.innerHTML = `
      <img
        src="${item.image}"
        alt="${escapeHTML(item.title)}"
      >

      <div class="gallery-card-info">
        <strong>
          ${escapeHTML(item.title)}
        </strong>

        <small>
          ${item.width} × ${item.height}
        </small>
      </div>

      <div class="gallery-card-actions">
        <button
          type="button"
          data-gallery-open="${item.id}"
        >
          Buka
        </button>

        <button
          type="button"
          data-gallery-delete="${item.id}"
        >
          Hapus
        </button>
      </div>
    `;

    gallery.appendChild(card);
  });

  $$("[data-gallery-open]", gallery)
    .forEach((button) => {
      on(
        button,
        "click",
        () => {
          openGalleryItem(
            button.dataset.galleryOpen
          );
        }
      );
    });

  $$("[data-gallery-delete]", gallery)
    .forEach((button) => {
      on(
        button,
        "click",
        () => {
          deleteGalleryItem(
            button.dataset.galleryDelete
          );
        }
      );
    });
}


function openGalleryItem(id) {
  const item =
    state.gallery.find(
      (entry) => entry.id === id
    );

  if (!item || !canvas || !ctx) return;

  const image =
    new Image();

  image.onload = () => {
    canvas.width =
      item.width;

    canvas.height =
      item.height;

    state.canvas.width =
      item.width;

    state.canvas.height =
      item.height;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    saveHistory();
    updateCanvasInfo();

    closeModals();

    toast(
      "Artwork dibuka"
    );
  };

  image.src =
    item.image;
}


function deleteGalleryItem(id) {
  state.gallery =
    state.gallery.filter(
      (item) => item.id !== id
    );

  saveGallery();
  renderGallery();

  toast(
    "Artwork dihapus"
  );
}


/* =========================================================
   LAYERS
========================================================= */

function createLayer(name = "Layer") {
  return {
    id: uid("layer"),
    name,
    visible: true,
    locked: false,
    opacity: 1
  };
}


function initializeLayers() {
  if (!state.layers.length) {
    const layer =
      createLayer(
        "Background"
      );

    state.layers.push(layer);
    state.activeLayerId =
      layer.id;
  }

  updateLayersUI();
}


function updateLayersUI() {
  const container =
    byId("layers") ||
    byId("layerList") ||
    $(".layers-list");

  if (!container) return;

  container.innerHTML = "";

  [...state.layers]
    .reverse()
    .forEach((layer) => {
      const item =
        document.createElement("div");

      item.className =
        "layer-item";

      if (
        layer.id ===
        state.activeLayerId
      ) {
        item.classList.add(
          "active"
        );
      }

      item.innerHTML = `
        <button
          type="button"
          class="layer-visibility"
          data-layer-visible="${layer.id}"
          title="Visibility"
        >
          ${layer.visible ? "◉" : "○"}
        </button>

        <button
          type="button"
          class="layer-name"
          data-layer-select="${layer.id}"
        >
          ${escapeHTML(layer.name)}
        </button>

        <button
          type="button"
          class="layer-lock"
          data-layer-lock="${layer.id}"
          title="Lock"
        >
          ${layer.locked ? "🔒" : "🔓"}
        </button>
      `;

      container.appendChild(item);
    });

  $$("[data-layer-select]", container)
    .forEach((button) => {
      on(
        button,
        "click",
        () => {
          selectLayer(
            button.dataset.layerSelect
          );
        }
      );

      on(
        button,
        "dblclick",
        () => {
          renameLayer(
            button.dataset.layerSelect
          );
        }
      );
    });

  $$("[data-layer-visible]", container)
    .forEach((button) => {
      on(
        button,
        "click",
        (event) => {
          event.stopPropagation();

          toggleLayerVisibility(
            button.dataset.layerVisible
          );
        }
      );
    });

  $$("[data-layer-lock]", container)
    .forEach((button) => {
      on(
        button,
        "click",
        (event) => {
          event.stopPropagation();

          toggleLayerLock(
            button.dataset.layerLock
          );
        }
      );
    });
}


function selectLayer(id) {
  const layer =
    state.layers.find(
      (item) => item.id === id
    );

  if (!layer) return;

  state.activeLayerId =
    layer.id;

  updateLayersUI();
}


function addLayer() {
  const layer =
    createLayer(
      `Layer ${state.layers.length + 1}`
    );

  state.layers.push(layer);

  state.activeLayerId =
    layer.id;

  updateLayersUI();

  toast("Layer ditambahkan");
}


function deleteLayer() {
  if (
    state.layers.length <= 1
  ) {
    toast(
      "Minimal harus ada satu layer"
    );
    return;
  }

  const index =
    state.layers.findIndex(
      (layer) =>
        layer.id ===
        state.activeLayerId
    );

  if (index === -1) return;

  state.layers.splice(
    index,
    1
  );

  state.activeLayerId =
    state.layers[
      Math.max(
        0,
        index - 1
      )
    ].id;

  updateLayersUI();

  toast("Layer dihapus");
}


function duplicateLayer() {
  const current =
    state.layers.find(
      (layer) =>
        layer.id ===
        state.activeLayerId
    );

  if (!current) return;

  const duplicate = {
    ...current,
    id: uid("layer"),
    name:
      `${current.name} Copy`
  };

  state.layers.push(
    duplicate
  );

  state.activeLayerId =
    duplicate.id;

  updateLayersUI();

  toast("Layer diduplikasi");
}


function renameLayer(id) {
  const layer =
    state.layers.find(
      (item) => item.id === id
    );

  if (!layer) return;

  const name =
    window.prompt(
      "Nama layer:",
      layer.name
    );

  if (!name) return;

  layer.name =
    name.trim() ||
    layer.name;

  updateLayersUI();
}


function toggleLayerVisibility(id) {
  const layer =
    state.layers.find(
      (item) => item.id === id
    );

  if (!layer) return;

  layer.visible =
    !layer.visible;

  updateLayersUI();
}


function toggleLayerLock(id) {
  const layer =
    state.layers.find(
      (item) => item.id === id
    );

  if (!layer) return;

  layer.locked =
    !layer.locked;

  updateLayersUI();
}


/* =========================================================
   GUIDES
========================================================= */

function toggleGrid() {
  state.guides.grid =
    !state.guides.grid;

  updateGuideOverlay();

  toast(
    state.guides.grid
      ? "Grid aktif"
      : "Grid mati"
  );
}


function toggleRuler() {
  state.guides.ruler =
    !state.guides.ruler;

  updateGuideOverlay();

  toast(
    state.guides.ruler
      ? "Ruler aktif"
      : "Ruler mati"
  );
}


function togglePerspective() {
  state.guides.perspective =
    !state.guides.perspective;

  updateGuideOverlay();

  toast(
    state.guides.perspective
      ? "Perspective guide aktif"
      : "Perspective guide mati"
  );
}


function toggleSymmetry() {
  state.guides.symmetry =
    !state.guides.symmetry;

  updateGuideOverlay();

  toast(
    state.guides.symmetry
      ? "Symmetry aktif"
      : "Symmetry mati"
  );
}


function updateGuideOverlay() {
  let overlay =
    byId("guideOverlay");

  if (!overlay) {
    overlay =
      document.createElement("div");

    overlay.id =
      "guideOverlay";

    overlay.style.position =
      "absolute";

    overlay.style.inset =
      "0";

    overlay.style.pointerEvents =
      "none";

    overlay.style.zIndex =
      "10";

    if (canvasWrap) {
      canvasWrap.style.position =
        canvasWrap.style.position ||
        "relative";

      canvasWrap.appendChild(
        overlay
      );
    }
  }

  if (!overlay) return;

  overlay.innerHTML = "";

  if (state.guides.grid) {
    const grid =
      document.createElement("div");

    grid.style.position =
      "absolute";

    grid.style.inset =
      "0";

    grid.style.backgroundImage =
      "linear-gradient(rgba(100,150,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(100,150,255,.18) 1px, transparent 1px)";

    grid.style.backgroundSize =
      "40px 40px";

    overlay.appendChild(
      grid
    );
  }

  if (
    state.guides.perspective
  ) {
    const line =
      document.createElement("div");

    line.style.position =
      "absolute";

    line.style.left =
      "50%";

    line.style.top =
      "0";

    line.style.bottom =
      "0";

    line.style.width =
      "1px";

    line.style.background =
      "rgba(94,167,255,.6)";

    overlay.appendChild(
      line
    );
  }

  if (
    state.guides.symmetry
  ) {
    const line =
      document.createElement("div");

    line.style.position =
      "absolute";

    if (
      state.guides.symmetryType ===
      "horizontal"
    ) {
      line.style.left =
        "0";

      line.style.right =
        "0";

      line.style.top =
        "50%";

      line.style.height =
        "1px";
    } else {
      line.style.top =
        "0";

      line.style.bottom =
        "0";

      line.style.left =
        "50%";

      line.style.width =
        "1px";
    }

    line.style.background =
      "rgba(85,217,139,.7)";

    overlay.appendChild(
      line
    );
  }
}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {
  const saved =
    localStorage.getItem(
      "origo_theme"
    );

  if (
    saved === "light" ||
    saved === "dark"
  ) {
    state.theme =
      saved;
  }

  applyTheme();
}


function applyTheme() {
  document.body.classList.toggle(
    "light",
    state.theme === "light"
  );

  document.documentElement.dataset.theme =
    state.theme;

  setText(
    "themeLabel",
    state.theme === "light"
      ? "Light"
      : "Dark"
  );
}


function toggleTheme() {
  state.theme =
    state.theme === "dark"
      ? "light"
      : "dark";

  localStorage.setItem(
    "origo_theme",
    state.theme
  );

  applyTheme();

  toast(
    state.theme === "light"
      ? "Light mode aktif"
      : "Dark mode aktif"
  );
}


/* =========================================================
   MODALS
========================================================= */

function closeModals() {
  $$(".modal").forEach(
    (modal) => {
      hide(modal);
    }
  );

  [
    "newCanvasModal",
    "newModal",
    "shortcutsModal",
    "galleryModal",
    "exportModal"
  ].forEach((id) => {
    hide(byId(id));
  });
}


function openModalById(id) {
  const modal =
    byId(id);

  if (!modal) return;

  show(modal);
}


/* =========================================================
   LANDING / STUDIO
========================================================= */

function openStudio() {
  state.started = true;

  const landing =
    byId("landing");

  const studio =
    byId("studio");

  if (landing) {
    hide(landing);
  }

  if (studio) {
    show(studio);
  }

  if (canvas) {
    updateCanvasTransform();
  }

  toast(
    "Selamat datang di Origo Draw"
  );
}


function openLanding() {
  const landing =
    byId("landing");

  const studio =
    byId("studio");

  if (studio) {
    hide(studio);
  }

  if (landing) {
    show(landing);
  }
}


/* =========================================================
   SHORTCUTS
========================================================= */

const SHORTCUTS = [
  ["B", "Brush"],
  ["P", "Pencil"],
  ["E", "Eraser"],
  ["M", "Move"],
  ["L", "Line"],
  ["R", "Rectangle"],
  ["C", "Circle"],
  ["T", "Text"],
  ["G", "Fill"],
  ["I", "Color Picker"],
  ["U", "Undo"],
  ["Y", "Redo"],
  ["+", "Zoom In"],
  ["-", "Zoom Out"],
  ["0", "Reset View"],
  ["1", "100% Zoom"],
  ["F", "Fit Canvas"],
  ["Delete", "Clear Canvas"],
  ["Ctrl + S", "Save Gallery"],
  ["Ctrl + Z", "Undo"],
  ["Ctrl + Y", "Redo"],
  ["Ctrl + O", "Import Image"],
  ["Ctrl + E", "Export PNG"],
  ["Ctrl + Shift + E", "Export JPG"],
  ["Ctrl + Shift + S", "Save Gallery"],
  ["Shift + G", "Grid"],
  ["Shift + R", "Ruler"],
  ["Shift + P", "Perspective"],
  ["Shift + Y", "Symmetry"],
  ["D", "Default Color"],
  ["X", "Swap / Quick Eraser"]
];


function renderShortcuts() {
  const container =
    byId("shortcutList");

  if (!container) return;

  container.innerHTML = "";

  SHORTCUTS.forEach(
    ([key, description]) => {
      const row =
        document.createElement("div");

      row.className =
        "shortcut-row";

      row.innerHTML = `
        <kbd>
          ${escapeHTML(key)}
        </kbd>

        <span>
          ${escapeHTML(description)}
        </span>
      `;

      container.appendChild(
        row
      );
    }
  );
}


function handleKeyboard(event) {
  const target =
    event.target;

  if (
    target &&
    (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    )
  ) {
    return;
  }

  const key =
    event.key.toLowerCase();

  if (
    event.ctrlKey &&
    key === "z"
  ) {
    event.preventDefault();

    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }

    return;
  }

  if (
    event.ctrlKey &&
    key === "y"
  ) {
    event.preventDefault();

    redo();

    return;
  }

  if (
    event.ctrlKey &&
    key === "s"
  ) {
    event.preventDefault();

    saveCurrentToGallery();

    return;
  }

  if (
    event.ctrlKey &&
    key === "o"
  ) {
    event.preventDefault();

    openImportDialog();

    return;
  }

  if (
    event.ctrlKey &&
    key === "e"
  ) {
    event.preventDefault();

    if (event.shiftKey) {
      exportCanvas("jpg");
    } else {
      exportCanvas("png");
    }

    return;
  }

  if (key === "b") setTool("brush");
  else if (key === "p") setTool("pencil");
  else if (key === "e") setTool("eraser");
  else if (key === "m") setTool("move");
  else if (key === "l") setTool("line");
  else if (key === "r") setTool("rectangle");
  else if (key === "c") setTool("circle");
  else if (key === "t") setTool("text");
  else if (key === "g") setTool("fill");
  else if (key === "i") setTool("picker");
  else if (key === "+") zoomIn();
  else if (key === "=") zoomIn();
  else if (key === "-") zoomOut();
  else if (key === "0") resetView();
  else if (key === "1") setZoom(1);
  else if (key === "f") fitCanvas();
  else if (key === "delete") clearCanvas();
  else if (
    event.shiftKey &&
    key === "g"
  ) {
    toggleGrid();
  } else if (
    event.shiftKey &&
    key === "r"
  ) {
    toggleRuler();
  } else if (
    event.shiftKey &&
    key === "p"
  ) {
    togglePerspective();
  } else if (
    event.shiftKey &&
    key === "y"
  ) {
    toggleSymmetry();
  } else if (key === "d") {
    state.color =
      "#111111";

    updateColorInputs();
  } else if (key === "x") {
    state.tool =
      state.tool === "eraser"
        ? "brush"
        : "eraser";

    setTool(
      state.tool
    );
  }
}


/* =========================================================
   DRAG & DROP
========================================================= */

function setupDragDrop() {
  if (!canvasWrap) return;

  on(
    canvasWrap,
    "dragover",
    (event) => {
      event.preventDefault();

      canvasWrap.classList.add(
        "drag-over"
      );
    }
  );

  on(
    canvasWrap,
    "dragleave",
    () => {
      canvasWrap.classList.remove(
        "drag-over"
      );
    }
  );

  on(
    canvasWrap,
    "drop",
    (event) => {
      event.preventDefault();

      canvasWrap.classList.remove(
        "drag-over"
      );

      const file =
        event.dataTransfer.files[0];

      importImage(file);
    }
  );
}


/* =========================================================
   FULLSCREEN
========================================================= */

function toggleFullscreen() {
  const target =
    byId("studio") ||
    canvasWrap ||
    document.documentElement;

  if (!document.fullscreenElement) {
    target
      .requestFullscreen?.()
      .catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}


/* =========================================================
   COLOR INPUTS
========================================================= */

function setupColorInputs() {
  const inputs = [
    byId("color"),
    byId("colorInput"),
    byId("brushColor"),
    byId("primaryColor"),
    ...$$("input[type='color']")
  ];

  inputs
    .filter(Boolean)
    .forEach((input) => {
      on(
        input,
        "input",
        () => {
          state.color =
            input.value;

          updateColorInputs();
        }
      );
    });
}


/* =========================================================
   RANGE CONTROLS
========================================================= */

function setupRangeControls() {
  const ranges =
    $$("input[type='range']");

  ranges.forEach(
    (input) => {
      on(
        input,
        "input",
        () => {
          const id =
            input.id;

          if (
            [
              "brushSize",
              "size"
            ].includes(id)
          ) {
            state.brushSize =
              Number(
                input.value
              );
          }

          if (
            [
              "opacity"
            ].includes(id)
          ) {
            state.opacity =
              Number(
                input.value
              ) / 100;
          }

          if (
            [
              "hardness"
            ].includes(id)
          ) {
            state.hardness =
              Number(
                input.value
              );
          }

          if (
            [
              "flow"
            ].includes(id)
          ) {
            state.flow =
              Number(
                input.value
              );
          }

          if (
            [
              "smoothing",
              "smooth"
            ].includes(id)
          ) {
            state.smoothing =
              Number(
                input.value
              );
          }

          if (
            [
              "shadowIntensity"
            ].includes(id)
          ) {
            state.shadow.intensity =
              Number(
                input.value
              );
          }

          if (
            [
              "shadowSoftness"
            ].includes(id)
          ) {
            state.shadow.softness =
              Number(
                input.value
              );
          }

          if (
            [
              "shadowAngle"
            ].includes(id)
          ) {
            state.shadow.angle =
              Number(
                input.value
              );
          }

          updateBrushSettings();

          setText(
            `${id}Out`,
            input.value
          );
        }
      );
    }
  );
}


/* =========================================================
   ACTION BUTTONS
========================================================= */

function handleAction(action) {
  if (!action) return;

  const actions = {
    undo,
    redo,
    clear: clearCanvas,
    clearCanvas,
    new: openNewCanvas,
    newCanvas: openNewCanvas,
    import: openImportDialog,
    importImage: openImportDialog,
    export: () => exportCanvas("png"),
    exportPNG: () => exportCanvas("png"),
    exportJPG: () => exportCanvas("jpg"),
    exportWEBP: () => exportCanvas("webp"),
    exportPDF,
    save: saveCurrentToGallery,
    saveGallery: saveCurrentToGallery,

    zoomIn,
    zoomOut,
    resetView,
    reset: resetView,
    fit: fitCanvas,
    fitCanvas,

    fullscreen: toggleFullscreen,

    theme: toggleTheme,

    addLayer,
    newLayer: addLayer,
    deleteLayer,
    duplicateLayer,
    renameLayer,

    grid: toggleGrid,
    ruler: toggleRuler,
    perspective: togglePerspective,
    symmetry: toggleSymmetry,

    studio: openStudio,
    landing: openLanding,

    close: closeModals
  };

  const fn =
    actions[action];

  if (typeof fn === "function") {
    fn();
    return;
  }

  if (
    TOOL_ALIASES[action]
  ) {
    setTool(
      TOOL_ALIASES[action]
    );
  }
}


/* =========================================================
   EVENT SETUP
========================================================= */

function setupEvents() {
  /*
    Canvas pointer events
  */

  if (canvas) {
    on(
      canvas,
      "pointerdown",
      beginDrawing
    );

    on(
      canvas,
      "pointermove",
      moveDrawing
    );

    on(
      canvas,
      "pointerup",
      endDrawing
    );

    on(
      canvas,
      "pointercancel",
      endDrawing
    );

    on(
      canvas,
      "pointerleave",
      (event) => {
        if (
          state.pointer.type ===
          "mouse"
        ) {
          endDrawing(event);
        }
      }
    );

    canvas.style.touchAction =
      "none";
  }

  /*
    Generic action buttons
  */

  $$("[data-action]")
    .forEach((button) => {
      on(
        button,
        "click",
        (event) => {
          event.preventDefault();

          handleAction(
            button.dataset.action
          );
        }
      );
    });

  /*
    Tool buttons
  */

  $$("[data-tool]")
    .forEach((button) => {
      on(
        button,
        "click",
        (event) => {
          event.preventDefault();

          setTool(
            button.dataset.tool
          );
        }
      );
    });

  $$(".tool-btn")
    .forEach((button) => {
      on(
        button,
        "click",
        () => {
          const tool =
            button.dataset.tool;

          if (tool) {
            setTool(tool);
          }
        }
      );
    });

  /*
    Common IDs
  */

  onId(
    "startBtn",
    "click",
    openStudio
  );

  onId(
    "toolsBtn",
    "click",
    openStudio
  );

  onId(
    "newBtn",
    "click",
    openNewCanvas
  );

  onId(
    "galleryBtn",
    "click",
    () => {
      renderGallery();

      openModalById(
        "galleryModal"
      );
    }
  );

  onId(
    "shortcutsBtn",
    "click",
    () => {
      renderShortcuts();

      openModalById(
        "shortcutsModal"
      );
    }
  );

  onId(
    "themeBtn",
    "click",
    toggleTheme
  );

  onId(
    "undoBtn",
    "click",
    undo
  );

  onId(
    "redoBtn",
    "click",
    redo
  );

  onId(
    "zoomInBtn",
    "click",
    zoomIn
  );

  onId(
    "zoomOutBtn",
    "click",
    zoomOut
  );

  onId(
    "resetViewBtn",
    "click",
    resetView
  );

  onId(
    "fitBtn",
    "click",
    fitCanvas
  );

  onId(
    "fullscreenBtn",
    "click",
    toggleFullscreen
  );

  onId(
    "addLayerBtn",
    "click",
    addLayer
  );

  onId(
    "deleteLayerBtn",
    "click",
    deleteLayer
  );

  onId(
    "duplicateLayerBtn",
    "click",
    duplicateLayer
  );

  onId(
    "saveBtn",
    "click",
    saveCurrentToGallery
  );

  onId(
    "importBtn",
    "click",
    openImportDialog
  );

  onId(
    "exportBtn",
    "click",
    () => exportCanvas("png")
  );

  onId(
    "exportPngBtn",
    "click",
    () => exportCanvas("png")
  );

  onId(
    "exportJpgBtn",
    "click",
    () => exportCanvas("jpg")
  );

  onId(
    "exportWebpBtn",
    "click",
    () => exportCanvas("webp")
  );

  onId(
    "exportPdfBtn",
    "click",
    exportPDF
  );

  onId(
    "gridBtn",
    "click",
    toggleGrid
  );

  onId(
    "rulerBtn",
    "click",
    toggleRuler
  );

  onId(
    "perspectiveBtn",
    "click",
    togglePerspective
  );

  onId(
    "symmetryBtn",
    "click",
    toggleSymmetry
  );

  onId(
    "clearBtn",
    "click",
    clearCanvas
  );

  /*
    File input
  */

  const fileInput =
    byId("imageInput") ||
    byId("fileInput");

  if (fileInput) {
    on(
      fileInput,
      "change",
      () => {
        const file =
          fileInput.files?.[0];

        importImage(file);
      }
    );
  }

  /*
    New canvas modal buttons
  */

  onId(
    "createCanvasBtn",
    "click",
    createNewCanvasFromValues
  );

  onId(
    "confirmNewCanvas",
    "click",
    createNewCanvasFromValues
  );

  /*
    Modal close buttons
  */

  $$(
    "[data-close-modal]"
  ).forEach((button) => {
    on(
      button,
      "click",
      closeModals
    );
  });

  $$(
    ".modal-close"
  ).forEach((button) => {
    on(
      button,
      "click",
      closeModals
    );
  });

  /*
    Click outside modal
  */

  $$(".modal").forEach(
    (modal) => {
      on(
        modal,
        "click",
        (event) => {
          if (
            event.target ===
            modal
          ) {
            hide(modal);
          }
        }
      );
    }
  );

  /*
    Keyboard
  */

  on(
    document,
    "keydown",
    handleKeyboard
  );

  /*
    Drag and drop
  */

  setupDragDrop();

  /*
    Controls
  */

  setupColorInputs();
  setupRangeControls();
}


/* =========================================================
   MOBILE GESTURE SUPPORT
========================================================= */

let touchStartDistance = null;
let touchStartZoom = 1;

function setupTouchZoom() {
  if (!canvasWrap) return;

  on(
    canvasWrap,
    "touchstart",
    (event) => {
      if (
        event.touches.length === 2
      ) {
        touchStartDistance =
          getTouchDistance(
            event.touches[0],
            event.touches[1]
          );

        touchStartZoom =
          state.zoom;
      }
    },
    { passive: true }
  );

  on(
    canvasWrap,
    "touchmove",
    (event) => {
      if (
        event.touches.length !== 2 ||
        !touchStartDistance
      ) {
        return;
      }

      event.preventDefault();

      const distance =
        getTouchDistance(
          event.touches[0],
          event.touches[1]
        );

      const scale =
        distance /
        touchStartDistance;

      setZoom(
        touchStartZoom *
        scale
      );
    },
    { passive: false }
  );

  on(
    canvasWrap,
    "touchend",
    () => {
      touchStartDistance =
        null;
    },
    { passive: true }
  );
}


function getTouchDistance(
  first,
  second
) {
  const dx =
    first.clientX -
    second.clientX;

  const dy =
    first.clientY -
    second.clientY;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


/* =========================================================
   SELECT / ACTION FALLBACK
========================================================= */

function setupSelectActions() {
  $$("button").forEach(
    (button) => {
      if (
        button.dataset.boundOrigo
      ) {
        return;
      }

      const text =
        button.textContent
          .trim()
          .toLowerCase();

      /*
        We intentionally only handle
        obvious buttons here.
        Existing data-action/data-tool
        buttons were already handled above.
      */

      if (
        !button.dataset.action &&
        !button.dataset.tool
      ) {
        if (
          text === "undo"
        ) {
          on(button, "click", undo);
        }

        if (
          text === "redo"
        ) {
          on(button, "click", redo);
        }

        if (
          text === "clear"
        ) {
          on(
            button,
            "click",
            clearCanvas
          );
        }
      }

      button.dataset.boundOrigo =
        "true";
    }
  );
}


/* =========================================================
   RESIZE OBSERVER
========================================================= */

function setupResizeObserver() {
  if (
    typeof ResizeObserver ===
    "undefined"
  ) {
    return;
  }

  if (!canvasWrap) return;

  const observer =
    new ResizeObserver(() => {
      updateCanvasTransform();
    });

  observer.observe(
    canvasWrap
  );
}


/* =========================================================
   DEFAULT VALUES
========================================================= */

function loadSettings() {
  try {
    const saved =
      localStorage.getItem(
        "origo_settings"
      );

    if (!saved) return;

    const settings =
      JSON.parse(saved);

    if (
      Number.isFinite(
        settings.brushSize
      )
    ) {
      state.brushSize =
        settings.brushSize;
    }

    if (
      typeof settings.color ===
      "string"
    ) {
      state.color =
        settings.color;
    }

    if (
      Number.isFinite(
        settings.opacity
      )
    ) {
      state.opacity =
        settings.opacity;
    }
  } catch (error) {}
}


function saveSettings() {
  try {
    localStorage.setItem(
      "origo_settings",
      JSON.stringify({
        brushSize:
          state.brushSize,
        color:
          state.color,
        opacity:
          state.opacity
      })
    );
  } catch (error) {}
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   PERIODIC SETTINGS SAVE
========================================================= */

function setupSettingsPersistence() {
  setInterval(
    saveSettings,
    5000
  );
}


/* =========================================================
   INIT
========================================================= */

function init() {
  try {
    loadSettings();

    loadTheme();

    loadGallery();

    findCanvas();

    if (canvas) {
      createBlankCanvas(
        state.canvas.width,
        state.canvas.height,
        state.canvas.background
      );
    }

    initializeLayers();

    updateBrushSettings();

    updateColorInputs();

    setupEvents();

    setupTouchZoom();

    setupResizeObserver();

    setupSelectActions();

    renderGallery();

    renderShortcuts();

    updateGuideOverlay();

    setTool("brush");

    updateHistoryButtons();

    setupSettingsPersistence();

    console.log(
      "Origo Draw initialized successfully."
    );

    toast(
      "Origo Draw siap digunakan"
    );
  } catch (error) {
    /*
      IMPORTANT:
      A single missing HTML element should
      not make the entire application crash.
    */

    console.error(
      "Origo Draw initialization error:",
      error
    );

    toast(
      "Origo Draw mengalami error. Cek Console.",
      "error"
    );
  }
}


/* =========================================================
   START APPLICATION
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    {
      once: true
    }
  );
} else {
  init();
}


/* =========================================================
   GLOBAL API
   Allows HTML onclick attributes and
   future modules to use Origo Draw.
========================================================= */

window.OrigoDraw = {
  state,

  setTool,
  zoomIn,
  zoomOut,
  setZoom,
  resetView,
  fitCanvas,

  undo,
  redo,

  clearCanvas,

  openNewCanvas,
  createNewCanvasFromValues,

  importImage,
  openImportDialog,

  exportCanvas,
  exportPDF,

  saveCurrentToGallery,

  addLayer,
  deleteLayer,
  duplicateLayer,
  renameLayer,

  toggleGrid,
  toggleRuler,
  togglePerspective,
  toggleSymmetry,

  toggleTheme,

  openStudio,
  openLanding,

  closeModals,

  toast
};
