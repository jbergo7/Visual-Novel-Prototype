export class DialogueChoices {
  constructor(core, onSelect) {
    this.core = core;
    this.onSelect = onSelect; // callback(choice)
    this.choices = [];
    this.hoverIndex = -1; // track hovered choice
    this.clickHandler = this.handleClick.bind(this);
    this.moveHandler = this.handleMouseMove.bind(this);

    // Base resolution reference
    this.baseWidth = 1920;
    this.baseHeight = 1080;

    // --- Asset caching & failure tracking ---
    this.imageCache = {}; // { src: Image }
    this.failedImages = new Set(); // src strings that have permanently failed

    // Sprite Data Cache for Buttons (Normal, Hover, Disabled)
    this.buttonSpriteData = {
      normal: null,
      hover: null,
      disabled: null,
    };

    // --- BUFFER CANVAS ---
    this._tempCanvas = document.createElement("canvas");
  }

  setChoices(choices) {
    this.choices = (choices || []).map((choice) => ({
      ...choice,
      disabled: this.isChoiceDisabled(choice),
    }));
    this.core.canvas.addEventListener("click", this.clickHandler, {
      capture: true,
    });
    this.core.canvas.addEventListener("mousemove", this.moveHandler, {
      capture: true,
    });
  }

  clear() {
    this.choices = [];
    this.hoverIndex = -1;
    this.core.canvas.removeEventListener("click", this.clickHandler, {
      capture: true,
    });
    this.core.canvas.removeEventListener("mousemove", this.moveHandler, {
      capture: true,
    });
  }

  isChoiceDisabled(choice) {
    const c = this.core.currentCharacter;

    if (choice.money && choice.money < 0 && c.money + choice.money < 0) {
      return true;
    }

    if (choice.energy && choice.energy < 0 && c.energy + choice.energy < 0) {
      return true;
    }

    return false;
  }

  /* -------------------------
       ---------- IMAGE HANDLING ----------
       ------------------------- */

  _loadImage(src) {
    if (!src) return null;
    if (this.failedImages.has(src)) return null;
    const existing = this.imageCache[src];
    if (existing) return existing;

    const img = new Image();

    img.onerror = () => {
      console.error("[DialogueChoices] Failed to load image:", src);
      delete this.imageCache[src];
      this.failedImages.add(src);
    };

    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error("[DialogueChoices] Loaded image has zero size:", src);
        delete this.imageCache[src];
        this.failedImages.add(src);
      }
    };

    try {
      img.src = src;
    } catch (e) {
      console.error("[DialogueChoices] Exception setting image src:", src, e);
      this.failedImages.add(src);
      return null;
    }

    this.imageCache[src] = img;
    return img;
  }

  _ensureButtonSprites(guiData) {
    const processSpriteArray = (dataArray) => {
      if (!Array.isArray(dataArray) || dataArray.length < 1) return null;
      dataArray.forEach((part) => {
        if (part.img_link) this._loadImage(part.img_link);
      });
      return dataArray;
    };

    const rawNormal = guiData.dialogueChoice_BackgroundImg;
    const rawHover = guiData.dialogueChoice_BackgroundImg_Hover;
    const rawDisabled = guiData.dialogueChoice_BackgroundImg_Disabled;

    this.buttonSpriteData.normal = processSpriteArray(rawNormal);
    this.buttonSpriteData.hover = processSpriteArray(rawHover);
    this.buttonSpriteData.disabled = processSpriteArray(rawDisabled);
  }

  /* -------------------------
       ---------- DRAWING HELPERS ----------
       ------------------------- */

  drawSpriteButton(ctx, x, y, width, height, spriteArray) {
    if (!spriteArray || spriteArray.length === 0) return false;

    // --- Prepare Buffer ---
    const wInt = Math.ceil(width);
    const hInt = Math.ceil(height);

    if (this._tempCanvas.width !== wInt || this._tempCanvas.height !== hInt) {
      this._tempCanvas.width = wInt;
      this._tempCanvas.height = hInt;
    }
    const bctx = this._tempCanvas.getContext("2d");
    bctx.clearRect(0, 0, wInt, hInt);

    // CASE A: 1-SLICE
    if (spriteArray.length === 1) {
      const part = spriteArray[0];
      const img = this._loadImage(part.img_link);
      if (!img || !img.complete || img.naturalWidth === 0) return false;
      bctx.drawImage(
        img,
        part.sx,
        part.sy,
        part.swidth,
        part.sheight,
        0,
        0,
        wInt,
        hInt
      );
    }
    // CASE B: 3-SLICE (Tiled)
    else if (spriteArray.length >= 3) {
      const [leftPart, centerPart, rightPart] = spriteArray;
      const l_img = this._loadImage(leftPart.img_link);
      const c_img = this._loadImage(centerPart.img_link);
      const r_img = this._loadImage(rightPart.img_link);

      if (
        !l_img ||
        !c_img ||
        !r_img ||
        !l_img.complete ||
        !c_img.complete ||
        !r_img.complete ||
        l_img.naturalWidth === 0
      )
        return false;

      const dh = hInt;
      const l_dw = Math.round(leftPart.swidth * (height / leftPart.sheight));
      const r_dw = Math.round(rightPart.swidth * (height / rightPart.sheight));
      const centerScaleFactor = height / centerPart.sheight;
      const tileWidth = Math.max(
        1,
        Math.round(centerPart.swidth * centerScaleFactor)
      );

      const startX = 0;
      const totalWidth = wInt;

      const overlapCC = 1;
      const overlapLC = 2;

      // Left
      bctx.drawImage(
        l_img,
        leftPart.sx,
        leftPart.sy,
        leftPart.swidth,
        leftPart.sheight,
        startX,
        0,
        l_dw,
        dh
      );

      // Center
      let currentX = startX + l_dw - overlapLC;
      const r_start = startX + totalWidth - r_dw;
      const fillTargetX = r_start + overlapCC;
      const totalCover = fillTargetX - currentX;
      const step = tileWidth - overlapCC;

      if (totalCover > 0 && step > 0) {
        const numSteps = Math.ceil(totalCover / step);
        for (let i = 0; i < numSteps; i++) {
          let drawW = tileWidth;
          let sourceW = centerPart.swidth;
          const remaining = r_start - currentX;

          if (i === numSteps - 1 || drawW > remaining) {
            drawW = remaining;
            if (drawW < tileWidth && drawW > 0) {
              sourceW = Math.round((drawW / tileWidth) * centerPart.swidth);
            }
          }
          if (drawW > 0) {
            bctx.drawImage(
              c_img,
              centerPart.sx,
              centerPart.sy,
              sourceW,
              centerPart.sheight,
              Math.round(currentX),
              0,
              Math.round(drawW),
              dh
            );
          }
          currentX += step;
        }
      }

      // Right
      const r_drawX = r_start - overlapCC;
      bctx.drawImage(
        r_img,
        rightPart.sx,
        rightPart.sy,
        rightPart.swidth,
        rightPart.sheight,
        Math.round(r_drawX),
        0,
        r_dw,
        dh
      );
    } else {
      return false;
    }

    // Draw Buffer to Screen
    ctx.drawImage(
      this._tempCanvas,
      0,
      0,
      wInt,
      hInt,
      Math.round(x),
      Math.round(y),
      wInt,
      hInt
    );

    return true;
  }

  hexToRgba(color, globalAlpha = 1) {
    if (!color) return `rgba(0,0,0,${globalAlpha})`;
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
      return `rgba(${r}, ${g}, ${b}, ${globalAlpha})`;
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
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, resolved);
      } else {
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
        ctx.lineTo(x + w, y + h - br);
        ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        ctx.lineTo(x + bl, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
        ctx.lineTo(x, y + tl);
        ctx.quadraticCurveTo(x, y, x + tl, y);
      }
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // Draw Border
    if (thickness > 0) {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = borderColor;
      const offset = thickness / 2;
      const bx = x - offset,
        by = y - offset,
        bw = w + thickness,
        bh = h + thickness;
      const outerRadii = resolved.map((r) => (r > 0 ? r + offset : 0));

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, outerRadii);
      else ctx.rect(bx, by, bw, bh);
      ctx.stroke();
    }
  }

  getLayoutMetrics() {
    const canvas = this.core.canvas;
    const guiData = this.core.dataCache?.gameGUI?.gui_dialogueChoice;

    if (!guiData) {
      return {
        boxWidth: canvas.width * 0.6,
        boxHeight: canvas.height * 0.08,
        margin: 10,
        startY: (canvas.height - this.choices.length * 60) / 2,
        scaleX: 1,
      };
    }

    const scaleX = canvas.width / this.baseWidth;
    const scaleY = canvas.height / this.baseHeight;

    const baseW = guiData.dialogueChoice_Width || 1020;
    const baseH = guiData.dialogueChoice_Hieght || 50;
    const baseMargin = guiData.dialogueChoice_Margin || 5;

    const boxWidth = baseW * scaleX;
    const boxHeight = baseH * scaleY;
    const margin = baseMargin * scaleY;

    const totalGroupHeight =
      this.choices.length * boxHeight + (this.choices.length - 1) * margin;
    const startY = (canvas.height - totalGroupHeight) / 2;

    return { boxWidth, boxHeight, margin, startY, guiData, scaleX };
  }

  handleMouseMove(e) {
    if (this.choices.length === 0) return;
    if (this.core.menuPopup.visible) return;
    if (this.core.saveLoadPopup?.visible) return;

    const { boxWidth, boxHeight, margin, startY } = this.getLayoutMetrics();
    const canvas = this.core.canvas;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let hovered = -1;

    this.choices.forEach((_, i) => {
      const x = (canvas.width - boxWidth) / 2;
      const y = startY + i * (boxHeight + margin);

      if (
        mouseX > x &&
        mouseX < x + boxWidth &&
        mouseY > y &&
        mouseY < y + boxHeight
      ) {
        hovered = i;
      }
    });

    if (hovered !== this.hoverIndex) {
      this.hoverIndex = hovered;
    }
  }

  handleClick(e) {
    if (this.choices.length === 0) return;
    if (this.core.menuPopup.visible || this.core.saveLoadPopup?.visible) return;

    const { boxWidth, boxHeight, margin, startY } = this.getLayoutMetrics();
    const canvas = this.core.canvas;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.choices.forEach((choice, i) => {
      const x = (canvas.width - boxWidth) / 2;
      const y = startY + i * (boxHeight + margin);

      if (choice.disabled) return;

      if (
        mouseX > x &&
        mouseX < x + boxWidth &&
        mouseY > y &&
        mouseY < y + boxHeight
      ) {
        this.onSelect(choice);
        this.clear();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    });
  }

  render(ctx) {
    if (this.choices.length === 0) return;

    const canvas = this.core.canvas;
    const { boxWidth, boxHeight, margin, startY, guiData, scaleX } =
      this.getLayoutMetrics();
    const globalSettings = this.core.dataCache?.gameGUI?.game_gui_settings;

    if (!guiData) return;

    // Load/Cache sprite data once per frame (or checking changes)
    this._ensureButtonSprites(guiData);

    // --- Styling Setup ---
    const fontFamily = globalSettings?.fontFamily || "Arial, sans-serif";
    const baseFontSize = globalSettings?.fontSize || 25;
    const scaledFontSize = baseFontSize * scaleX;

    const opacity = guiData.dialogueChoice_Opacity ?? 1;
    const borderColor = guiData.dialogueChoice_BorderColor || "#fff";
    const borderThickness =
      (guiData.dialogueChoice_BorderThickness || 0) * scaleX;
    const fontColor = guiData.dialogueChoice_FontColor || "#fff";

    const rawCorner = guiData.dialogueChoice_ButtonBorderCorner || 0;
    const radii = this.resolveRadius(rawCorner, scaleX);

    // Background Colors (Fallback)
    const bgNormal = this.hexToRgba(
      guiData.dialogueChoice_BackgroundColor,
      opacity
    );
    const bgHover = this.hexToRgba(
      guiData.dialogueChoice_BackgroundColor_Hover,
      opacity
    );
    const bgDisabled = this.hexToRgba(
      guiData.dialogueChoice_BackgroundColor_Disabled,
      opacity
    );

    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.choices.forEach((choice, i) => {
      const x = (canvas.width - boxWidth) / 2;
      const y = startY + i * (boxHeight + margin);

      // Determine State
      let state = "normal";
      if (choice.disabled) state = "disabled";
      else if (i === this.hoverIndex) state = "hover";

      // --- RENDERING ORDER MODIFIED: BORDER FIRST ---

      // 1. DRAW BORDER FIRST (So it appears BEHIND the image)
      if (borderThickness > 0) {
        this.drawStyledBox(
          ctx,
          x,
          y,
          boxWidth,
          boxHeight,
          borderThickness,
          radii,
          "rgba(0,0,0,0)", // Transparent Fill, Stroke only
          borderColor
        );
      }

      // 2. DRAW SPRITE (If available)
      let drawn = false;
      ctx.save();
      ctx.globalAlpha = opacity;
      let spriteSource = this.buttonSpriteData.normal;
      if (state === "disabled" && this.buttonSpriteData.disabled) {
        spriteSource = this.buttonSpriteData.disabled;
      } else if (state === "hover" && this.buttonSpriteData.hover) {
        spriteSource = this.buttonSpriteData.hover;
      }

      if (spriteSource) {
        drawn = this.drawSpriteButton(
          ctx,
          x,
          y,
          boxWidth,
          boxHeight,
          spriteSource
        );
      }
      ctx.restore();

      // 3. FALLBACK BG (If Sprite Failed)
      if (!drawn) {
        let currentBg = bgNormal;
        if (state === "disabled") currentBg = bgDisabled;
        else if (state === "hover") currentBg = bgHover;

        // Note: Border Thickness is 0 here because we drew the border already in Step 1
        this.drawStyledBox(
          ctx,
          x,
          y,
          boxWidth,
          boxHeight,
          0,
          radii,
          currentBg,
          borderColor
        );
      }

      // 4. DRAW TEXT
      ctx.fillStyle = choice.disabled
        ? "rgba(150, 150, 150, 0.7)"
        : this.hexToRgba(fontColor, 1);

      const textX = x + boxWidth / 2;
      const textY = y + boxHeight / 2;
      ctx.fillText(choice.text, textX, textY);
    });
  }

  onResize(scaleRatio) {
    this.scaleRatio = scaleRatio;
  }
}
