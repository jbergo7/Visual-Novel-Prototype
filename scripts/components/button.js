// components/button.js

export class Button {
  // 👇 Base Font Size at Padding sa Design Resolution (e.g., 720p)
  static DEFAULT_HEIGHT = 60;
  static DEFAULT_FONT_SIZE = 28; // Uniform size for all buttons in design units
  static PADDING_X = 40; // Padding sa kanan at kaliwa (total)

  constructor(core, data) {
    this.core = core;
    this.data = data;
    this.id = data.id;
    this.text = data.text || "";
    this.base = { ...data };

    // Use a temporary context to measure text width
    const ctx = core.canvas.getContext("2d");

    // Calculate the required width based on text length + padding
    const defaultWidth = this.calculateDefaultWidth(ctx, this.text);

    // 1. Assign Base Properties (Design Units)
    this.base.x = data.x || 0;
    this.base.y = data.y || 0;
    // 👇 Awtomatikong gamitin ang default width kung walang binigay
    this.base.width = data.width || defaultWidth;
    this.base.height = data.height || Button.DEFAULT_HEIGHT;

    // Display Properties (Scaled)
    this.x = this.base.x;
    this.y = this.base.y;
    this.width = this.base.width;
    this.height = this.base.height;

    this.fontSize = Button.DEFAULT_FONT_SIZE;

    this.clickHandler = null;
    this.active = false; // track if button should respond
  }

  /**
   * Helper to calculate the required width based on text measurement.
   * Dapat itong tumakbo sa Design Resolution scale.
   */
  calculateDefaultWidth(ctx, text) {
    // Assume context is currently running at the right scale for measurement
    // Use a fixed font size for measurement
    ctx.font = `${Button.DEFAULT_FONT_SIZE}px Arial`;
    const textMetrics = ctx.measureText(text);

    // Text width + left/right padding
    return textMetrics.width + Button.PADDING_X;
  }

  resize(scale) {
    this.x = this.base.x * scale;
    this.y = this.base.y * scale;
    this.width = this.base.width * scale;
    this.height = this.base.height * scale;

    // 👇 Uniform Font Size: Scale the default font size
    this.fontSize = Button.DEFAULT_FONT_SIZE * scale;
  }

  render(ctx) {
    // Background color
    ctx.fillStyle = "rgba(54, 54, 54, 0.6)";
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Text
    ctx.fillStyle = "#fff";
    // Gamitin ang scaled font size
    ctx.font = `${this.fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw text
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

  addClickListener(callback) {
    this.removeClickListener();
    this.active = true;

    this.clickHandler = (e) => {
      if (!this.active) return;
      if (this.core.saveLoadPopup?.visible || this.core.menuPopup?.visible)
        return; // Added menuPopup check

      const rect = this.core.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isInside(mouseX, mouseY)) {
        callback(this);
      }
    };

    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  removeClickListener() {
    if (this.clickHandler) {
      this.active = false;
      this.core.canvas.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
  }

  // 👇 REMOVED: getFontSizeToFit()
}
