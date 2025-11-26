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

    this.typingFinishedTime = null;

    // Modes
    this.autoMode = false;
    this.fastForwardMode = false; // 🔥 NEW: Fast Forward State

    // Button positions (computed per frame)
    this.autoButton = { x: 0, y: 0, width: 0, height: 0 };
    this.ffButton = { x: 0, y: 0, width: 0, height: 0 }; // 🔥 NEW: FF Button
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
    if (this.autoMode) {
      this.fastForwardMode = false; // Disable FF if Auto is on
      if (!this.isTyping) this.typingFinishedTime = Date.now();
    }
  }

  toggleFastForward() {
    this.fastForwardMode = !this.fastForwardMode;
    if (this.fastForwardMode) {
      this.autoMode = false; // Disable Auto if FF is on
      // If FF is ON, we force skip typing immediately
      if (this.isTyping) this.skipTypewriter();
    }
  }

  startTyping(newText) {
    this.fullText = newText;
    // 🔥 If Fast Forward is ON, skip animation immediately
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

    // 🔥 Extra safety: If FF mode is toggled ON while typing, finish instantly
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

    // 🔥 Check Fast Forward Button
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

  render(ctx, speaker, text) {
    if (this.fullText !== text) {
      this.startTyping(text);
    }

    this.updateTyping(16.67);

    const canvas = this.core.canvas;
    const boxHeight = canvas.height * 0.25;
    const boxY = canvas.height - boxHeight;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, boxY, canvas.width, boxHeight);

    // Fonts
    const speakerFontSize = boxHeight * 0.12;
    const textFontSize = boxHeight * 0.09;

    ctx.fillStyle = "#FFD700";
    ctx.font = `${speakerFontSize}px Arial`;
    ctx.textAlign = "left";

    const resolvedSpeaker = this.resolveSpeakerName(speaker);
    ctx.fillText(resolvedSpeaker, canvas.width * 0.05, boxY + boxHeight * 0.08);

    // Text
    ctx.fillStyle = "#fff";
    ctx.font = `${textFontSize}px Arial`;
    const marginX = canvas.width * 0.05;
    const maxWidth = canvas.width - marginX * 2;

    const lines = this.wrapText(ctx, this.displayText, maxWidth);
    const lineHeight = textFontSize * 1.2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], marginX, boxY + boxHeight * 0.3 + i * lineHeight);
    }

    // --------------------------------------
    // 🔥 BUTTONS RENDER (Auto & Fast Forward)
    // --------------------------------------
    const autoFontSize = textFontSize * 0.8;
    ctx.font = `${autoFontSize}px Arial`;

    const btnPaddingX = autoFontSize * 0.8;
    const btnPaddingY = autoFontSize * 0.4;
    const gap = 10; // Space between buttons

    // 1. FAST FORWARD BUTTON (Rightmost)
    const ffLabel = this.fastForwardMode ? "FFwd ON" : "FFwd"; // Short for Fast Forward
    const ffMetrics = ctx.measureText(ffLabel);
    const ffWidth = ffMetrics.width + btnPaddingX * 2;
    const btnHeight = autoFontSize + btnPaddingY * 2;

    const ffX = canvas.width - ffWidth - canvas.width * 0.03;
    const btnY = boxY - btnHeight - canvas.height * 0.01;

    this.ffButton = { x: ffX, y: btnY, width: ffWidth, height: btnHeight };

    // FF Background
    ctx.fillStyle = this.fastForwardMode ? "#FF4500" : "rgba(50,50,50,0.7)"; // Orange if ON
    ctx.fillRect(ffX, btnY, ffWidth, btnHeight);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(ffX, btnY, ffWidth, btnHeight);

    // FF Text
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ffLabel, ffX + ffWidth / 2, btnY + btnHeight / 2);

    // 2. AUTO BUTTON (Left of FF button)
    const autoLabel = this.autoMode ? "Auto ON" : "Auto";
    const autoMetrics = ctx.measureText(autoLabel);
    const autoWidth = autoMetrics.width + btnPaddingX * 2;

    const autoX = ffX - autoWidth - gap; // Position to the left of FF

    this.autoButton = {
      x: autoX,
      y: btnY,
      width: autoWidth,
      height: btnHeight,
    };

    // Auto Background
    ctx.fillStyle = this.autoMode ? "#00cc55" : "rgba(50,50,50,0.7)";
    ctx.fillRect(autoX, btnY, autoWidth, btnHeight);
    ctx.strokeRect(autoX, btnY, autoWidth, btnHeight);

    // Auto Text
    ctx.fillStyle = "#fff";
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
