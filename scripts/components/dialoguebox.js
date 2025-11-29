export class DialogueBox {
  constructor(core) {
    // Core reference (must provide canvas, baseWidth/baseHeight, dataCache, characters, currentCharacter)
    this.core = core;

    // --- Typewriter state ---
    this.fullText = "";
    this.displayText = "";
    this.charIndex = 0;
    this.accumulator = 0;
    this.speed = 20; // ms per char by default (can be overridden by GUI settings)
    this.isTyping = false;
    this.typingFinishedTime = null;

    // --- Modes ---
    this.autoMode = false;
    this.fastForwardMode = false;

    // --- Buttons state (hitboxes updated each render) ---
    this.autoButton = { x: 0, y: 0, width: 0, height: 0 };
    this.ffButton = { x: 0, y: 0, width: 0, height: 0 };

    // Hover index: -1 none, 0 auto, 1 skip
    this.hoverIndex = -1;
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
    this.core.canvas.addEventListener("mousemove", this.mouseMoveHandler);

    // --- Avatar / speaker tracking ---
    this.lastSpeaker = null;
    this.activeAvatarData = null; // path or [path, sx, sy, sw, sh]
    this.activeAvatarImage = null; // Image object

    // --- Asset caching & failure tracking ---
    this.imageCache = {}; // { src: Image }
    this.failedImages = new Set(); // src strings that have permanently failed

    // Speaker sprite pieces (arrays or null)
    this.speakerSpriteData = { left: null, center: null, right: null };

    // Dialogue background cached info: { data, image }
    this.dialogueBgImageCache = { data: null, image: null };

    // Configurable ratios (kept from original)
    this.speakerMinRatio = 0.08;
    this.speakerMaxRatio = 0.15;
    this.textMinRatio = 0.06;
    this.textMaxRatio = 0.12;

    // small performance caches
    this._measureCtx = null; // created on demand for measureText if needed
  }

  /* -------------------------
     ---------- IMAGES ----------
     ------------------------- */

  // Load image into cache or return existing Image object.
  // Returns Image object or null on immediate failure.
  _loadImage(src) {
    if (!src) return null;
    if (this.failedImages.has(src)) return null;
    const existing = this.imageCache[src];
    if (existing) return existing;

    const img = new Image();
    img.onload = () => {
      // If image loaded but has zero natural size, treat as failed
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.error("[DialogueBox] Loaded image has zero size:", src);
        delete this.imageCache[src];
        this.failedImages.add(src);
        // If it was used as dialogue bg, nullify it to force fallback
        if (this.dialogueBgImageCache.image === img)
          this.dialogueBgImageCache.image = null;
      }
    };
    img.onerror = () => {
      console.error("[DialogueBox] Failed to load image:", src);
      delete this.imageCache[src];
      this.failedImages.add(src);
      if (this.dialogueBgImageCache.image === img)
        this.dialogueBgImageCache.image = null;
    };

    try {
      img.src = src;
    } catch (e) {
      console.error("[DialogueBox] Exception setting image src:", src, e);
      this.failedImages.add(src);
      return null;
    }

    this.imageCache[src] = img;
    return img;
  }

  // Ensure the dialogue background image object is set (or null when no valid image)
  _ensureDialogueBgImage(guiData) {
    const bgData = guiData?.dialogueBox_BackgroundImg ?? null;
    if (this.dialogueBgImageCache.data === bgData) return; // nothing changed

    this.dialogueBgImageCache.data = bgData;
    this.dialogueBgImageCache.image = null;

    let src = null;
    if (typeof bgData === "string" && bgData.trim().length > 0) {
      src = bgData;
    } else if (
      Array.isArray(bgData) &&
      bgData.length >= 1 &&
      typeof bgData[0] === "string"
    ) {
      src = bgData[0];
    }

    if (!src) {
      // no image configured
      return;
    }

    if (this.failedImages.has(src)) {
      // Image previously failed; do not attempt again
      return;
    }

    const img = this._loadImage(src);
    if (img) this.dialogueBgImageCache.image = img;
  }

  // Ensure speaker sprite pieces are remembered and their images are requested
  _ensureSpeakerSpriteData(guiData) {
    const left = guiData?.dialogueBox_SpeakerBackgroundImg_left ?? null;
    const center = guiData?.dialogueBox_SpeakerBackgroundImg_Center ?? null;
    const right = guiData?.dialogueBox_SpeakerBackgroundImg_Right ?? null;

    // Only update if changed
    if (
      this.speakerSpriteData.left !== left ||
      this.speakerSpriteData.center !== center ||
      this.speakerSpriteData.right !== right
    ) {
      this.speakerSpriteData.left = left;
      this.speakerSpriteData.center = center;
      this.speakerSpriteData.right = right;

      // Preload images for each piece
      if (left && Array.isArray(left) && left[0]) this._loadImage(left[0]);
      if (center && Array.isArray(center) && center[0])
        this._loadImage(center[0]);
      if (right && Array.isArray(right) && right[0]) this._loadImage(right[0]);
    }
  }

  /* -------------------------
     ---------- TYPEWRITER ----------
     ------------------------- */

  startTyping(newText) {
    this.fullText = newText ?? "";
    if (this.fastForwardMode) {
      // Immediately show all text if fast-forward mode
      this.displayText = this.fullText;
      this.charIndex = this.fullText.length;
      this.isTyping = false;
      this.typingFinishedTime = Date.now();
      return;
    }
    this.displayText = "";
    this.charIndex = 0;
    this.accumulator = 0;
    this.isTyping = true;
    this.typingFinishedTime = null;
  }

  skipTypewriter() {
    if (!this.isTyping) return false;
    this.displayText = this.fullText;
    this.charIndex = this.fullText.length;
    this.isTyping = false;
    this.typingFinishedTime = Date.now();
    return true;
  }

  updateTyping(deltaMs) {
    if (!this.isTyping) return;
    if (this.fastForwardMode) {
      this.skipTypewriter();
      return;
    }
    this.accumulator += deltaMs;
    const interval = this.speed;
    while (this.accumulator >= interval && this.isTyping) {
      this.accumulator -= interval;
      if (this.charIndex < this.fullText.length) {
        this.charIndex++;
        this.displayText = this.fullText.substring(0, this.charIndex);
      }
      if (this.charIndex >= this.fullText.length) {
        this.isTyping = false;
        this.typingFinishedTime = Date.now();
      }
    }
  }

  /* -------------------------
     ---------- INPUT (mouse) ----------
     ------------------------- */

  handleMouseMove(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const scaleX = this.core.canvas.width / rect.width;
    const scaleY = this.core.canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let newHover = -1;
    if (this._pointInBox(mouseX, mouseY, this.autoButton)) newHover = 0;
    else if (this._pointInBox(mouseX, mouseY, this.ffButton)) newHover = 1;

    if (newHover !== this.hoverIndex) this.hoverIndex = newHover;
  }

  handleClick(x, y) {
    if (this._pointInBox(x, y, this.autoButton)) {
      this.toggleAuto();
      return true;
    }
    if (this._pointInBox(x, y, this.ffButton)) {
      this.toggleFastForward();
      return true;
    }
    return false;
  }

  _pointInBox(x, y, box) {
    if (!box) return false;
    return (
      x >= box.x &&
      x <= box.x + box.width &&
      y >= box.y &&
      y <= box.y + box.height
    );
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
    if (this.autoMode) {
      this.fastForwardMode = false;
      if (!this.isTyping) this.typingFinishedTime = Date.now();
    }
  }

  toggleFastForward() {
    this.fastForwardMode = !this.fastForwardMode;
    if (this.fastForwardMode) {
      this.autoMode = false;
      if (this.isTyping) this.skipTypewriter();
    }
  }

  /* -------------------------
     ---------- HELPERS ----------
     ------------------------- */

  hexToRgba(hex, alpha = 1) {
    if (!hex || hex[0] !== "#" || (hex.length !== 7 && hex.length !== 4)) {
      return `rgba(0,0,0,${alpha})`;
    }
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  resolveRadius(rawRadius, scale) {
    if (Array.isArray(rawRadius) && rawRadius.length === 4) {
      return rawRadius.map((r) => r * scale);
    }
    const scaled =
      typeof rawRadius === "number" && rawRadius >= 0 ? rawRadius * scale : 0;
    return [scaled, scaled, scaled, scaled];
  }

  // draw a rounded rect + outward stroke border (keeps behavior consistent)
  drawStyledBox(ctx, x, y, w, h, thickness, radii, bgColor, borderColor) {
    const resolved = Array.isArray(radii)
      ? radii
      : [radii, radii, radii, radii];
    const [tl, tr, br, bl] = resolved;
    const hasRadius = tl > 0 || tr > 0 || br > 0 || bl > 0;

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
      const [o_tl, o_tr, o_br, o_bl] = outerRadii;
      const hasOuterRadius = o_tl > 0 || o_tr > 0 || o_br > 0 || o_bl > 0;
      if (hasOuterRadius) {
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, outerRadii);
        else {
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

  // Speaker sprite tiling (keeps robust overlap logic)
  drawSpeakerSpriteBox(ctx, boxX, boxY, boxWidth, boxHeight, spriteData) {
    const leftData = spriteData.left,
      centerData = spriteData.center,
      rightData = spriteData.right;
    if (!leftData || !centerData || !rightData) return false;

    const l_src = leftData[0],
      c_src = centerData[0],
      r_src = rightData[0];
    const l_img = this.imageCache[l_src],
      c_img = this.imageCache[c_src],
      r_img = this.imageCache[r_src];
    if (!l_img || !c_img || !r_img) return false;
    if (!l_img.complete || !c_img.complete || !r_img.complete) return false;
    if (
      l_img.naturalWidth === 0 ||
      c_img.naturalWidth === 0 ||
      r_img.naturalWidth === 0
    )
      return false;

    const [, l_sx, l_sy, l_sw, l_sh] = leftData;
    const [, c_sx, c_sy, c_sw, c_sh] = centerData;
    const [, r_sx, r_sy, r_sw, r_sh] = rightData;

    const dh = Math.round(boxHeight);
    const centerScaleFactor = boxHeight / c_sh;
    const tileWidth = Math.max(1, Math.round(c_sw * centerScaleFactor));
    const l_dw = Math.round(l_sw * (boxHeight / l_sh));
    const r_dw = Math.round(r_sw * (boxHeight / r_sh));

    const l_dx = Math.round(boxX);
    const l_dy = Math.round(boxY);
    const box_w_rounded = Math.round(boxWidth);

    const overlapCC = 1; // center-center overlap
    const overlapLC = 2; // left-center overlap
    const step = tileWidth - overlapCC;
    if (step <= 0) return false;

    // Draw left
    ctx.drawImage(l_img, l_sx, l_sy, l_sw, l_sh, l_dx, l_dy, l_dw, dh);

    // Center tiles
    let currentX = l_dx + l_dw - overlapLC;
    const r_start = l_dx + box_w_rounded - r_dw;
    const totalCover = r_start - currentX;
    if (totalCover > 0 && tileWidth > 0) {
      const numSteps = Math.ceil(totalCover / step);
      for (let i = 0; i < numSteps; i++) {
        let drawW = tileWidth;
        let sourceW = c_sw;
        if (i === numSteps - 1) {
          drawW = r_start - currentX;
          if (drawW <= 0) break;
          if (drawW < tileWidth)
            sourceW = Math.round((drawW / tileWidth) * c_sw);
        }
        ctx.drawImage(
          c_img,
          c_sx,
          c_sy,
          sourceW,
          c_sh,
          Math.round(currentX),
          l_dy,
          Math.round(drawW),
          dh
        );
        currentX += step;
      }
    }

    // Draw right piece overlapped by 1px
    const r_dx_over = r_start - overlapCC;
    ctx.drawImage(r_img, r_sx, r_sy, r_sw, r_sh, r_dx_over, l_dy, r_dw, dh);

    return true;
  }

  // Wrap text into lines using ctx.measureText
  wrapText(ctx, text, maxWidth) {
    if (!text) return [""];
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (const w of words) {
      const test = line.length ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line !== "") {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* -------------------------
     ---------- MAIN RENDER ----------
     ------------------------- */

  // render(ctx, speaker, text) - main entry (keeps same signature)
  render(ctx, speaker, text) {
    // Start typing if text changed
    if (this.fullText !== text) this.startTyping(text);

    // We choose a delta of ~16.67ms per frame to match original behavior
    this.updateTyping(16.67);

    const canvas = this.core.canvas;
    const baseWidth = this.core.baseWidth || 1920;
    const baseHeight = this.core.baseHeight || 1080;

    const guiData = this.core.dataCache?.gameGUI?.gui_dialoguebox;
    const globalSettings = this.core.dataCache?.gameGUI?.game_gui_settings;

    // Fallback minimal box if gui missing
    if (!guiData || !globalSettings) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      const defaultBoxHeight = canvas.height * 0.25;
      ctx.fillRect(
        0,
        canvas.height - defaultBoxHeight,
        canvas.width,
        defaultBoxHeight
      );
      return;
    }

    // --- Layout & Scaling ---
    const dialogueBaseHeight = guiData.dialogueBox_Hieght || 300;
    const dialogueBaseWidth = guiData.dialogueBox_Width || 1920;
    const boxHeight = (dialogueBaseHeight / baseHeight) * canvas.height;
    const boxWidth = (dialogueBaseWidth / baseWidth) * canvas.width;

    const textMarginX =
      (guiData.dialogueBox_Padding ?? 10) * (canvas.width / baseWidth);
    const borderThickness =
      (guiData.dialogueBox_BorderThickness ?? 0) * (canvas.width / baseWidth);
    const fixedAvatarPaddingX = 20 * (canvas.width / baseWidth);
    const borderButtonThickness =
      (guiData.dialogueBox_ButtonBorderThickness ?? 0) *
      (canvas.width / baseWidth);
    const bgButtonColor =
      guiData.dialogueBox_ButtonBackgroundColor ?? "#1A1A1A";
    const fontButtonColor = guiData.dialogueBox_ButtonFontColor ?? "#fff";
    const bgButtonColorHover =
      guiData.dialogueBox_ButtonBackgroundColor_Hover ?? bgButtonColor;

    // Position string logic (e.g., "bottom 0")
    const positionString = guiData.dialogueBox_Position ?? "bottom 0";
    const parts = positionString
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);
    const positionKeyword = (parts[0] ?? "bottom").toLowerCase();
    const marginBase = parseFloat(parts[1]) || 0;

    let boxX = (canvas.width - boxWidth) / 2;
    let boxY = (canvas.height - boxHeight) / 2;
    let scaledMargin =
      positionKeyword === "left" || positionKeyword === "right"
        ? marginBase * (canvas.width / baseWidth)
        : marginBase * (canvas.height / baseHeight);

    switch (positionKeyword) {
      case "top":
        boxY = scaledMargin;
        break;
      case "bottom":
        boxY = canvas.height - boxHeight - scaledMargin;
        break;
      case "left":
        boxX = scaledMargin;
        break;
      case "right":
        boxX = canvas.width - boxWidth - scaledMargin;
        break;
      case "center":
      default:
        boxY = (canvas.height - boxHeight) / 2 + scaledMargin;
        break;
    }

    // Colors & fonts
    const bgColor = guiData.dialogueBox_BackgroundColor ?? "#1A1A1A";
    const bgSpeakerColor =
      guiData.dialogueBox_SpeakerBackgroundColor ?? "#1A1A1A";
    const fontSpeakerColor = guiData.dialogueBox_SpeakerFontColor ?? "#fff";
    const opacity = guiData.dialogueBox_Opacity ?? 0.9;
    const fontColor = guiData.dialogueBox_FontColor ?? "#fff";
    const borderColor = guiData.dialogueBox_BorderColor ?? "#fff";
    const fontFamily = globalSettings.fontFamily ?? "Arial, sans-serif";

    const dialogueBoxFillStyle = this.hexToRgba(bgColor, opacity);
    const speakerBoxFillStyle = this.hexToRgba(bgSpeakerColor, opacity);

    const baseFontSize =
      (globalSettings.fontSize ?? 12) * (canvas.height / baseHeight);
    const textFontSize = baseFontSize * 1.0;
    const speakerFontSize = baseFontSize * 1.3;

    // speaker box height calculation
    const speakerPaddingY = speakerFontSize * 0.3;
    const speakerBaseHeight = guiData.dialogueBox_SpeakerHeight || 0;
    const speakerBoxHeight =
      speakerBaseHeight > 0
        ? speakerBaseHeight * (canvas.height / baseHeight)
        : speakerFontSize * 1.3 + speakerPaddingY * 2;

    // Ensure assets (speaker sprites + bg image) are requested
    this._ensureSpeakerSpriteData(guiData);
    this._ensureDialogueBgImage(guiData);

    // Radii
    const scaleFactor = canvas.width / baseWidth;
    const dialogueRadii = this.resolveRadius(
      guiData.dialogueBox_BorderCorner ?? 0,
      scaleFactor
    );
    const speakerRadii = this.resolveRadius(
      guiData.dialogueBox_SpeakerBorderCorner ?? 0,
      scaleFactor
    );
    const buttonRadii = this.resolveRadius(
      guiData.dialogueBox_ButtonBorderCorner ?? 0,
      scaleFactor
    );

    // --- Avatar management (load if speaker changed) ---
    if (this.lastSpeaker !== speaker) {
      this.lastSpeaker = speaker;
      const charData = this.getSpeakerData(speaker);
      this.activeAvatarData = charData?.avatar_img ?? null;
      this.activeAvatarImage = null;
      if (this.activeAvatarData) {
        const src = Array.isArray(this.activeAvatarData)
          ? this.activeAvatarData[0]
          : this.activeAvatarData;
        const img = this._loadImage(src);
        if (img) this.activeAvatarImage = img;
      }
    }

    // Calculate avatar geometry
    let contentOffsetX = textMarginX;
    let avatarWidth = 0,
      avatarHeight = 0,
      avatarX = 0,
      avatarY = 0;
    if (
      this.activeAvatarImage &&
      this.activeAvatarImage.complete &&
      this.activeAvatarData
    ) {
      const avatarRatio = 1; // as original
      avatarHeight = boxHeight + speakerBoxHeight;
      avatarWidth = avatarHeight * avatarRatio;
      avatarX = boxX + fixedAvatarPaddingX;
      avatarY = boxY + boxHeight - avatarHeight;
      contentOffsetX = fixedAvatarPaddingX + avatarWidth + textMarginX;
    }

    // --- Draw main dialogue box (image preferred, else color) ---
    const bgImg = this.dialogueBgImageCache.image;
    const bgImgData = this.dialogueBgImageCache.data;
    let bgDrawn = false;

    const bgImgReady =
      bgImg &&
      !this.failedImages.has(bgImg.src) &&
      bgImg.complete &&
      bgImg.naturalWidth > 0;

    if (bgImgReady) {
      ctx.save();
      ctx.globalAlpha = opacity;
      if (Array.isArray(bgImgData) && bgImgData.length >= 5) {
        const [, sx, sy, sw, sh] = bgImgData;
        ctx.drawImage(bgImg, sx, sy, sw, sh, boxX, boxY, boxWidth, boxHeight);
      } else {
        ctx.drawImage(bgImg, boxX, boxY, boxWidth, boxHeight);
      }
      ctx.restore();
      bgDrawn = true;
    }

    if (!bgDrawn) {
      this.drawStyledBox(
        ctx,
        boxX,
        boxY,
        boxWidth,
        boxHeight,
        borderThickness,
        dialogueRadii,
        dialogueBoxFillStyle,
        borderColor
      );
    }

    // --- Draw speaker name box (sprite preferred) ---
    const resolvedSpeaker = this.resolveSpeakerName(speaker);
    if (resolvedSpeaker) {
      ctx.font = `bold ${speakerFontSize}px ${fontFamily}`;
      const speakerMetrics = ctx.measureText(resolvedSpeaker);
      const speakerBoxY = boxY - speakerBoxHeight;
      const speakerLengthSetting = (
        guiData.dialogueBox_SpeakerLength ?? "short"
      ).toLowerCase();

      let speakerBoxWidth, speakerBoxX, textAnchorX, textAlign;
      if (speakerLengthSetting === "long") {
        speakerBoxWidth = boxWidth;
        speakerBoxX = boxX;
        textAnchorX = speakerBoxX + contentOffsetX;
        textAlign = "left";
      } else {
        const speakerPaddingX = speakerFontSize * 0.8;
        speakerBoxWidth = speakerMetrics.width + speakerPaddingX * 2;
        speakerBoxX = boxX + contentOffsetX;
        textAnchorX = speakerBoxX + speakerBoxWidth / 2;
        textAlign = "center";
      }

      let speakerBoxDrawn = false;
      const spriteData = {
        left: this.speakerSpriteData.left,
        center: this.speakerSpriteData.center,
        right: this.speakerSpriteData.right,
      };
      if (spriteData.left && spriteData.center && spriteData.right) {
        speakerBoxDrawn = this.drawSpeakerSpriteBox(
          ctx,
          speakerBoxX,
          speakerBoxY,
          speakerBoxWidth,
          speakerBoxHeight,
          spriteData
        );
      }
      if (!speakerBoxDrawn) {
        this.drawStyledBox(
          ctx,
          speakerBoxX,
          speakerBoxY,
          speakerBoxWidth,
          speakerBoxHeight,
          borderThickness,
          speakerRadii,
          speakerBoxFillStyle,
          borderColor
        );
      }

      ctx.fillStyle = fontSpeakerColor;
      ctx.textAlign = textAlign;
      ctx.textBaseline = "middle";
      ctx.fillText(
        resolvedSpeaker,
        textAnchorX,
        speakerBoxY + speakerBoxHeight / 2
      );
    }

    // --- Dialogue text ---
    ctx.fillStyle = fontColor;
    ctx.font = `${textFontSize}px ${fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const textX = boxX + contentOffsetX;
    const textY = boxY + textMarginX;
    const maxTextWidth = boxWidth - contentOffsetX - textMarginX;
    const lines = this.wrapText(ctx, this.displayText, maxTextWidth);
    const lineHeight = textFontSize * 1.4;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX, textY + i * lineHeight);
    }

    // --- Avatar (draw on top) ---
    if (
      avatarWidth > 0 &&
      this.activeAvatarImage &&
      this.activeAvatarImage.complete
    ) {
      const avatarData = this.getSpeakerData(speaker)?.avatar_img;
      if (Array.isArray(avatarData) && avatarData.length >= 5) {
        const [, sx, sy, sw, sh] = avatarData;
        ctx.drawImage(
          this.activeAvatarImage,
          sx,
          sy,
          sw,
          sh,
          avatarX,
          avatarY,
          avatarWidth,
          avatarHeight
        );
      } else {
        ctx.drawImage(
          this.activeAvatarImage,
          avatarX,
          avatarY,
          avatarWidth,
          avatarHeight
        );
      }
    }

    // --- Buttons (Auto + Skip) ---
    this.renderButtons(
      ctx,
      boxX,
      boxWidth,
      boxY,
      boxHeight,
      textFontSize,
      fontFamily,
      bgButtonColor,
      borderColor,
      borderButtonThickness,
      fontButtonColor,
      buttonRadii,
      bgButtonColorHover,
      guiData
    );
  }

  /* -------------------------
     ---------- BUTTONS ----------
     ------------------------- */

  renderButtons(
    ctx,
    boxX,
    boxWidth,
    boxY,
    boxHeight,
    baseFontSize,
    fontFamily,
    bgButtonColor,
    borderColor,
    borderButtonThickness,
    fontButtonColor,
    buttonRadii,
    bgButtonColorHover,
    guiData
  ) {
    const canvas = this.core.canvas;
    const baseWidth = this.core.baseWidth || 1920;

    const buttonPadding = 20 * (canvas.width / baseWidth);
    const autoFontSize = baseFontSize * 0.8;
    ctx.font = `${autoFontSize}px ${fontFamily}`;
    const btnPaddingX = autoFontSize * 0.8;
    const btnPaddingY = autoFontSize * 0.4;
    const gap = 10;

    const skipActiveColor =
      guiData.dialogueBox_ButtonBackgroundColor_Skip ?? "#e05737";
    const autoActiveColor =
      guiData.dialogueBox_ButtonBackgroundColor_Auto ?? "#35a440";

    // Skip button
    const ffLabel = "Skip";
    const ffMetrics = ctx.measureText(ffLabel);
    const ffWidth = ffMetrics.width + btnPaddingX * 2;
    const btnHeight = autoFontSize + btnPaddingY * 2;
    const ffX = boxX + boxWidth - ffWidth - buttonPadding;
    const btnY = boxY + boxHeight - btnHeight - buttonPadding;

    this.ffButton = { x: ffX, y: btnY, width: ffWidth, height: btnHeight };

    let skipBg = bgButtonColor;
    if (this.fastForwardMode) skipBg = skipActiveColor;
    else if (this.hoverIndex === 1) skipBg = bgButtonColorHover;

    this.drawStyledBox(
      ctx,
      ffX,
      btnY,
      ffWidth,
      btnHeight,
      borderButtonThickness,
      buttonRadii,
      skipBg,
      borderColor
    );
    ctx.fillStyle = fontButtonColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ffLabel, ffX + ffWidth / 2, btnY + btnHeight / 2);

    // Auto button
    const autoLabel = this.autoMode ? "Auto ON" : "Auto";
    const autoMetrics = ctx.measureText(autoLabel);
    const autoWidth = autoMetrics.width + btnPaddingX * 2;
    const autoX = ffX - autoWidth - gap;

    this.autoButton = {
      x: autoX,
      y: btnY,
      width: autoWidth,
      height: btnHeight,
    };

    let autoBg = bgButtonColor;
    if (this.autoMode) autoBg = autoActiveColor;
    else if (this.hoverIndex === 0) autoBg = bgButtonColorHover;

    this.drawStyledBox(
      ctx,
      autoX,
      btnY,
      autoWidth,
      btnHeight,
      borderButtonThickness,
      buttonRadii,
      autoBg,
      borderColor
    );
    ctx.fillStyle = fontButtonColor;
    ctx.fillText(autoLabel, autoX + autoWidth / 2, btnY + btnHeight / 2);
  }

  /* -------------------------
     ---------- UTILITIES / LOOKUPS ----------
     ------------------------- */

  resolveSpeakerName(speaker) {
    if (speaker === "[player]")
      return this.core.currentCharacter?.name ?? "Player";
    return speaker;
  }

  getSpeakerData(speaker) {
    if (speaker === "[player]") return this.core.currentCharacter;
    return (this.core.characters ?? []).find((c) => c.name === speaker);
  }

  // Call to explicitly free listeners + optionally cached images (if needed)
  destroy({ keepImages = true } = {}) {
    try {
      this.core.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    } catch (e) {
      // ignore
    }
    if (!keepImages) {
      this.imageCache = {};
      this.failedImages = new Set();
      this.dialogueBgImageCache = { data: null, image: null };
    }
  }
}
