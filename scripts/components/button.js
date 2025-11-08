export class Button {
  constructor(core, data) {
    this.core = core;
    this.data = data;
    this.id = data.id;
    this.text = data.text || "";
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.width = data.width || 200;
    this.height = data.height || 60;

    this.base = { ...data };

    // Font size logic
    this.fontSize = 20; // initial
    this.minFontRatio = 0.3; // min proportion of button height
    this.maxFontRatio = 0.6; // max proportion of button height
  }

  resize(scale) {
    this.x = this.base.x * scale;
    this.y = this.base.y * scale;
    this.width = this.base.width * scale;
    this.height = this.base.height * scale;

    // Scale font proportionally to button height
    this.fontSize = this.height * 0.5; // 50% of button height
    this.fontSize = Math.max(
      this.height * this.minFontRatio,
      Math.min(this.fontSize, this.height * this.maxFontRatio)
    );
  }

  render(ctx) {
    // Draw button background
    ctx.fillStyle = "rgba(54, 54, 54, 0.6)";
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw button text
    ctx.fillStyle = "#fff";
    ctx.font = `${this.fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
  }

  isInside(mx, my) {
    return (
      mx > this.x &&
      mx < this.x + this.width &&
      my > this.y &&
      my < this.y + this.height
    );
  }
}
