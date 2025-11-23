export class Sprite {
  constructor(core) {
    this.core = core;
    this.image = null;
    this.visible = false;

    // Default values
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;

    // 🔥 DESIGN RESOLUTION
    // Ito ang size ng "Canvas" noong dinesign mo na 350x500 ang character.
    // Standard ito: 1280x720 (720p) or 1920x1080 (1080p).
    // Kung ang 500px height ay mukhang tama sa 720p screen, i-set mo ito sa 720.
    this.DESIGN_HEIGHT = 720;
  }

  async update(data) {
    if (data === null) {
      this.clear();
      return;
    }

    // Load Image
    if (data.image) {
      const img = new Image();
      img.src = data.image;
      await new Promise((resolve) => (img.onload = resolve));
      this.image = img;
      this.visible = true;
    }

    // Kunin ang exact pixels galing sa JSON
    this.x = data.x !== undefined ? data.x : 0;
    this.y = data.y !== undefined ? data.y : 0;
    this.width = data.width !== undefined ? data.width : 0;
    this.height = data.height !== undefined ? data.height : 0;
  }

  clear() {
    this.visible = false;
    this.image = null;
  }

  render(ctx) {
    if (!this.visible || !this.image) return;

    const canvas = this.core.canvas;

    // 🔥 RESPONSIVE CALCULATION
    // Kinukuha natin kung gaano kalaki ang current canvas kumpara sa design resolution.
    // Scale by Height (Standard sa Visual Novels para hindi ma-stretch)
    const scaleFactor = canvas.height / this.DESIGN_HEIGHT;

    // I-aapply natin ang scale sa pixels mula sa JSON
    const drawW = this.width * scaleFactor;
    const drawH = this.height * scaleFactor;

    // Pati position, i-scale din natin para kung x:100, gagalaw din siya base sa laki ng screen
    const drawX = this.x * scaleFactor;
    const drawY = this.y * scaleFactor;

    // Draw
    ctx.drawImage(this.image, drawX, drawY, drawW, drawH);
  }
}
