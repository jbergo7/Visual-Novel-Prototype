export class Header {
  constructor(core) {
    this.core = core;
    this.fontSize = 24; // initial font size
    this.minFontRatio = 0.3;
    this.maxFontRatio = 0.6;
  }

  onResize(scale) {
    const canvas = this.core.canvas;
    const headerHeight = canvas.height * 0.06;

    this.fontSize = Math.max(
      headerHeight * this.minFontRatio,
      Math.min(headerHeight * 0.5, headerHeight * this.maxFontRatio)
    );
  }

  render(ctx) {
    const canvas = this.core.canvas;
    const headerHeight = canvas.height * 0.06;

    const c = this.core.currentCharacter;
    if (!c) return;

    // Always redraw header
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

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
