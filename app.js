/* =========================================================
   ORIGO DRAW — FINAL APP.JS
   ========================================================= */

"use strict";

/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];

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

/* =========================================================
   CANVAS
   ========================================================= */

const canvas = $("canvas");

if (!canvas) {
  console.error("Origo Draw: canvas tidak ditemukan.");
} else {

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

/* =========================================================
   STATE
   ========================================================= */

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
  panStart: null,

  cropRect: null
};

/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}

/* =========================================================
   FEATURES
   ========================================================= */

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
  $("featureGrid").innerHTML = features.map(x => `
    <div class="feature-card">
      <div class="icon">${x[0]}</div>
      <h3>${x[1]}</h3>
      <p>${x[2]}</p>
    </div>
  `).join("");
}

/* =========================================================
   SHORTCUTS
   ========================================================= */

if ($("shortcutList")) {
  $("shortcutList").innerHTML = shortcuts.map(s => `
    <div class="shortcut-item">
      <span>${s[1]}</span>
      <kbd class="shortcut-key">${s[0]}</kbd>
    </div>
  `).join("");
}

/* =========================================================
   CANVAS HELPERS
   ========================================================= */

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

/* =========================================================
   LAYERS
   ========================================================= */

function createLayer(name) {
  const c = document.createElement("canvas");

  c.width = state.w;
  c.height = state.h;

  return {
    name: name || "Layer",
    visible: true,
    locked: false,
    opacity: 1,
    canvas: c
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

  state.layers = [];

  if (!data.length) {
    state.layers.push(createLayer("Layer 1"));
  }

  let loaded = 0;

  data.forEach(item => {
    const layer = createLayer(item.name || "Layer");

    layer.visible = item.visible !== false;
    layer.locked = item.locked === true;
    layer.opacity =
      typeof item.opacity === "number"
        ? item.opacity
        : 1;

    state.layers.push(layer);

    const image = new Image();

    image.onload = () => {
      layerContext(layer).drawImage(image, 0, 0);

      loaded++;

      if (loaded === data.length) {
        state.active = Math.min(
          state.active,
          state.layers.length - 1
        );

        composite();
        renderLayers();
      }
    };

    image.src = item.data;
  });

  renderLayers();
}

function pushHistory() {
  state.history.push(serializeLayers());

  if (state.history.length > 15) {
    state.history.shift();
  }

  state.future = [];
}

function undo() {
  if (!state.history.length) {
    toast("Nothing to undo");
    return;
  }

  state.future.push(serializeLayers());

  const previous = state.history.pop();

  restoreLayers(previous);

  toast("Undo");
}

function redo() {
  if (!state.future.length) {
    toast("Nothing to redo");
    return;
  }

  state.history.push(serializeLayers());

  const next = state.future.pop();

  restoreLayers(next);

  toast("Redo");
}

/* =========================================================
   LAYER UI
   ========================================================= */

function renderLayers() {
  const list = $("layers");

  if (!list) return;

  list.innerHTML = "";

  [...state.layers]
    .map((layer, index) => ({ layer, index }))
    .reverse()
    .forEach(({ layer, index }) => {

      const item = document.createElement("div");

      item.className =
        "layer-item" +
        (index === state.active
          ? " active"
          : "");

      item.innerHTML = `
        <div class="layer-thumb"></div>

        <div class="layer-name">
          ${escapeHtml(layer.name)}
        </div>

        <button
          class="icon-btn layer-eye"
          type="button"
          title="Visibility">
          ${layer.visible ? "◉" : "○"}
        </button>
      `;

      item.addEventListener("click", e => {
        if (
          e.target.closest(".layer-eye")
        ) {
          layer.visible = !layer.visible;

          composite();
          renderLayers();

          return;
        }

        state.active = index;

        const opacity =
          $("layerOpacity");

        if (opacity) {
          opacity.value =
            Math.round(
              layer.opacity * 100
            );
        }

        renderLayers();

        toast(layer.name);
      });

      list.appendChild(item);
    });

  const opacity = $("layerOpacity");

  if (opacity && activeLayer()) {
    opacity.value =
      Math.round(
        activeLayer().opacity * 100
      );
  }
}

function addLayer() {
  pushHistory();

  const layer =
    createLayer(
      `Layer ${state.layers.length}`
    );

  state.layers.push(layer);

  state.active =
    state.layers.length - 1;

  renderLayers();

  toast("Layer added");
}

function duplicateLayer() {
  const source = activeLayer();

  if (!source) return;

  pushHistory();

  const copy =
    createLayer(
      `${source.name} Copy`
    );

  copy.visible =
    source.visible;

  copy.locked =
    source.locked;

  copy.opacity =
    source.opacity;

  layerContext(copy).drawImage(
    source.canvas,
    0,
    0
  );

  state.layers.splice(
    state.active + 1,
    0,
    copy
  );

  state.active++;

  renderLayers();
  composite();

  toast("Layer duplicated");
}

function deleteLayer() {
  if (state.layers.length <= 1) {
    toast("At least one layer is required");
    return;
  }

  pushHistory();

  state.layers.splice(
    state.active,
    1
  );

  state.active = Math.max(
    0,
    Math.min(
      state.active,
      state.layers.length - 1
    )
  );

  renderLayers();
  composite();

  toast("Layer deleted");
}

function mergeLayer() {
  if (state.active <= 0) {
    toast("No layer below");
    return;
  }

  const upper =
    state.layers[state.active];

  const lower =
    state.layers[state.active - 1];

  if (
    upper.locked ||
    lower.locked
  ) {
    toast("Layer is locked");
    return;
  }

  pushHistory();

  const lowerCtx =
    layerContext(lower);

  lowerCtx.save();

  lowerCtx.globalAlpha =
    upper.opacity;

  lowerCtx.drawImage(
    upper.canvas,
    0,
    0
  );

  lowerCtx.restore();

  state.layers.splice(
    state.active,
    1
  );

  state.active--;

  renderLayers();
  composite();

  toast("Layers merged");
}

/* =========================================================
   CANVAS SETUP
   ========================================================= */

function setupCanvas(
  width = 1200,
  height = 800,
  background = "white"
) {
  [width, height] =
    clampCanvas(width, height);

  state.w = width;
  state.h = height;

  canvas.width = width;
  canvas.height = height;

  if (guide) {
    guide.width = width;
    guide.height = height;
  }

  state.layers = [];

  const backgroundLayer =
    createLayer("Background");

  const bg =
    layerContext(backgroundLayer);

  if (background === "white") {
    bg.fillStyle = "#ffffff";
    bg.fillRect(0, 0, width, height);
  }

  if (background === "green") {
    bg.fillStyle = "#00a86b";
    bg.fillRect(0, 0, width, height);
  }

  if (background === "custom") {
    bg.fillStyle =
      $("bgColor")?.value ||
      "#ffffff";

    bg.fillRect(0, 0, width, height);
  }

  if (background !== "transparent") {
    backgroundLayer.locked = true;
  }

  state.layers.push(backgroundLayer);

  state.layers.push(
    createLayer("Layer 1")
  );

  state.active = 1;

  state.history = [];
  state.future = [];

  composite();
  renderLayers();
  fitCanvas();

  saveProjectAuto();

  toast("Canvas created");
}

/* =========================================================
   VIEW
   ========================================================= */

function fitCanvas() {
  const area =
    $("canvasArea") ||
    canvas.parentElement;

  if (!area) return;

  const rect =
    area.getBoundingClientRect();

  const horizontal =
    Math.max(
      50,
      rect.width - 80
    ) / state.w;

  const vertical =
    Math.max(
      50,
      rect.height - 120
    ) / state.h;

  state.zoom = Math.min(
    horizontal,
    vertical,
    1
  );

  state.viewX = 0;
  state.viewY = 0;

  renderView();
}

function renderView() {
  const elements =
    [canvas, guide].filter(Boolean);

  elements.forEach(element => {
    element.style.width =
      `${state.w * state.zoom}px`;

    element.style.height =
      `${state.h * state.zoom}px`;

    element.style.position =
      "absolute";

    element.style.left = "50%";
    element.style.top = "50%";

    element.style.transform =
      `translate(-50%, -50%)
       rotate(${state.rotation}deg)
       translate(
         ${state.viewX / state.zoom}px,
         ${state.viewY / state.zoom}px
       )`;
  });

  const zoomLabel =
    $("zoomLabel") ||
    $("zoomValue");

  if (zoomLabel) {
    zoomLabel.textContent =
      `${Math.round(state.zoom * 100)}%`;
  }

  drawGuides();
}

function changeZoom(amount) {
  state.zoom =
    Math.max(
      0.05,
      Math.min(
        8,
        state.zoom + amount
      )
    );

  renderView();
}

/* =========================================================
   POINTER POSITION
   ========================================================= */

function pointerPosition(event) {
  const rect =
    canvas.getBoundingClientRect();

  return {
    x:
      (event.clientX - rect.left) /
      state.zoom,

    y:
      (event.clientY - rect.top)
