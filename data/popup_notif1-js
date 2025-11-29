export class PopupNotif {
  constructor(core) {
    this.core = core;
    this.popups = [];
    this.scale = core.scaleRatio || 1;

    // Base layout values
    this.baseFontSize = 28;
    this.baseWidth = 420;
    this.baseHeight = 60;
    this.baseSpacing = 10;
    this.baseY = 50;
  }

  show(message, color = null) {
    const popup = {
      message,
      color: this.resolveColor(color),
      alpha: 1,
      yOffset: 0,
    };

    this.popups.push(popup);

    // Auto remove after 2 seconds
    setTimeout(() => {
      this.fadeOut(popup);
    }, 2000);
  }

  resolveColor(colorName) {
    switch (colorName) {
      case "red":
        return "rgba(200, 50, 50, 0.85)";
      case "green":
        return "rgba(50, 180, 90, 0.85)";
      case "blue":
        return "rgba(60, 120, 200, 0.85)";
      case "gold":
        return "rgba(220, 180, 60, 0.85)";
      default:
        return "rgba(0, 0, 0, 0.6)";
    }
  }

  fadeOut(popup) {
    const fadeInterval = setInterval(() => {
      popup.alpha -= 0.05;
      popup.yOffset -= 0.4 * this.scale;

      if (popup.alpha <= 0) {
        clearInterval(fadeInterval);
        this.popups = this.popups.filter((p) => p !== popup);
      }
    }, 50);
  }

  onResize(scale) {
    // ✅ Update popup scale instantly when canvas resizes
    this.scale = scale;
  }

  render(ctx) {
    if (this.popups.length === 0) return;

    ctx.save();

    const scale = this.scale;
    const canvas = this.core.canvas;

    // Responsive layout values
    const popupWidth = this.baseWidth * scale;
    const popupHeight = this.baseHeight * scale;
    const spacing = this.baseSpacing * scale;
    const fontSize = this.baseFontSize * scale;
    const baseY = this.baseY * scale;
    const canvasCenter = canvas.width / 2;

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.popups.forEach((popup, i) => {
      const y = baseY + i * (popupHeight + spacing) + popup.yOffset;
      const x = canvasCenter - popupWidth / 2;

      ctx.globalAlpha = popup.alpha;

      // ✅ Rounded background with smooth scaling
      ctx.fillStyle = popup.color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, popupWidth, popupHeight, 12 * scale);
      } else {
        ctx.rect(x, y, popupWidth, popupHeight);
      }
      ctx.fill();

      // ✅ Text (vertically centered)
      ctx.fillStyle = "white";
      ctx.fillText(popup.message, canvasCenter, y + popupHeight / 2);
    });

    ctx.restore();
  }
}
