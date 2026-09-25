/* =========================================================
   ORIGO DRAW — APP.JS
   Stable complete version
   ========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const $$ = s => [...document.querySelectorAll(s)];

  const canvas = $("canvas");
  const guideCanvas = $("guideCanvas");

  if (!canvas) {
    console.error("Origo Draw: #canvas tidak ditemukan.");
    return;
  }

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  const gctx = guideCanvas
    ? guideCanvas.getContext("2d")
    : null;

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

    shadowIntensity: 50,
    shadowSoftness: 50,

    drawing: false,
    startPoint: null,
    lastPoint: null,

    zoom: 1,
    rotation: 0,

    panMode: false,
    panStart: null,

    symmetry: "none",

    perspective: false,
    perspectiveType: "1 Point",

    layers: [],
    activeLayer: 0,

    history: [],
    future: [],

    background: "white",

    maxHistory: 8
  };

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

  function safeSize(width, height) {
    width = Math.max(
      100,
      Math.floor(Number(width) || 1200)
    );

    height = Math.max(
      100,
      Math.floor(Number(height) || 800)
    );

    const max =
      window.innerWidth < 700
        ? 3000000
        : 6000000;

    if (width * height <= max) {
      return [width, height];
    }

    const scale =
      Math.sqrt(
        max / (width * height)
      );

    return [
      Math.floor(width * scale),
      Math.floor(height * scale)
    ];
  }

  function hexToRgba(hex) {
    hex = String(
      hex || "#000000"
    ).replace("#", "");

    if (hex.length === 3) {
      hex = hex
        .split("")
        .map(x => x + x)
        .join("");
    }

    const n = parseInt(hex, 16);

    return [
      (n >> 16) & 255,
      (n >> 8) & 255,
      n & 255,
      255
    ];
  }

  function activeLayer() {
    return state.layers[
      state.activeLayer
    ];
  }

  function activeContext() {
    const layer = activeLayer();

    if (!layer) return null;

    return layer.canvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );
  }

  function createLayer(
    name = "Layer"
  ) {
    const c =
      document.createElement("canvas");

    c.width = state.width;
    c.height = state.height;

    return {
      name,
      canvas: c,
      visible: true,
      locked: false,
      opacity: 1
    };
  }

  function composite() {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (
      state.background === "white"
    ) {
      ctx.fillStyle = "#ffffff";

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    for (
      const layer of state.layers
    ) {
      if (!layer.visible) continue;

      ctx.save();

      ctx.globalAlpha =
        layer.opacity;

      ctx.drawImage(
        layer.canvas,
        0,
        0
      );

      ctx.restore();
    }

    drawGuides();
  }

  function renderLayers() {
    const list = $("layers");

    if (!list) return;

    list.innerHTML = "";

    [
      ...state.layers
    ]
      .map((layer, index) => ({
        layer,
        index
      }))
      .reverse()
      .forEach(
        ({ layer, index }) => {
          const item =
            document.createElement(
              "div"
            );

          item.className =
            "layer-item" +
            (
              index ===
              state.activeLayer
                ? " active"
                : ""
            );

          const thumb =
            document.createElement(
              "div"
            );

          thumb.className =
            "layer-thumb";

          thumb.style.backgroundImage =
            `url(${layer.canvas.toDataURL(
              "image/png"
            )})`;

          const name =
            document.createElement(
              "div"
            );

          name.className =
            "layer-name";

          name.textContent =
            layer.name;

          const eye =
            document.createElement(
              "button"
            );

          eye.type = "button";

         
