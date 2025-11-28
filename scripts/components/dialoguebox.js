export class DialogueBox {
  constructor(core) {
    this.core = core;

    this.speakerMinRatio = 0.08;
    this.speakerMaxRatio = 0.15;
    this.textMinRatio = 0.06;
    this.textMaxRatio = 0.12;

    // Typewriter
    this.fullText = "";
    this.displayText = "";
    this.charIndex = 0;
    this.lastTime = 0;
    this.speed = 20;
    this.isTyping = false;

    // Track when typing finished
    this.typingFinishedTime = null;

    // Modes
    this.autoMode = false;
    this.fastForwardMode = false;

    // Buttons
    this.autoButton = { x: 0, y: 0, width: 0, height: 0 };
    this.ffButton = { x: 0, y: 0, width: 0, height: 0 };

    // 🔥 NEW: Hover tracking
    this.hoverIndex = -1; // -1: none, 0: Auto, 1: Skip
    this.mouseMoveHandler = this.handleMouseMove.bind(this);

    // Add mousemove listener right away since DialogueBox is always on screen
    this.core.canvas.addEventListener("mousemove", this.mouseMoveHandler);

    // Avatar Image Caching
    this.lastSpeaker = null;
    this.activeAvatarImage = null;
    this.activeAvatarData = null;
  }

  // 🔥 NEW: Method to handle mouse movement and update hover state
  handleMouseMove(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const scaleX = this.core.canvas.width / rect.width;
    const scaleY = this.core.canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    let newHoverIndex = -1;

    // Check Auto Button (index 0)
    if (
      mouseX >= this.autoButton.x &&
      mouseX <= this.autoButton.x + this.autoButton.width &&
      mouseY >= this.autoButton.y &&
      mouseY <= this.autoButton.y + this.autoButton.height
    ) {
      newHoverIndex = 0;
    }
    // Check Skip Button (index 1)
    else if (
      mouseX >= this.ffButton.x &&
      mouseX <= this.ffButton.x + this.ffButton.width &&
      mouseY >= this.ffButton.y &&
      mouseY <= this.ffButton.y + this.ffButton.height
    ) {
      newHoverIndex = 1;
    }

    if (this.hoverIndex !== newHoverIndex) {
      this.hoverIndex = newHoverIndex;
    }
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

  startTyping(newText) {
    this.fullText = newText;
    if (this.fastForwardMode) {
      this.displayText = newText;
      this.charIndex = newText.length;
      this.isTyping = false;
      this.typingFinishedTime = Date.now();
    } else {
      this.displayText = "";
      this.charIndex = 0;
      this.lastTime = 0;
      this.isTyping = true;
      this.typingFinishedTime = null;
    }
  }

  skipTypewriter() {
    if (this.isTyping) {
      this.displayText = this.fullText;
      this.charIndex = this.fullText.length;
      this.isTyping = false;
      this.typingFinishedTime = Date.now();
      return true;
    }
    return false;
  }

  updateTyping(delta) {
    if (!this.isTyping) return;

    if (this.fastForwardMode) {
      this.skipTypewriter();
      return;
    }

    this.lastTime += delta;
    if (this.lastTime >= this.speed) {
      this.lastTime = 0;

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

  resolveSpeakerName(speaker) {
    if (speaker === "[player]") {
      return this.core.currentCharacter?.name || "Player";
    }
    return speaker;
  }

  getSpeakerData(speaker) {
    if (speaker === "[player]") {
      return this.core.currentCharacter;
    }
    return this.core.characters?.find((c) => c.name === speaker);
  }

  handleClick(x, y) {
    // Check Auto Button
    if (
      x >= this.autoButton.x &&
      x <= this.autoButton.x + this.autoButton.width &&
      y >= this.autoButton.y &&
      y <= this.autoButton.y + this.autoButton.height
    ) {
      this.toggleAuto();
      return true;
    }

    // Check Fast Forward Button
    if (
      x >= this.ffButton.x &&
      x <= this.ffButton.x + this.ffButton.width &&
      y >= this.ffButton.y &&
      y <= this.ffButton.y + this.ffButton.height
    ) {
      this.toggleFastForward();
      return true;
    }

    return false;
  }

  // Helper function for RGBA color conversion
  hexToRgba(hex, alpha) {
    // Basic check for valid hex string
    if (!hex || hex[0] !== "#" || (hex.length !== 7 && hex.length !== 4)) {
      return `rgba(0, 0, 0, ${alpha})`;
    }

    let r, g, b;
    if (hex.length === 4) {
      // Handle shorthand (#rgb)
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      // Handle standard (#rrggbb)
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Helper: Handles Rounded Corners & Outward Borders
  drawStyledBox(ctx, x, y, w, h, thickness, radius, bgColor, borderColor) {
    // 1. Draw Background (Inner Box)
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (radius > 0) {
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, radius);
      } else {
        // Fallback for browsers without roundRect
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
      }
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // 2. Draw Border (Outward Stroke)
    if (thickness > 0) {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = borderColor;

      const offset = thickness / 2;
      const bx = x - offset;
      const by = y - offset;
      const bw = w + thickness;
      const bh = h + thickness;

      // Outer radius needs to be slightly larger to match curvature
      const outerRadius = radius > 0 ? radius + offset : 0;

      ctx.beginPath();
      if (outerRadius > 0) {
        if (ctx.roundRect) {
          ctx.roundRect(bx, by, bw, bh, outerRadius);
        } else {
          ctx.moveTo(bx + outerRadius, by);
          ctx.lineTo(bx + bw - outerRadius, by);
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + outerRadius);
          ctx.lineTo(bx + bw, by + bh - outerRadius);
          ctx.quadraticCurveTo(
            bx + bw,
            by + bh,
            bx + bw - outerRadius,
            by + bh
          );
          ctx.lineTo(bx + outerRadius, by + bh);
          ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - outerRadius);
          ctx.lineTo(bx, by + outerRadius);
          ctx.quadraticCurveTo(bx, by, bx + outerRadius, by);
        }
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.stroke();
    }
  }

  render(ctx, speaker, text) {
    if (this.fullText !== text) {
      this.startTyping(text);
    }
    this.updateTyping(16.67);

    // Setup Dimensions
    const canvas = this.core.canvas;
    const baseWidth = this.core.baseWidth || 1920;
    const baseHeight = this.core.baseHeight || 1080;

    const guiData = this.core.dataCache?.gameGUI?.gui_dialoguebox;
    const globalSettings = this.core.dataCache?.gameGUI?.game_gui_settings;

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

    // --- Calculate Scaled Dimensions ---
    const dialogueBaseHeight = guiData.dialogueBox_Hieght || 300;
    const dialogueBaseWidth = guiData.dialogueBox_Width || 1920;

    // Scale Dimensions
    const boxHeight = (dialogueBaseHeight / baseHeight) * canvas.height;
    const scaledWidth = (dialogueBaseWidth / baseWidth) * canvas.width;

    // Scale Padding, Margin, Border Thickness, & Corner Radius
    const textMarginX =
      (guiData.dialogueBox_Padding || 10) * (canvas.width / baseWidth);
    const bottomMargin =
      (guiData.dialogueBox_BottomMargin || 0) * (canvas.height / baseHeight);
    const borderThickness =
      (guiData.dialogueBox_BorderThickness || 0) * (canvas.width / baseWidth);

    // Corner Radii
    const cornerRadius =
      (guiData.dialogueBox_BorderCorner || 0) * (canvas.width / baseWidth);
    const speakerCornerRadius =
      (guiData.dialogueBox_SpeakerBorderCorner || 0) *
      (canvas.width / baseWidth);

    const fixedAvatarPaddingX = 20 * (canvas.width / baseWidth);

    // Style for Buttons
    const borderButtonThickness =
      (guiData.dialogueBox_ButtonBorderThickness || 0) *
      (canvas.width / baseWidth);
    const buttonCornerRadius =
      (guiData.dialogueBox_ButtonBorderCorner || 0) *
      (canvas.width / baseWidth);

    const bgButtonColor =
      guiData.dialogueBox_ButtonBackgroundColor || "#1A1A1A";
    const fontButtonColor = guiData.dialogueBox_ButtonFontColor || "#fff";

    // 🔥 NEW: Extract Hover Color
    const bgButtonColorHover =
      guiData.dialogueBox_ButtonBackgroundColor_Hover || bgButtonColor;

    // Centering the box & Applying Bottom Margin
    const boxWidth = scaledWidth;
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = canvas.height - boxHeight - bottomMargin;

    // Get Colors
    const bgColor = guiData.dialogueBox_BackgroundColor || "#1A1A1A";
    const bgSpeakerColor =
      guiData.dialogueBox_SpeakerBackgroundColor || "#1A1A1A";
    const fontSpeakerColor = guiData.dialogueBox_SpeakerFontColor || "#fff";
    const opacity = guiData.dialogueBox_Opacity || 0.9;
    const fontColor = guiData.dialogueBox_FontColor || "#fff";
    const borderColor = guiData.dialogueBox_BorderColor || "#fff";

    const fontFamily = globalSettings.fontFamily || "Arial, sans-serif";
    const dialogueBoxFillStyle = this.hexToRgba(bgColor, opacity);
    const speakerBoxFillStyle = this.hexToRgba(bgSpeakerColor, opacity);

    const baseFontSize =
      (globalSettings.fontSize || 12) * (canvas.height / baseHeight);
    const textFontSize = baseFontSize * 1.0;
    const speakerFontSize = baseFontSize * 1.3;

    // Calculate Speaker Box Dimensions
    const speakerPaddingY = speakerFontSize * 0.3;
    const speakerBoxHeight = speakerFontSize + speakerPaddingY * 2;

    // Avatar Logic
    if (this.lastSpeaker !== speaker) {
      this.lastSpeaker = speaker;
      const charData = this.getSpeakerData(speaker);
      this.activeAvatarData = charData?.avatar_img || null;
      this.activeAvatarImage = null;

      if (this.activeAvatarData) {
        this.activeAvatarImage = new Image();
        const src = Array.isArray(this.activeAvatarData)
          ? this.activeAvatarData[0]
          : this.activeAvatarData;
        this.activeAvatarImage.src = src;
      }
    }

    // --- 4. Draw Main Dialogue Box ---
    this.drawStyledBox(
      ctx,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      borderThickness,
      cornerRadius,
      dialogueBoxFillStyle,
      borderColor
    );

    // --- 5. Render Avatar Image ---
    let contentOffsetX = textMarginX;

    if (
      this.activeAvatarImage &&
      this.activeAvatarImage.complete &&
      this.activeAvatarData
    ) {
      const avatarRatio = 1;
      const avatarHeight = boxHeight + speakerBoxHeight;
      const avatarWidth = avatarHeight * avatarRatio;

      const avatarX = boxX + fixedAvatarPaddingX;
      const avatarY = boxY + boxHeight - avatarHeight;

      const avatarData = this.getSpeakerData(speaker)?.avatar_img;
      if (Array.isArray(avatarData)) {
        const [_, sx, sy, sw, sh] = avatarData;
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

      contentOffsetX = fixedAvatarPaddingX + avatarWidth + textMarginX;
    }

    // --- 6. Speaker Name Box ---
    const resolvedSpeaker = this.resolveSpeakerName(speaker);

    if (resolvedSpeaker) {
      ctx.font = `bold ${speakerFontSize}px ${fontFamily}`;
      const speakerMetrics = ctx.measureText(resolvedSpeaker);

      const speakerPaddingX = speakerFontSize * 0.8;
      const speakerBoxWidth = speakerMetrics.width + speakerPaddingX * 2;

      const speakerBoxX = boxX + contentOffsetX;
      const speakerBoxY = boxY - speakerBoxHeight;

      this.drawStyledBox(
        ctx,
        speakerBoxX,
        speakerBoxY,
        speakerBoxWidth,
        speakerBoxHeight,
        borderThickness,
        speakerCornerRadius,
        speakerBoxFillStyle,
        borderColor
      );

      ctx.fillStyle = fontSpeakerColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        resolvedSpeaker,
        speakerBoxX + speakerBoxWidth / 2,
        speakerBoxY + speakerBoxHeight / 2
      );
    }

    // --- 7. Dialogue Text ---
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

    // --- 8. Buttons ---
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
      buttonCornerRadius,
      bgButtonColorHover // 🔥 Passing the new hover color
    );
  }

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
    buttonCornerRadius,
    bgButtonColorHover // 🔥 New Param
  ) {
    const canvas = this.core.canvas;
    const baseWidth = this.core.baseWidth || 1920;

    const buttonPadding = 20 * (canvas.width / baseWidth);
    const autoFontSize = baseFontSize * 0.8;
    ctx.font = `${autoFontSize}px ${fontFamily}`;
    const btnPaddingX = autoFontSize * 0.8;
    const btnPaddingY = autoFontSize * 0.4;
    const gap = 10;

    // Hardcoded active colors (from previous implementations)
    const skipActiveColor = "#e05737";
    const autoActiveColor = "#35a440";

    // Skip Button (Index 1)
    const ffLabel = "Skip";
    const ffMetrics = ctx.measureText(ffLabel);
    const ffWidth = ffMetrics.width + btnPaddingX * 2;
    const btnHeight = autoFontSize + btnPaddingY * 2;

    const ffX = boxX + boxWidth - ffWidth - buttonPadding;
    const btnY = boxY + boxHeight - btnHeight - buttonPadding;

    // Update button position for mouse tracking
    this.ffButton = { x: ffX, y: btnY, width: ffWidth, height: btnHeight };

    // Determine Skip Button Color
    let skipBgColor = bgButtonColor;
    if (this.fastForwardMode) {
      skipBgColor = skipActiveColor; // Active (FF Mode) is prioritized
    } else if (this.hoverIndex === 1) {
      skipBgColor = bgButtonColorHover; // Hover
    }

    // Draw Skip Button
    this.drawStyledBox(
      ctx,
      ffX,
      btnY,
      ffWidth,
      btnHeight,
      borderButtonThickness,
      buttonCornerRadius,
      skipBgColor, // 🔥 Use calculated color
      borderColor
    );

    ctx.fillStyle = fontButtonColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ffLabel, ffX + ffWidth / 2, btnY + btnHeight / 2);

    // Auto Button (Index 0)
    const autoLabel = this.autoMode ? "Auto ON" : "Auto";
    const autoMetrics = ctx.measureText(autoLabel);
    const autoWidth = autoMetrics.width + btnPaddingX * 2;
    const autoX = ffX - autoWidth - gap;

    // Update button position for mouse tracking
    this.autoButton = {
      x: autoX,
      y: btnY,
      width: autoWidth,
      height: btnHeight,
    };

    // Determine Auto Button Color
    let autoBgColor = bgButtonColor;
    if (this.autoMode) {
      autoBgColor = autoActiveColor; // Active (Auto Mode) is prioritized
    } else if (this.hoverIndex === 0) {
      autoBgColor = bgButtonColorHover; // Hover
    }

    // Draw Auto Button
    this.drawStyledBox(
      ctx,
      autoX,
      btnY,
      autoWidth,
      btnHeight,
      borderButtonThickness,
      buttonCornerRadius,
      autoBgColor, // 🔥 Use calculated color
      borderColor
    );

    ctx.fillStyle = fontButtonColor;
    ctx.fillText(autoLabel, autoX + autoWidth / 2, btnY + btnHeight / 2);
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (let w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxWidth && line !== "") {
        lines.push(line.trim());
        line = w + " ";
      } else {
        line = test;
      }
    }
    if (line) lines.push(line.trim());
    return lines;
  }
}
