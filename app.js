/* =========================================================
   ORIGO DRAW — APP.JS
   Complete working version
   ========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     HELPERS
  ======================================================= */

  const $ = id => document.getElementById(id);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const canvas = $("canvas");
  const guideCanvas = $("guideCanvas");

  if (!canvas) {
    console.error("Origo Draw: canvas tidak ditemukan.");
    return;
  }

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  const gctx = guideCanvas
    ? guideCanvas.getContext("2d")
    : null;

  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    width: 1200,
    height: 800,

    tool: "pencil",

    color: "#000000",
    previousColor: "#ffffff",

    size: 8,
    opacity: 1,
    hardness: 80,
    flow: 100,
    smoothing: 20,

    drawing: false,
    startPoint: null,
    lastPoint: null,

    zoom: 1,
    rotation: 0,

    symmetry: "none",
    perspective: false,
    perspectiveType: "1 Point",

    layers: [],
    activeLayer: 0,

    history: [],
    future: [],

    panMode: false,
    panStart: null,

    background: "white"
  };

  /* =======================================================
     TOAST
     ======================================================= */

  let toastTimer;

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 1600);
  }

  /* =======================================================
     FEATURES
     ======================================================= */

  const features = [
    ["✏️", "Sketch", "Pencil, pen and marker"],
    ["🎨", "Coloring", "Fill and color picker"],
    ["◐", "Shadowing", "Shadow and highlight"],
    ["⌁", "Perspective", "1, 2 and 3 point guides"],
    ["▱", "Layers", "Multiple editable layers"],
    ["🖼️", "Import Images", "PNG, JPG and WEBP"],
    ["⇩", "Export", "PNG, JPG and WEBP"],
    ["◎", "Symmetry", "Vertical, horizontal and radial"]
  ];

  const featureGrid = $("featureGrid");

  if (featureGrid) {
    featureGrid.innerHTML = features.map(item => `
      <div class="feature-card">
        <div class="icon">${item[0]}</div>
        <h3>${item[1]}</h3>
        <p>${item[2]}</p>
      </div>
    `).join("");
  }

  /* =======================================================
     SHORTCUTS
     ======================================================= */

  const shortcuts = [
    ["B", "Brush"],
    ["P", "Pencil"],
    ["E", "Eraser"],
    ["G", "Fill"],
    ["I", "Color Picker"],
    ["L", "Line"],
    ["R", "Rectangle"],
    ["O", "Circle"],
    ["T", "Text"],
    ["M", "Move"],
    ["C", "Crop"],
    ["H", "Pan"],
    ["F", "Fullscreen"],
    ["X", "Swap Colors"],
    ["D", "Reset Colors"],
    ["[ / ]", "Brush Size"],
    ["Ctrl + Z", "Undo"],
    ["Ctrl + Y", "Redo"],
    ["Ctrl + Shift + N", "New Layer"],
    ["Ctrl + Shift + E", "Merge Layer"],
    ["Delete", "Clear Layer"],
    ["Esc", "Close Modal"]
  ];

  const shortcutList = $("shortcutList");

  if (shortcutList) {
    shortcutList.innerHTML = shortcuts.map(item => `
      <div class="shortcut-item">
        <span>${item[1]}</span>
        <kbd class="shortcut-key">${item[0]}</kbd>
      </div>
    `).join("");
  }

  /* =======================================================
     CANVAS LIMIT
     ======================================================= */

  function safeSize(width, height) {
    const maxPixels =
      window.innerWidth < 700
        ? 3000000
        : 6000000;

    const pixels = width * height;

    if (pixels <= maxPixels) {
      return [width, height];
    }

    const scale = Math.sqrt(
      maxPixels / pixels
    );

    return [
      Math.floor(width * scale),
      Math.floor(height * scale)
    ];
  }

  /* =======================================================
     LAYERS
     ======================================================= */

  function createLayer(name) {
    const layerCanvas =
      document.createElement("canvas");

    layerCanvas.width = state.width;
    layerCanvas.height = state.height;

    return {
      name: name || "Layer",
      canvas: layerCanvas,
      visible: true,
      locked: false,
      opacity: 1
    };
  }

  function getActiveLayer() {
    return state.layers[state.activeLayer];
  }

  function getLayerContext(layer) {
    return layer.canvas.getContext("2d", {
      willReadFrequently: true
    });
  }

  /* =======================================================
     COMPOSITE
     ======================================================= */

  function composite() {
    ctx.clearRect(
      0,
      0,
      state.width,
      state.height
    );

    for (const layer of state.layers) {

      if (!layer.visible) continue;

      ctx.save();

      ctx.globalAlpha = layer.opacity;

      ctx.drawImage(
        layer.canvas,
        0,
        0
      );

      ctx.restore();
    }
  }

  /* =======================================================
     LAYER UI
     ======================================================= */

  function renderLayers() {

    const list = $("layers");

    if (!list) return;

    list.innerHTML = "";

    [...state.layers]
      .map((layer, index) => ({
        layer,
        index
      }))
      .reverse()
      .forEach(({ layer, index }) => {

        const item =
          document.createElement("div");

        item.className =
          "layer-item" +
          (
            index === state.activeLayer
              ? " active"
              : ""
          );

        const thumb =
          document.createElement("div");

        thumb.className = "layer-thumb";

        const name =
          document.createElement("div");

        name.className = "layer-name";
        name.textContent = layer.name;

        const eye =
          document.createElement("button");

        eye.className =
          "icon-btn layer-eye";

        eye.type = "button";

        eye.textContent =
          layer.visible ? "◉" : "○";

        eye.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            layer.visible =
              !layer.visible;

            composite();
            renderLayers();

          }
        );

        item.appendChild(thumb);
        item.appendChild(name);
        item.appendChild(eye);

        item.addEventListener(
          "click",
          () => {

            state.activeLayer = index;

            const opacity =
              $("layerOpacity");

            if (opacity) {
              opacity.value =
                Math.round(
                  layer.opacity * 100
                );
            }

            renderLayers();
          }
        );

        list.appendChild(item);
      });

    const opacity =
      $("layerOpacity");

    const active =
      getActiveLayer();

    if (opacity && active) {
      opacity.value =
        Math.round(
          active.opacity * 100
        );
    }
  }

  /* =======================================================
     HISTORY
     ======================================================= */

  function snapshot() {

    const data =
      state.layers.map(layer => ({
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        image:
          layer.canvas.toDataURL("image/png")
      }));

    state.history.push(data);

    if (state.history.length > 20) {
      state.history.shift();
    }

    state.future = [];
  }

  function restoreSnapshot(data) {

    if (!Array.isArray(data)) return;

    state.layers = [];

    let remaining = data.length;

    if (!remaining) {
      state.layers.push(
