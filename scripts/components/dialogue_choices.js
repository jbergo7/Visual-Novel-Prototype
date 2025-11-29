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
       ---------- HELPERS ----------
       ------------------------- */

  // Helper: Converts Hex to RGBA, or returns existing RGBA string, applying global opacity
  hexToRgba(color, globalAlpha = 1) {
    if (!color) return `rgba(0,0,0,${globalAlpha})`;

    // If it's already an rgba/rgb string, just return it (we assume opacity is handled in the string or context globalAlpha)
    if (color.startsWith("rgb")) {
      return color;
    }

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

  // Helper: Resolves corner radius (number or array) to scaled [TL, TR, BR, BL]
  resolveRadius(rawRadius, scale) {
    if (Array.isArray(rawRadius) && rawRadius.length === 4) {
      return rawRadius.map((r) => r * scale);
    }
    const scaled =
      typeof rawRadius === "number" && rawRadius >= 0 ? rawRadius * scale : 0;
    return [scaled, scaled, scaled, scaled];
  }

  // Helper: Draws a styled box with rounded corners and border
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
        // Fallback manual drawing
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
      // Outward stroke calculation
      const bx = x - offset,
        by = y - offset,
        bw = w + thickness,
        bh = h + thickness;
      const outerRadii = resolved.map((r) => (r > 0 ? r + offset : 0));

      ctx.beginPath();
      const [o_tl, o_tr, o_br, o_bl] = outerRadii;
      const hasOuterRadius = o_tl > 0 || o_tr > 0 || o_br > 0 || o_bl > 0;

      if (hasOuterRadius) {
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, outerRadii);
        else {
          // Fallback manual drawing for border
          ctx.moveTo(bx + o_tl, by);
          ctx.lineTo(bx + bw - o_tr, by);
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + o_tr);
          ctx.lineTo(bx + bw, by + bh - o_br);
          ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - o_br, by + bh);
          ctx.lineTo(bx + o_bl, by + bh);
          ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - o_bl);
          ctx.lineTo(bx, by + o_tl);
          ctx.quadraticCurveTo(bx, by, bx + o_tl, by);
        }
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.stroke();
    }
  }

  // Calculates layout metrics based on current canvas size and GUI settings
  getLayoutMetrics() {
    const canvas = this.core.canvas;
    const guiData = this.core.dataCache?.gameGUI?.gui_dialogueChoice;

    if (!guiData) {
      // Fallback metrics if data isn't loaded
      return {
        boxWidth: canvas.width * 0.6,
        boxHeight: canvas.height * 0.08,
        margin: 10,
        startY: (canvas.height - this.choices.length * 60) / 2,
      };
    }

    // Base scaling factors
    const scaleX = canvas.width / this.baseWidth;
    const scaleY = canvas.height / this.baseHeight;

    // Dimensions from JSON
    const baseW = guiData.dialogueChoice_Width || 1020;
    const baseH = guiData.dialogueChoice_Hieght || 50; // Note: Typo 'Hieght' in JSON
    const baseMargin = guiData.dialogueChoice_Margin || 5;
    const basePadding = guiData.dialogueChoice_Padding || 5; // Internal padding if needed for text

    // Scaled dimensions
    const boxWidth = baseW * scaleX;
    const boxHeight = baseH * scaleY;
    const margin = baseMargin * scaleY;

    // Calculate Start Y to center the entire group of choices vertically
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

    if (!guiData) return; // Safety check

    // --- Styling Setup ---
    const fontFamily = globalSettings?.fontFamily || "Arial, sans-serif";
    const baseFontSize = globalSettings?.fontSize || 25;
    const scaledFontSize = baseFontSize * scaleX;

    const opacity = guiData.dialogueChoice_Opacity ?? 1;
    const borderColor = guiData.dialogueChoice_BorderColor || "#fff";
    const borderThickness =
      (guiData.dialogueChoice_BorderThickness || 0) * scaleX;
    const fontColor = guiData.dialogueChoice_FontColor || "#fff";

    // Corner Radii (support for array [TL, TR, BR, BL])
    const rawCorner = guiData.dialogueChoice_ButtonBorderCorner || 0;
    const radii = this.resolveRadius(rawCorner, scaleX);

    // Background Colors
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

    // Font Setup
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.choices.forEach((choice, i) => {
      const x = (canvas.width - boxWidth) / 2;
      const y = startY + i * (boxHeight + margin);

      // Determine Background Color
      let currentBg = bgNormal;
      if (choice.disabled) {
        currentBg = bgDisabled;
      } else if (i === this.hoverIndex) {
        currentBg = bgHover;
      }

      // Draw Box
      this.drawStyledBox(
        ctx,
        x,
        y,
        boxWidth,
        boxHeight,
        borderThickness,
        radii,
        currentBg,
        borderColor
      );

      // Draw Text
      ctx.fillStyle = choice.disabled
        ? "rgba(150, 150, 150, 0.7)"
        : this.hexToRgba(fontColor, 1);

      // Center text in box
      const textX = x + boxWidth / 2;
      const textY = y + boxHeight / 2;
      ctx.fillText(choice.text, textX, textY);
    });
  }

  onResize(scaleRatio) {
    this.scaleRatio = scaleRatio;
  }
}
