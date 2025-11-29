export default class MenuPopup {
  constructor(core) {
    this.core = core;
    this.visible = false;

    // Base Resolution
    this.baseWidth = 1920;
    this.baseHeight = 1080;

    this.buttons = [
      { text: "Resume", id: "resume" },
      { text: "Load Game", id: "load" },
      { text: "Save Game", id: "save" },
      { text: "Settings", id: "settings" },
      { text: "Title Screen", id: "title" },
    ];

    this.hoverIndex = -1;

    // --- Image Caching ---
    this.imageCache = {};
    this.failedImages = new Set();

    // Cached Layout for Hit Detection
    this.layoutCache = {
      buttons: [], // Array of {x, y, w, h}
    };

    this._moveHandler = (e) => this.onMouseMove(e);
    this._clickHandler = (e) => this.onClick(e);

    this.core.canvas.addEventListener("mousemove", this._moveHandler);
    this.core.canvas.addEventListener("click", this._clickHandler);
  }

  dispose() {
    this.core.canvas.removeEventListener("mousemove", this._moveHandler);
    this.core.canvas.removeEventListener("click", this._clickHandler);
  }

  open() {
    this.visible = true;
  }

  close() {
    this.visible = false;
    this.hoverIndex = -1;
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  /* -------------------------
       ---------- IMAGE HELPERS ----------
       ------------------------- */
  _loadImage(src) {
    if (!src) return null;
    if (this.failedImages.has(src)) return null;
    const existing = this.imageCache[src];
    if (existing) return existing;

    const img = new Image();
    img.onerror = () => {
      this.failedImages.add(src);
      delete this.imageCache[src];
    };
    img.onload = () => {
      if (img.naturalWidth === 0) {
        this.failedImages.add(src);
        delete this.imageCache[src];
      }
    };
    img.src = src;
    this.imageCache[src] = img;
    return img;
  }

  /* -------------------------
       ---------- DRAWING HELPERS ----------
       ------------------------- */

  hexToRgba(color, alpha = 1) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    if (color.startsWith("rgba")) return color;
    if (color.startsWith("rgb")) return color;

    if (color[0] === "#") {
      let r, g, b;
      if (color.length === 4) {
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  resolveRadius(rawRadius, scale) {
    if (Array.isArray(rawRadius) && rawRadius.length === 4) {
      return rawRadius.map((r) => r * scale);
    }
    const scaled =
      typeof rawRadius === "number" && rawRadius >= 0 ? rawRadius * scale : 0;
    return [scaled, scaled, scaled, scaled];
  }

  drawStyledBox(ctx, x, y, w, h, thickness, radii, bgColor, borderColor) {
    const resolved = Array.isArray(radii)
      ? radii
      : [radii, radii, radii, radii];
    const [tl, tr, br, bl] = resolved;
    const hasRadius = tl > 0 || tr > 0 || br > 0 || bl > 0;

    // Draw Background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (hasRadius) {
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, resolved);
      else ctx.rect(x, y, w, h); // Fallback
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // Draw Border
    if (thickness > 0) {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = borderColor;
      const overlap = 1;
      const offset = thickness / 2 - overlap;
      const bx = x - offset;
      const by = y - offset;
      const bw = w + thickness - overlap * 2;
      const bh = h + thickness - overlap * 2;
      const outerRadii = resolved.map((r) => (r > 0 ? r + offset : 0));

      ctx.beginPath();
      if (hasRadius) {
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, outerRadii);
        else ctx.rect(bx, by, bw, bh);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.stroke();
    }
  }

  /* -------------------------
       ---------- INPUT HANDLING ----------
       ------------------------- */

  onMouseMove(e) {
    if (!this.visible) return;

    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.hoverIndex = -1;

    // Check collision using cached layout from render
    this.layoutCache.buttons.forEach((btn, i) => {
      if (
        mouseX >= btn.x &&
        mouseX <= btn.x + btn.w &&
        mouseY >= btn.y &&
        mouseY <= btn.y + btn.h
      ) {
        this.hoverIndex = i;
      }
    });
  }

  onClick(e) {
    if (!this.visible) return;

    const index = this.hoverIndex;
    if (index === -1) return;

    const btn = this.buttons[index];

    switch (btn.id) {
      case "resume":
        this.close();
        break;

      case "load":
        this.close();
        this.core.saveLoadPopup.open("load");
        break;

      case "save":
        this.close();
        this.core.saveLoadPopup.open("save");
        break;

      case "settings":
        console.log("Settings clicked");
        break;

      case "title":
        this.close();
        if (this.core.currentScene && this.core.currentScene.dispose) {
          this.core.currentScene.dispose();
        }
        this.core.hasSave = true;
        this.core.loadScene("TitleScreen");
        break;
    }
  }

  /* -------------------------
       ---------- RENDER ----------
       ------------------------- */

  render(ctx) {
    if (!this.visible) return;

    const guiData = this.core.dataCache?.gameGUI?.gui_menu;
    if (!guiData) return;

    const canvas = this.core.canvas;
    const scaleX = canvas.width / this.baseWidth;
    const scaleY = canvas.height / this.baseHeight;

    // 1. Dim Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- MENU BOX CONFIG ---
    const menuW = (guiData.gui_menu_Width || 400) * scaleX;
    const menuH = (guiData.gui_menu_Height || 500) * scaleY;
    const menuPadding = (guiData.gui_menu_Padding || 20) * scaleY;

    // Center the menu box
    const menuX = (canvas.width - menuW) / 2;
    const menuY = (canvas.height - menuH) / 2;

    const menuOpacity = guiData.gui_menu_Opacity ?? 0.95;
    const menuBgColor = this.hexToRgba(
      guiData.gui_menu_BackgroundColor || "#fef1e1",
      menuOpacity
    );
    const menuBorderColor = guiData.gui_menu_BorderColor || "#ffcc95";
    const menuBorderThickness =
      (guiData.gui_menu_BorderThickness || 0) * scaleX;
    const menuRadii = this.resolveRadius(
      guiData.gui_menu_BorderCorner || 0,
      scaleX
    );

    // --- DRAW MENU CONTAINER ---

    // 1. Border (Underneath)
    if (menuBorderThickness > 0) {
      this.drawStyledBox(
        ctx,
        menuX,
        menuY,
        menuW,
        menuH,
        menuBorderThickness,
        menuRadii,
        "rgba(0,0,0,0)",
        menuBorderColor
      );
    }

    // 2. Background (Image or Color)
    // (Logic for image background can be added here similar to DialogueBox if you add sprites to JSON later)
    this.drawStyledBox(
      ctx,
      menuX,
      menuY,
      menuW,
      menuH,
      0,
      menuRadii,
      menuBgColor,
      "transparent"
    );

    // --- BUTTONS CONFIG ---
    const btnW = (guiData.gui_menu_ButtonWidth || 300) * scaleX;
    const btnH = (guiData.gui_menu_ButtonHeight || 60) * scaleY;
    const btnSpacing = (guiData.gui_menu_ButtonSpacing || 15) * scaleY;

    const btnBorderThickness =
      (guiData.gui_menu_ButtonBorderThickness || 0) * scaleX;
    const btnRadii = this.resolveRadius(
      guiData.gui_menu_ButtonBorderCorner || 0,
      scaleX
    );

    const btnBgColor = guiData.gui_menu_ButtonBackgroundColor || "#ffcc95";
    const btnBgHover =
      guiData.gui_menu_ButtonBackgroundColor_Hover || "#e0b383";
    const btnBorderColor = guiData.gui_menu_ButtonBorderColor || "#43321e";
    const btnFontColor = guiData.gui_menu_ButtonFontColor || "#43321e";

    const globalSettings = this.core.dataCache?.gameGUI?.game_gui_settings;
    const fontSize = (globalSettings?.fontSize || 25) * scaleX * 1.2; // Slightly larger for menu
    ctx.font = `bold ${fontSize}px ${globalSettings?.fontFamily || "Arial"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Calculate vertical start position for buttons (Centered inside menu box)
    const totalBtnHeight =
      this.buttons.length * btnH + (this.buttons.length - 1) * btnSpacing;
    let currentY = menuY + (menuH - totalBtnHeight) / 2;
    const centerX = menuX + menuW / 2;

    // Reset Layout Cache
    this.layoutCache.buttons = [];

    this.buttons.forEach((btn, i) => {
      const btnX = centerX - btnW / 2;

      // Cache position for hit detection
      this.layoutCache.buttons.push({ x: btnX, y: currentY, w: btnW, h: btnH });

      const isHover = this.hoverIndex === i;
      const currentBg = isHover
        ? this.hexToRgba(btnBgHover, 1)
        : this.hexToRgba(btnBgColor, 1);

      // Draw Button Border
      if (btnBorderThickness > 0) {
        this.drawStyledBox(
          ctx,
          btnX,
          currentY,
          btnW,
          btnH,
          btnBorderThickness,
          btnRadii,
          "rgba(0,0,0,0)",
          btnBorderColor
        );
      }

      // Draw Button Background
      this.drawStyledBox(
        ctx,
        btnX,
        currentY,
        btnW,
        btnH,
        0,
        btnRadii,
        currentBg,
        "transparent"
      );

      // Draw Text
      ctx.fillStyle = btnFontColor;
      ctx.fillText(btn.text, centerX, currentY + btnH / 2);

      currentY += btnH + btnSpacing;
    });
  }
}
