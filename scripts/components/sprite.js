export class Sprite {
  constructor(core) {
    this.core = core;
    this.image = null;
    this.visible = false;

    // Destination (Screen)
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;

    // Source (Crop)
    this.sx = 0;
    this.sy = 0;
    this.sWidth = 0;
    this.sHeight = 0;

    // Design Resolution
    this.DESIGN_HEIGHT = 720;
  }

  async update(data) {
    // 1. Clear if null
    if (!data) {
      this.clear();
      return;
    }

    let spriteData = data;

    // ---------------------------------------------------------
    // 🔥 DATA LOOKUP LOGIC
    // ---------------------------------------------------------
    // Kung may "character" at "pose", kunin ang data sa Cache
    if (data.character && data.pose) {
      const cache = this.core.dataCache?.characterSprites;

      if (cache && cache[data.character] && cache[data.character][data.pose]) {
        const baseData = cache[data.character][data.pose];

        // MERGE: Base Data (Cache) + Overrides (Scene Data)
        // Example: Cache has image/sx/sy. Scene has x/y overrides.
        spriteData = { ...baseData, ...data };
      } else {
        console.warn(
          `⚠️ Sprite not found in cache: ${data.character} -> ${data.pose}`
        );
        // Fallback: Use provided data as is, baka direct link pa rin
      }
    }

    // ---------------------------------------------------------
    // 2. LOAD IMAGE
    // ---------------------------------------------------------
    // Check if image source changed to avoid reloading same image
    if (spriteData.image) {
      if (!this.image || this.image.getAttribute("src") !== spriteData.image) {
        const img = new Image();
        img.src = spriteData.image;
        await new Promise((resolve) => (img.onload = resolve));
        this.image = img;
      }
      this.visible = true;
    }

    // ---------------------------------------------------------
    // 3. ASSIGN PROPERTIES
    // ---------------------------------------------------------
    // Destination
    this.x = spriteData.x !== undefined ? spriteData.x : 0;
    this.y = spriteData.y !== undefined ? spriteData.y : 0;
    this.width = spriteData.width !== undefined ? spriteData.width : 0;
    this.height = spriteData.height !== undefined ? spriteData.height : 0;

    // Source (Crop)
    this.sx = spriteData.sx !== undefined ? spriteData.sx : 0;
    this.sy = spriteData.sy !== undefined ? spriteData.sy : 0;
    this.sWidth = spriteData.sWidth !== undefined ? spriteData.sWidth : null;
    this.sHeight = spriteData.sHeight !== undefined ? spriteData.sHeight : null;
  }

  clear() {
    this.visible = false;
    this.image = null;
  }

  render(ctx) {
    if (!this.visible || !this.image) return;

    const canvas = this.core.canvas;
    const scaleFactor = canvas.height / this.DESIGN_HEIGHT;

    // A. Source Rect
    const finalSx = this.sx;
    const finalSy = this.sy;
    const finalSWidth =
      this.sWidth !== null ? this.sWidth : this.image.naturalWidth;
    const finalSHeight =
      this.sHeight !== null ? this.sHeight : this.image.naturalHeight;

    // B. Destination Rect (Scaled)
    const drawX = this.x * scaleFactor;
    const drawY = this.y * scaleFactor;

    // Use specific width/height if provided, otherwise use source size
    const finalW = this.width !== 0 ? this.width : finalSWidth;
    const finalH = this.height !== 0 ? this.height : finalSHeight;

    const drawW = finalW * scaleFactor;
    const drawH = finalH * scaleFactor;

    // C. Draw
    ctx.drawImage(
      this.image,
      finalSx,
      finalSy,
      finalSWidth,
      finalSHeight,
      drawX,
      drawY,
      drawW,
      drawH
    );
  }
}
