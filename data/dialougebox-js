export class DialogueBox {
  constructor(core) {
    this.core = core;

    // Font size ratios (proportional to box height)
    this.speakerMinRatio = 0.08;
    this.speakerMaxRatio = 0.15;
    this.textMinRatio = 0.06;
    this.textMaxRatio = 0.12;
  }

  render(ctx, speaker, text) {
    const canvas = this.core.canvas;
    const boxHeight = canvas.height * 0.25;
    const boxY = canvas.height - boxHeight;

    // Draw box background
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, boxY, canvas.width, boxHeight);

    // --- Font Sizes ---
    const speakerFontSize = boxHeight * 0.12; // 12% of box height
    const clampedSpeakerFont = Math.max(
      boxHeight * this.speakerMinRatio,
      Math.min(speakerFontSize, boxHeight * this.speakerMaxRatio)
    );

    const textFontSize = boxHeight * 0.09; // 9% of box height
    const clampedTextFont = Math.max(
      boxHeight * this.textMinRatio,
      Math.min(textFontSize, boxHeight * this.textMaxRatio)
    );

    // --- Speaker ---
    ctx.fillStyle = "#FFD700";
    ctx.font = `${clampedSpeakerFont}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(speaker, canvas.width * 0.05, boxY + boxHeight * 0.08);

    // --- Dialogue text ---
    ctx.fillStyle = "#fff";
    ctx.font = `${clampedTextFont}px Arial`;

    const textMarginX = canvas.width * 0.05;
    const textMaxWidth = canvas.width - textMarginX * 2;
    const lines = this.wrapText(ctx, text, textMaxWidth);

    const lineHeight = clampedTextFont * 1.2;
    lines.forEach((line, i) => {
      ctx.fillText(line, textMarginX, boxY + boxHeight * 0.3 + i * lineHeight);
    });
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    let line = "";
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    return lines;
  }
}
