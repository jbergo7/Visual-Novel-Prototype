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
    this.fontSize = 20;
    this.minFontSize = 12;
    this.maxFontSize = 48;

    this.clickHandler = null;
    this.active = false; // track if button should respond
  }

  resize(scale) {
    this.x = this.base.x * scale;
    this.y = this.base.y * scale;
    this.width = this.base.width * scale;
    this.height = this.base.height * scale;

    this.fontSize = this.getFontSizeToFit(this.text, this.width, this.height);
  }

  render(ctx) {
    ctx.fillStyle = "rgba(54, 54, 54, 0.6)";
    ctx.fillRect(this.x, this.y, this.width, this.height);

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

  addClickListener(callback) {
    this.removeClickListener(); // ensure old listener removed
    this.active = true;

    this.clickHandler = (e) => {
      if (!this.active) return;

      // ✅ Check if SaveLoadPopup is open
      if (this.core.saveLoadPopup?.visible) return;

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

  getFontSizeToFit(text, maxWidth, maxHeight) {
    const ctx = this.core.ctx;
    let fontSize = Math.min(maxHeight * 0.6, (maxWidth / text.length) * 1.8);
    fontSize = Math.max(this.minFontSize, Math.min(this.maxFontSize, fontSize));

    ctx.font = `${fontSize}px Arial`;
    const textWidth = ctx.measureText(text).width;
    if (textWidth > maxWidth * 0.9) {
      fontSize *= (maxWidth * 0.9) / textWidth;
    }

    return fontSize;
  }
}
