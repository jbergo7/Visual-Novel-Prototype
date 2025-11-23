// components/sprite.js
export class Sprite {
  constructor(core) {
    this.core = core;
    this.image = null;
    this.visible = false;

    // Default properties
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }

  /**
   * Loads and sets up the sprite data
   * @param {Object} data - { image: "path/to/img", x: 0.5, y: 0.2, width: 0.3, height: 0.8 }
   */
  async update(data) {
    if (!data) return; // Keep previous sprite if data is undefined? Or clear?
    // Usually VN keeps sprite until explicitly removed/changed.
    // For this implementation, calling update(null) clears it.

    if (data === null) {
      this.clear();
      return;
    }

    // Kung may bagong image path na binigay, i-load ito.
    if (data.image) {
      const img = new Image();
      img.src = data.image;
      await new Promise((resolve) => (img.onload = resolve));
      this.image = img;
      this.visible = true;
    }

    // I-update ang position at size kung may binigay
    if (data.x !== undefined) this.x = data.x;
    if (data.y !== undefined) this.y = data.y;
    if (data.width !== undefined) this.width = data.width;
    if (data.height !== undefined) this.height = data.height;
  }

  clear() {
    this.visible = false;
    this.image = null;
  }

  render(ctx) {
    if (!this.visible || !this.image) return;

    const canvas = this.core.canvas;

    // Convert relative values (0.0 - 1.0) to pixels
    // x, y, width, height are percentages of the canvas size
    const drawX = this.x * canvas.width;
    const drawY = this.y * canvas.height;
    const drawW = this.width * canvas.width;
    const drawH = this.height * canvas.height;

    ctx.drawImage(this.image, drawX, drawY, drawW, drawH);
  }
}
