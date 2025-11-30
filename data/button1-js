export class Button {
  constructor(core, data) {
    this.core = core;
    this.data = data;
    this.id = data.id;
    this.text = data.text || "";

    // Image Cache
    this.imageCache = {};
    this.failedImages = new Set();

    // 1. Get GUI Settings
    const gui = this.core.dataCache?.gameGUI?.gui_background_button || {};

    // 2. Resolve Dimensions
    // Height comes from GUI config
    this.height = gui.gui_background_button_Height || 60;

    // Width is calculated based on Text + Padding
    const fontSize = gui.gui_background_button_FontSize || 28;
    const paddingX = gui.gui_background_button_PaddingX || 40;
    const fontFamily = gui.gui_background_button_FontFamily || "Arial";

    // Measure text to get dynamic width
    const ctx = this.core.canvas.getContext("2d");
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    const textMetrics = ctx.measureText(this.text);
    this.width = textMetrics.width + paddingX * 2;

    // 3. Position (From data-backgrounds.json, NOT GUI)
    this.x = data.x || 0;
    this.y = data.y || 0;

    // 4. Interaction State
    this.clickHandler = null;
    this.active = false;
    this.isHovered = false;

    this.enableHoverTracking();
  }

  /* ----------------------------------------------------------
     ---------- HELPERS (Styling) ----------
     ---------------------------------------------------------- */

  resolveRadius(rawRadius) {
    if (Array.isArray(rawRadius) && rawRadius.length === 4) {
      return rawRadius;
    }
    const val = typeof rawRadius === "number" && rawRadius >= 0 ? rawRadius : 0;
    return [val, val, val, val];
  }

  drawStyledBox(ctx, x, y, w, h, thickness, radii, bgColor, borderColor) {
    const resolved = Array.isArray(radii)
      ? radii
      : [radii, radii, radii, radii];
    const [tl, tr, br, bl] = resolved;
    const hasRadius = tl > 0 || tr > 0 || br > 0 || bl > 0;

    // Background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (hasRadius) {
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, resolved);
      else ctx.rect(x, y, w, h);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // Border
    if (thickness > 0) {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = borderColor;
      const offset = thickness / 2;
      // Simplified offset for buttons to avoid complexity
      ctx.stroke();
    }
  }

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
    img.src = src;
    this.imageCache[src] = img;
    return img;
  }

  drawFlexibleImage(ctx, source, x, y, w, h) {
    if (!source || (Array.isArray(source) && source.length === 0)) return false;

    let srcPath = null;
    let spriteCoords = null;

    if (Array.isArray(source) && source.length >= 1) {
      srcPath = source[0];
      if (source.length >= 5) {
        spriteCoords = {
          sx: source[1],
          sy: source[2],
          sw: source[3],
          sh: source[4],
        };
      }
    } else if (typeof source === "string") {
      srcPath = source;
    }

    if (!srcPath) return false;
    const img = this._loadImage(srcPath);
    if (!img || !img.complete || img.naturalWidth === 0) return false;

    if (spriteCoords) {
      ctx.drawImage(
        img,
        spriteCoords.sx,
        spriteCoords.sy,
        spriteCoords.sw,
        spriteCoords.sh,
        x,
        y,
        w,
        h
      );
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    return true;
  }

  /* ----------------------------------------------------------
     ---------- LOGIC ----------
     ---------------------------------------------------------- */

  resize(scale) {
    // Buttons in background.js usually scale with the scene/canvas
    // This method is called if you want to rescale positions manually
    // But usually, standard rendering handles scale via ctx transformation if used.
    // For now, we update internal hitbox values if needed.
    // Assuming simple scaling:
    const gui = this.core.dataCache?.gameGUI?.gui_background_button || {};
    const baseH = gui.gui_background_button_Height || 60;
    // Note: Re-calculating width on resize might be needed if font scales differently
  }

  enableHoverTracking() {
    this.mouseMoveHandler = (e) => {
      // Skip if covered by other popups
      if (this.core.saveLoadPopup?.visible || this.core.menuPopup?.visible) {
        this.isHovered = false;
        return;
      }

      const rect = this.core.canvas.getBoundingClientRect();
      // Need to account for potential scaling in GameCore if applied globally
      // For now, assuming raw canvas coordinates match button coordinates
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const prevState = this.isHovered;
      this.isHovered = this.isInside(mx, my);
    };

    this.core.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }

  isInside(mx, my) {
    return (
      mx > this.x &&
      mx < this.x + this.width &&
      my > this.y &&
      my < this.y + this.height
    );
  }

  /* ----------------------------------------------------------
     ---------- RENDER ----------
     ---------------------------------------------------------- */

  render(ctx) {
    const gui = this.core.dataCache?.gameGUI?.gui_background_button || {};

    // Config Extraction
    const bgColor = this.isHovered
      ? gui.gui_background_button_BackgroundColor_Hover || "rgba(80,80,80,1)"
      : gui.gui_background_button_BackgroundColor || "rgba(54,54,54,0.8)";

    const borderColor = gui.gui_background_button_BorderColor || "#ffffff";
    const borderThick = gui.gui_background_button_BorderThickness || 0;
    const borderCorner = this.resolveRadius(
      gui.gui_background_button_BorderCorner || 5
    );

    const fontColor = this.isHovered
      ? gui.gui_background_button_FontColor_Hover || "#ffd700"
      : gui.gui_background_button_FontColor || "#ffffff";

    const fontSize = gui.gui_background_button_FontSize || 28;
    const fontFamily = gui.gui_background_button_FontFamily || "Arial";

    const imgSrc = this.isHovered
      ? gui.gui_background_button_BackgroundImg_Hover
      : gui.gui_background_button_BackgroundImg;

    // 1. Draw Background (Image or Styled Box)
    let imgDrawn = false;

    // If image exists in JSON, try drawing it
    if (imgSrc && (typeof imgSrc === "string" || imgSrc.length > 0)) {
      // Optional: Clip for rounded corners if using image
      ctx.save();
      this.drawStyledBox(
        ctx,
        this.x,
        this.y,
        this.width,
        this.height,
        0,
        borderCorner,
        "transparent",
        "transparent"
      );
      // ctx.clip(); // Uncomment if you want images to be strictly rounded
      imgDrawn = this.drawFlexibleImage(
        ctx,
        imgSrc,
        this.x,
        this.y,
        this.width,
        this.height
      );
      ctx.restore();
    }

    // Fallback or Overlay: Draw Box if no image, or Border on top
    if (!imgDrawn) {
      this.drawStyledBox(
        ctx,
        this.x,
        this.y,
        this.width,
        this.height,
        borderThick,
        borderCorner,
        bgColor,
        borderColor
      );
    } else if (borderThick > 0) {
      // If image drawn, just draw border on top
      this.drawStyledBox(
        ctx,
        this.x,
        this.y,
        this.width,
        this.height,
        borderThick,
        borderCorner,
        "transparent",
        borderColor
      );
    }

    // 2. Draw Text
    ctx.fillStyle = fontColor;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
  }

  addClickListener(callback) {
    this.removeClickListener();
    this.active = true;

    this.clickHandler = (e) => {
      if (!this.active) return;
      if (this.core.saveLoadPopup?.visible || this.core.menuPopup?.visible)
        return;

      const rect = this.core.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isInside(mouseX, mouseY)) {
        callback(this);
      }
    };

    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  removeClickListener() {
    if (this.clickHandler) {
      this.active = false;
      this.core.canvas.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
  }
}
