// components/sprite.js

// =====================================================
// 1. INTERNAL CLASS: Handles logic for ONE character
//    (Dito inilipat ang logic mo dati)
// =====================================================
class SpriteEntity {
  constructor(core) {
    this.core = core;
    this.image = null;

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

  async load(data) {
    let spriteData = data;

    // ---------------------------------------------------------
    // 🔥 DATA LOOKUP LOGIC (Pareho ng dati mong code)
    // ---------------------------------------------------------
    if (data.character && data.pose) {
      const cache = this.core.dataCache?.characterSprites;
      if (cache && cache[data.character] && cache[data.character][data.pose]) {
        const baseData = cache[data.character][data.pose];
        // Merge: Cache Base + Scene Overrides
        spriteData = { ...baseData, ...data };
      } else {
        console.warn(`⚠️ Sprite not found: ${data.character} -> ${data.pose}`);
      }
    }

    // ---------------------------------------------------------
    // ASSIGN PROPERTIES
    // ---------------------------------------------------------
    this.x = spriteData.x !== undefined ? spriteData.x : 0;
    this.y = spriteData.y !== undefined ? spriteData.y : 0;
    this.width = spriteData.width !== undefined ? spriteData.width : 0;
    this.height = spriteData.height !== undefined ? spriteData.height : 0;

    this.sx = spriteData.sx !== undefined ? spriteData.sx : 0;
    this.sy = spriteData.sy !== undefined ? spriteData.sy : 0;
    this.sWidth = spriteData.sWidth !== undefined ? spriteData.sWidth : null;
    this.sHeight = spriteData.sHeight !== undefined ? spriteData.sHeight : null;

    // ---------------------------------------------------------
    // LOAD IMAGE
    // ---------------------------------------------------------
    if (spriteData.image) {
      const img = new Image();
      img.src = spriteData.image;
      await new Promise((resolve) => (img.onload = resolve));
      this.image = img;
    }
  }

  render(ctx) {
    if (!this.image) return;

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

// =====================================================
// 2. MAIN CLASS: Manages Multiple Sprites
//    (Ito ang tinatawag ng Scene.js)
// =====================================================
export class Sprite {
  constructor(core) {
    this.core = core;
    this.entities = []; // Array of active SpriteEntity objects
    this.visible = false;
  }

  /**
   * Updates the sprite list.
   * @param {Object|Array} data - Can be a single sprite object OR an array of objects.
   */
  async update(data) {
    // 1. Clear if null
    if (!data) {
      this.clear();
      return;
    }

    // 2. Normalize input to always be an Array
    // Kung object lang (single sprite), gagawin nating array na may isang laman.
    const dataList = Array.isArray(data) ? data : [data];

    // 3. Create new entities list
    const newEntities = [];

    // 4. Load all sprites in parallel (sabay-sabay mag-load)
    const promises = dataList.map(async (item) => {
      const entity = new SpriteEntity(this.core);
      await entity.load(item);
      newEntities.push(entity);
    });

    // Hintayin matapos lahat ng loading
    await Promise.all(promises);

    // 5. Replace the old list with the new one
    this.entities = newEntities;
    this.visible = true;
  }

  clear() {
    this.entities = [];
    this.visible = false;
  }

  render(ctx) {
    if (!this.visible || this.entities.length === 0) return;

    // Loop through all entities and render them
    this.entities.forEach((entity) => {
      entity.render(ctx);
    });
  }
}
