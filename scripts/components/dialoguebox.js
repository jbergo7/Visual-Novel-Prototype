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
    this.speed = 35;
    this.isTyping = false;

    // Auto Mode
    this.autoMode = false;

    // Button position (computed per frame)
    this.autoButton = { x: 0, y: 0, width: 130, height: 50 };
  }

  toggleAuto() {
    this.autoMode = !this.autoMode;
  }

  startTyping(newText) {
    this.fullText = newText;
    this.displayText = "";
    this.charIndex = 0;
    this.lastTime = 0;
    this.isTyping = true;
  }

  /** FIRST CLICK → skip animation */
  skipTypewriter() {
    if (this.isTyping) {
      this.displayText = this.fullText;
      this.charIndex = this.fullText.length;
      this.isTyping = false;
      return true; // skipped
    }
    return false;
  }

  updateTyping(delta) {
    if (!this.isTyping) return;

    this.lastTime += delta;
    if (this.lastTime >= this.speed) {
      this.lastTime = 0;

      if (this.charIndex < this.fullText.length) {
        this.charIndex++;
        this.displayText = this.fullText.substring(0, this.charIndex);
      }

      if (this.charIndex >= this.fullText.length) {
        this.isTyping = false;
      }
    }
  }

  resolveSpeakerName(speaker) {
    if (speaker === "[player]") {
      return this.core.currentCharacter?.name || "Player";
    }
    return speaker;
  }

  // CLICK HANDLER for Auto button
  handleClick(x, y) {
    const btn = this.autoButton;

    if (
      x >= btn.x &&
      x <= btn.x + btn.width &&
      y >= btn.y &&
      y <= btn.y + btn.height
    ) {
      this.toggleAuto();
      return true;
    }

    return false;
  }

  render(ctx, speaker, text) {
    // Detect new dialogue
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

    // Dialogue text
    ctx.fillStyle = "#fff";
    ctx.font = `${textFontSize}px Arial`;
    const marginX = canvas.width * 0.05;
    const maxWidth = canvas.width - marginX * 2;

    const lines = this.wrapText(ctx, this.displayText, maxWidth);
    const lineHeight = textFontSize * 1.2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], marginX, boxY + boxHeight * 0.3 + i * lineHeight);
    }

    // 🔥 Responsive AUTO BUTTON (small, scaled to dialogue box)
    const autoFontSize = textFontSize * 0.8; // maliit kaysa dialogue text
    ctx.font = `${autoFontSize}px Arial`;

    const btnPaddingX = autoFontSize * 0.8;
    const btnPaddingY = autoFontSize * 0.4;

    const label = this.autoMode ? "Auto ON" : "Auto";
    const textMetrics = ctx.measureText(label);
    const btnWidth = textMetrics.width + btnPaddingX * 2;
    const btnHeight = autoFontSize + btnPaddingY * 2;

    const btnX = canvas.width - btnWidth - canvas.width * 0.03;
    const btnY = boxY - btnHeight - canvas.height * 0.01;

    // store hitbox
    this.autoButton = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };

    // background
    ctx.fillStyle = this.autoMode ? "#00cc55" : "rgba(50,50,50,0.7)";
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);

    // outline
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    // text
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, btnX + btnWidth / 2, btnY + btnHeight / 2);
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
