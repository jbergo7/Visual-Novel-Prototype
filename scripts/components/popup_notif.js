export class PopupNotif {
  constructor(core) {
    this.core = core;
    this.message = "";
    this.visible = false;
    this.alpha = 0;
    this.y = 50; // starting Y position
  }

  show(message) {
    this.message = message;
    this.visible = true;
    this.alpha = 1;
    this.y = 50;

    // Auto hide after 2 seconds
    setTimeout(() => {
      this.fadeOut();
    }, 2000);
  }

  fadeOut() {
    const fadeInterval = setInterval(() => {
      this.alpha -= 0.05;
      this.y -= 1; // move slightly upward while fading
      if (this.alpha <= 0) {
        clearInterval(fadeInterval);
        this.visible = false;
        this.alpha = 0;
      }
    }, 50);
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.textAlign = "center";

    // background bubble
    const width = 400;
    const height = 60;
    const x = this.core.canvas.width / 2 - width / 2;
    const y = this.y;

    ctx.fillRect(x, y, width, height);

    // text
    ctx.fillStyle = "white";
    ctx.fillText(this.message, this.core.canvas.width / 2, y + 38);

    ctx.restore();
  }
}
