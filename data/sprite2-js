export class Sprite {
  constructor(core) {
    this.core = core;
    this.image = null;
    this.visible = false;

    // Destination (Screen Position & Size)
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;

    // Source (Crop Position & Size)
    this.sx = 0;
    this.sy = 0;
    this.sWidth = 0;
    this.sHeight = 0;

    // 🔥 DESIGN RESOLUTION (Kung anong resolution ka nag-design sa Photoshop/JSON)
    // Halimbawa: 720p (1280x720) or 1080p (1920x1080).
    // Eto ang magiging basehan ng scaling.
    this.DESIGN_HEIGHT = 720;
  }

  async update(data) {
    if (data === null) {
      this.clear();
      return;
    }

    // 1. Load Image
    if (data.image) {
      const img = new Image();
      img.src = data.image;
      await new Promise((resolve) => (img.onload = resolve));
      this.image = img;
      this.visible = true;
    }

    // 2. Destination Data (Screen)
    this.x = data.x !== undefined ? data.x : 0;
    this.y = data.y !== undefined ? data.y : 0;
    this.width = data.width !== undefined ? data.width : 0;
    this.height = data.height !== undefined ? data.height : 0;

    // 3. Source Data (Crop)
    // Kung walang binigay na sx/sy, default sa 0 (Top-Left)
    // Kung walang sWidth/sHeight, kukunin natin ang buong size ng image mamaya sa render.
    this.sx = data.sx !== undefined ? data.sx : 0;
    this.sy = data.sy !== undefined ? data.sy : 0;
    this.sWidth = data.sWidth !== undefined ? data.sWidth : null;
    this.sHeight = data.sHeight !== undefined ? data.sHeight : null;
  }

  clear() {
    this.visible = false;
    this.image = null;
  }

  render(ctx) {
    if (!this.visible || !this.image) return;

    const canvas = this.core.canvas;

    // 🔥 RESPONSIVE SCALING LOGIC
    // Kinukuha natin ang ratio ng current Canvas Height vs Design Height.
    // Example: Kung Canvas ay 1080 at Design ay 720, scaleFactor = 1.5
    const scaleFactor = canvas.height / this.DESIGN_HEIGHT;

    // --- A. CALCULATE SOURCE (CROP) ---
    // Kung walang sWidth na binigay, gamitin ang buong image width
    const finalSx = this.sx;
    const finalSy = this.sy;
    const finalSWidth =
      this.sWidth !== null ? this.sWidth : this.image.naturalWidth;
    const finalSHeight =
      this.sHeight !== null ? this.sHeight : this.image.naturalHeight;

    // --- B. CALCULATE DESTINATION (SCREEN) ---
    // I-multiply ang JSON values sa scaleFactor para responsive
    const drawX = this.x * scaleFactor;
    const drawY = this.y * scaleFactor;

    // Kung may defined width/height sa JSON, i-scale yun.
    // Kung wala, gamitin ang sWidth/sHeight at i-scale (Actual Size preservation)
    const drawW = (this.width !== 0 ? this.width : finalSWidth) * scaleFactor;
    const drawH =
      (this.height !== 0 ? this.height : finalSHeight) * scaleFactor;

    // --- C. DRAW (9 Arguments) ---
    ctx.drawImage(
      this.image,
      finalSx,
      finalSy,
      finalSWidth,
      finalSHeight, // Source (Crop)
      drawX,
      drawY,
      drawW,
      drawH // Destination (Screen)
    );
  }
}
