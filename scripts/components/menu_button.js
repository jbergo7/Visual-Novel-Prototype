// components/menu_button.js
export default class MenuButton {
  constructor(core) {
    this.core = core;
    this.x = 0;
    this.y = 0;
    this.size = 32;
    this.hover = false;

    // Hover listener
    this._moveHandler = (e) => this._onMouseMove(e);
    this.core.canvas.addEventListener("mousemove", this._moveHandler);

    // Click listener
    this._clickHandler = (e) => {
      if (this.checkClick(e)) {
        // 🔥 Toggle popup menu
        if (this.core.menuPopup) {
          this.core.menuPopup.toggle();
        }
      }
    };
    this.core.canvas.addEventListener("click", this._clickHandler);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  setSize(size) {
    this.size = size;
  }

  dispose() {
    if (this._moveHandler) {
      this.core.canvas.removeEventListener("mousemove", this._moveHandler);
      this._moveHandler = null;
    }

    if (this._clickHandler) {
      this.core.canvas.removeEventListener("click", this._clickHandler);
      this._clickHandler = null;
    }
  }

  checkClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const half = this.size / 2;

    return (
      mx >= this.x - half &&
      mx <= this.x + half &&
      my >= this.y - half &&
      my <= this.y + half
    );
  }

  _onMouseMove(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const half = this.size / 2;

    this.hover =
      mx >= this.x - half &&
      mx <= this.x + half &&
      my >= this.y - half &&
      my <= this.y + half;
  }

  render(ctx) {
    const half = this.size / 2;
    ctx.save();

    // hover background
    ctx.fillStyle = this.hover ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0)";
    ctx.fillRect(this.x - half, this.y - half, this.size, this.size);

    // menu lines
    const lineWidth = this.size * 0.55;
    const lineHeight = Math.max(2, this.size * 0.08);
    const startX = this.x - lineWidth / 2;
    const spacing = this.size * 0.18;

    ctx.fillStyle = this.hover ? "#fff" : "#ccc";

    ctx.fillRect(
      startX,
      this.y - spacing - lineHeight / 2,
      lineWidth,
      lineHeight
    );
    ctx.fillRect(startX, this.y - lineHeight / 2, lineWidth, lineHeight);
    ctx.fillRect(
      startX,
      this.y + spacing - lineHeight / 2,
      lineWidth,
      lineHeight
    );

    ctx.restore();
  }
}
