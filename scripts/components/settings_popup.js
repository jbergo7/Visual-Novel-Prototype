export default class SettingsPopup {
  constructor(core) {
    this.core = core;
    this.visible = false;
    this.baseWidth = 1920;
    this.baseHeight = 1080;

    // 🔥 REMOVED: Local 'this.settings' state.
    // We will now access 'this.core.settings' directly everywhere.

    // UI Elements State
    this.draggingSlider = null; // 'masterVolume', 'musicVolume', 'sfxVolume', 'textSpeed'
    this.hoverClose = false;

    // Bind handlers
    this._moveHandler = (e) => this.onMouseMove(e);
    this._clickHandler = (e) => this.onClick(e);
    this._upHandler = () => this.onMouseUp();

    this.core.canvas.addEventListener("mousemove", this._moveHandler);
    this.core.canvas.addEventListener("mousedown", this._clickHandler);
    window.addEventListener("mouseup", this._upHandler);
  }

  dispose() {
    this.core.canvas.removeEventListener("mousemove", this._moveHandler);
    this.core.canvas.removeEventListener("mousedown", this._clickHandler);
    window.removeEventListener("mouseup", this._upHandler);
  }

  open() {
    this.visible = true;
  }

  close() {
    this.visible = false;
    this.draggingSlider = null;
  }

  // --- HELPERS (Styling) ---
  hexToRgba(color, alpha = 1) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    if (color.startsWith("rgba")) return color;
    if (color[0] === "#") {
      let r = parseInt(color.slice(1, 3), 16),
        g = parseInt(color.slice(3, 5), 16),
        b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  resolveRadius(rawRadius, scale) {
    if (Array.isArray(rawRadius) && rawRadius.length === 4)
      return rawRadius.map((r) => r * scale);
    const s = typeof rawRadius === "number" ? rawRadius * scale : 0;
    return [s, s, s, s];
  }

  drawStyledBox(ctx, x, y, w, h, thickness, radii, bgColor, borderColor) {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, radii);
    else ctx.rect(x, y, w, h);
    ctx.fill();

    if (thickness > 0) {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = borderColor;
      ctx.stroke();
    }
  }

  // --- LAYOUT CALCULATION ---
  getLayout() {
    const canvas = this.core.canvas;
    const gui = this.core.dataCache?.gameGUI?.gui_settings || {};
    const scaleX = canvas.width / this.baseWidth;
    const scaleY = canvas.height / this.baseHeight;

    const w = (gui.gui_settings_Width || 900) * scaleX;
    const h = (gui.gui_settings_Height || 700) * scaleY;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    const padding = (gui.gui_settings_Padding || 40) * scaleX;

    // Close Button
    const closeSize = 40 * scaleX;
    const closeX = x + w - padding - closeSize;
    const closeY = y + padding / 2;

    // Content Start
    let contentY =
      y + (gui.gui_settings_TitleFontSize || 40) * scaleY + padding * 2;
    const gap = (gui.gui_settings_Gap || 30) * scaleY;
    const labelW = 250 * scaleX;
    const sliderW = 400 * scaleX;
    const sliderH = 30 * scaleY;

    // Controls Layout
    const controls = [
      { id: "masterVolume", label: "Master Volume" },
      { id: "musicVolume", label: "Music Volume" },
      { id: "sfxVolume", label: "SFX Volume" },
      { id: "textSpeed", label: "Text Speed" },
    ];

    const items = controls.map((c, i) => ({
      ...c,
      x: x + padding,
      y: contentY + i * (sliderH + gap),
      w: sliderW,
      h: sliderH,
      labelW: labelW,
    }));

    // Toggle (Fullscreen)
    const toggleY = contentY + items.length * (sliderH + gap) + gap;
    const toggle = {
      id: "fullscreen",
      label: "Fullscreen",
      x: x + padding,
      y: toggleY,
      w: 60 * scaleX,
      h: 30 * scaleY,
      labelW: labelW,
    };

    return {
      x,
      y,
      w,
      h,
      padding,
      close: { x: closeX, y: closeY, size: closeSize },
      items,
      toggle,
      scaleX,
      gui,
    };
  }

  // --- INPUT HANDLING ---
  onMouseMove(e) {
    if (!this.visible) return;
    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const L = this.getLayout();

    // Close Button Hover
    this.hoverClose =
      mx >= L.close.x &&
      mx <= L.close.x + L.close.size &&
      my >= L.close.y &&
      my <= L.close.y + L.close.size;

    // Dragging Logic
    if (this.draggingSlider) {
      const item = L.items.find((i) => i.id === this.draggingSlider);
      if (item) {
        const sliderX = item.x + item.labelW;
        let pct = (mx - sliderX) / item.w;
        pct = Math.max(0, Math.min(1, pct));

        // 🔥 UPDATE CORE SETTINGS DIRECTLY
        if (this.core.settings) {
          this.core.settings[this.draggingSlider] = Math.round(pct * 100);

          // 🔥 FIXED: Notify Audio Manager
          // Kapag Master, Music, o SFX ang ginalaw, update agad ang volume.
          if (this.draggingSlider.includes("Volume")) {
            this.core.audioManager.updateVolumes();
          }
        }
      }
    }
  }

  onClick(e) {
    if (!this.visible) return;
    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const L = this.getLayout();

    // Close Click
    if (this.hoverClose) {
      this.core.audioManager.playSFX("click");
      this.close();
      return;
    }

    // Sliders Click (Start Drag)
    L.items.forEach((item) => {
      const sliderX = item.x + item.labelW;
      // Check if clicking on the slider track/knob area
      if (
        mx >= sliderX - 10 &&
        mx <= sliderX + item.w + 10 &&
        my >= item.y &&
        my <= item.y + item.h
      ) {
        this.draggingSlider = item.id;
        // Update immediately on click
        let pct = (mx - sliderX) / item.w;
        pct = Math.max(0, Math.min(1, pct));

        // 🔥 UPDATE CORE SETTINGS DIRECTLY
        if (this.core.settings) {
          this.core.settings[item.id] = Math.round(pct * 100);

          // 🔥 FIXED: Notify Audio Manager
          if (item.id.includes("Volume")) {
            this.core.audioManager.updateVolumes();
          }
        }
      }
    });

    // Toggle Click
    const t = L.toggle;
    const toggleX = t.x + t.labelW;
    if (mx >= toggleX && mx <= toggleX + t.w && my >= t.y && my <= t.y + t.h) {
      // 🔥 UPDATE CORE SETTINGS DIRECTLY
      if (this.core.settings) {
        this.core.audioManager.playSFX("click");
        this.core.settings.fullscreen = !this.core.settings.fullscreen;
        if (this.core.settings.fullscreen) {
          if (document.documentElement.requestFullscreen)
            document.documentElement.requestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      }
    }
  }

  onMouseUp() {
    this.draggingSlider = null;
  }

  // --- RENDER ---
  render(ctx) {
    if (!this.visible) return;
    const L = this.getLayout();
    const gui = L.gui;

    // Overlay
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, this.core.canvas.width, this.core.canvas.height);

    // Window
    const bg = this.hexToRgba(
      gui.gui_settings_BackgroundColor || "#fef1e1",
      gui.gui_settings_Opacity || 0.98
    );
    const border = gui.gui_settings_BorderColor || "#ffcc95";
    const thick = (gui.gui_settings_BorderThickness || 5) * L.scaleX;
    const radii = this.resolveRadius(
      gui.gui_settings_BorderCorner || 20,
      L.scaleX
    );
    this.drawStyledBox(ctx, L.x, L.y, L.w, L.h, thick, radii, bg, border);

    // Title
    ctx.fillStyle = gui.gui_settings_TitleColor || "#43321e";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${
      (gui.gui_settings_TitleFontSize || 40) * L.scaleX
    }px Arial`;
    ctx.fillText("Settings", L.x + L.padding, L.y + L.padding + 10);

    // Close Button
    this.drawStyledBox(
      ctx,
      L.close.x,
      L.close.y,
      L.close.size,
      L.close.size,
      2,
      [5, 5, 5, 5],
      this.hoverClose ? "#ff5555" : "#c83232",
      "#fff"
    );
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `bold ${L.close.size * 0.6}px Arial`;
    ctx.fillText(
      "X",
      L.close.x + L.close.size / 2,
      L.close.y + L.close.size / 2 + 2
    );

    // Sliders
    const labelColor = gui.gui_settings_LabelColor || "#43321e";
    const trackColor = gui.gui_settings_SliderTrackColor || "#cca383";
    const knobColor = gui.gui_settings_SliderKnobColor || "#8f5e30";

    L.items.forEach((item) => {
      // Label
      ctx.fillStyle = labelColor;
      ctx.textAlign = "left";
      ctx.font = `bold ${24 * L.scaleX}px Arial`;
      ctx.fillText(item.label, item.x, item.y + item.h / 2);

      // Track
      const sliderX = item.x + item.labelW;
      const trackH = 8 * L.scaleX;
      const trackY = item.y + (item.h - trackH) / 2;
      this.drawStyledBox(
        ctx,
        sliderX,
        trackY,
        item.w,
        trackH,
        0,
        [4, 4, 4, 4],
        trackColor,
        "transparent"
      );

      // Fill (Active part)
      // 🔥 READ FROM CORE SETTINGS
      const val = this.core.settings ? this.core.settings[item.id] : 50;

      const fillW = (val / 100) * item.w;
      this.drawStyledBox(
        ctx,
        sliderX,
        trackY,
        fillW,
        trackH,
        0,
        [4, 4, 4, 4],
        knobColor,
        "transparent"
      );

      // Knob
      const knobSize = 24 * L.scaleX;
      const knobX = sliderX + fillW - knobSize / 2;
      const knobY = item.y + (item.h - knobSize) / 2;
      this.drawStyledBox(
        ctx,
        knobX,
        knobY,
        knobSize,
        knobSize,
        1,
        [12, 12, 12, 12],
        "#fff",
        knobColor
      );
    });

    // Toggle (Fullscreen)
    const t = L.toggle;
    ctx.fillStyle = labelColor;
    ctx.textAlign = "left";
    ctx.fillText(t.label, t.x, t.y + t.h / 2);

    const toggleX = t.x + t.labelW;

    // 🔥 READ FROM CORE SETTINGS
    const isOn = this.core.settings ? this.core.settings.fullscreen : false;

    const toggleBg = isOn ? "#4cd137" : "#7f8c8d";

    // Toggle Track
    this.drawStyledBox(
      ctx,
      toggleX,
      t.y,
      t.w,
      t.h,
      0,
      [15, 15, 15, 15],
      toggleBg,
      "transparent"
    );

    // Toggle Circle
    const circleSize = t.h - 6;
    const circleX = isOn ? toggleX + t.w - circleSize - 3 : toggleX + 3;
    const circleY = t.y + 3;
    this.drawStyledBox(
      ctx,
      circleX,
      circleY,
      circleSize,
      circleSize,
      0,
      [15, 15, 15, 15],
      "#fff",
      "transparent"
    );
  }
}
