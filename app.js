/* =========================================================
   ORIGO DRAW — Lightweight Drawing Engine
   Mobile + Desktop
   ========================================================= */

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];

/* =========================
   BASIC CONFIG
   ========================= */

const presets = {
  A4: [2480, 3508],
  A3: [3508, 4961],
  A5: [1748, 2480],
  Square: [1200, 1200],
  Portrait: [800, 1200],
  Landscape: [1200, 800],
  "16:9": [1600, 900],
  "4:3": [1200, 900]
};

const shortcuts = [
  ["Ctrl + Z", "Undo"],
  ["Ctrl + Y", "Redo"],
  ["Ctrl + S", "Export"],
  ["B", "Brush"],
  ["P", "Pencil"],
  ["E", "Eraser"],
  ["G", "Fill"],
  ["I", "Eyedropper"],
  ["L", "Line"],
  ["R", "Rectangle"],
  ["O", "Circle"],
  ["T", "Text"],
  ["M", "Move"],
  ["C", "Crop"],
  ["F", "Fullscreen"],
  ["H", "Pan"],
  ["X", "Swap Colors"],
  ["D", "Reset Colors"],
  ["[ / ]", "Brush Size"],
  ["Delete", "Clear Layer"],
  ["Ctrl + Shift + N", "New Layer"],
  ["Ctrl + Shift + E", "Merge Layer"],
  ["Esc", "Close"]
];

if ($("shortcutList")) {
  $("shortcutList").innerHTML = shortcuts
    .map(
      s =>
        `<div class="shortcut">
          <span>${s[1]}</span>
          <kbd>${s[0]}</kbd>
        </div>`
    )
    .join("");
}

const features = [
  ["✏️", "Sketch", "Pencil, pen and marker"],
  ["🎨", "Coloring", "Fill, picker and palette"],
  ["◐", "Shadowing", "Shadow and highlight"],
  ["⌁", "Perspective", "Perspective guides"],
  ["▱", "Layers", "Independent editable layers"],
  ["🖼️", "Import Images", "JPG, PNG and WEBP"],
  ["⇩", "Export", "PNG, JPG, WEBP"],
  ["◎", "Symmetry", "Vertical, horizontal and radial"]
];

if ($("featureGrid")) {
  $("featureGrid").innerHTML = features
    .map(
      x =>
        `<div class="feature-card">
          <b>${x[0]} ${x[1]}</b>
          <span>${x[2]}</span>
        </div>`
    )
    .join("");
}

/* =========================
   CANVAS
   ========================= */

const canvas = $("canvas");

if (!canvas) {
  throw new Error("Origo Draw: #canvas tidak ditemukan.");
}

const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const guide = $("guideCanvas");
const gctx = guide
  ? guide.getContext("2d")
  : null;

const maxPixels =
  innerWidth < 700
    ? 3000000
    : 6000000;

/* =========================
   STATE
   ========================= */

const state = {
  w: 1200,
  h: 800,

  zoom: 1,
  rotation: 0,

  tool: "pencil",

  color: "#000000",
  bgColor: "#ffffff",

  size: 8,
  opacity: 1,
  hardness: 0.8,
  flow: 1,
  smooth: 0.2,

  drawing: false,
  last: null,
  start: null,

  history: [],
  future: [],

  layers: [],
  active: 0,

  symmetry: "none",
  perspective: false,

  viewX: 0,
  viewY: 0,

  pan: false,

  cropRect: null
};

/* =========================
   HELPERS
   ========================= */

function toast(message) {
  const element = $("toast");

  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, 1800);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );
}

function clampCanvas(w, h) {
  const pixels = w * h;

  if (pixels <= maxPixels) {
    return [w, h];
  }

  const scale = Math.sqrt(maxPixels / pixels);

  return [
    Math.max(1, Math.floor(w * scale)),
    Math.max(1, Math.floor(h * scale))
  ];
}

function activeLayer() {
  return state.layers[state.active];
}

function layerContext(layer) {
  return layer.canvas.getContext("2d", {
    willReadFrequently: true
  });
}

/* =========================
   LAYERS
   ========================= */

function createLayer(name) {
  const layerCanvas = document.createElement("canvas");

  layerCanvas.width = state.w;
  layerCanvas.height = state.h;

  return {
    name,
    visible: true,
    locked: false,
    opacity: 1,
    canvas: layerCanvas
  };
}

function composite() {
  ctx.clearRect(0, 0, state.w, state.h);

  for (const layer of state.layers) {
    if (!layer.visible) continue;

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  }
}

function serializeLayers() {
  return state.layers.map(layer => ({
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    data: layer.canvas.toDataURL("image/png")
  }));
}

function restoreLayers(data) {
  if (!Array.isArray(data)) return;

  state.layers = data.map(item => {
    const layer = createLayer(item.name || "Layer");

    layer.visible = item.visible !== false;
    layer.locked = item.locked === true;
    layer.opacity =
      typeof item.opacity === "number"
        ? item.opacity
        : 1;

    const image = new Image();

    image.onload = () => {
      layerContext(layer).drawImage(
        image,
        0,
        0
      );

      composite();
      renderLayers();
    };

    image.src = item.data;

    return layer;
  });

 
