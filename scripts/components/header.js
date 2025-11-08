export class Header {
  constructor(core) {
    this.core = core;
    this.fontSize = 24; // initial
    this.minFontRatio = 0.3; // proportion of header height
    this.maxFontRatio = 0.6; // proportion of header height
  }

  onResize(scale) {
    const canvas = this.core.canvas;
    const headerHeight = canvas.height * 0.06;

    // Dynamically scale font size based on header height
    this.fontSize = headerHeight * 0.5; // 50% of header height

    // Clamp based on min/max ratios
    this.fontSize = Math.max(
      headerHeight * this.minFontRatio,
      Math.min(this.fontSize, headerHeight * this.maxFontRatio)
    );
  }

  render(ctx) {
    const c = this.core.currentCharacter;
    const canvas = this.core.canvas;
    const headerHeight = canvas.height * 0.06;

    // Draw header background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    // Draw character info
    ctx.fillStyle = "#fff";
    ctx.font = `${this.fontSize}px Arial`;
    ctx.textBaseline = "middle";

    // Money - left
    ctx.textAlign = "left";
    ctx.fillText(`Money: ${c.money}`, canvas.width * 0.04, headerHeight / 2);

    // Energy - right
    ctx.textAlign = "right";
    ctx.fillText(`Energy: ${c.energy}`, canvas.width * 0.96, headerHeight / 2);
  }
}
