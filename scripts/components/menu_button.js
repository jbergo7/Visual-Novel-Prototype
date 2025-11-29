export default class MenuButton {
  constructor(core) {
    this.core = core;
    this.x = 0;
    this.y = 0;
    this.width = 50;
    this.height = 50;
    this.isHovered = false;

    // Handle Hover
    this.core.canvas.addEventListener("mousemove", (e) => {
      if (this.core.menuPopup.visible) return; // Don't track if menu is open
      const rect = this.core.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.isHovered = this.containsPoint(mx, my);
    });
  }

  setSize(size) {
    this.width = size;
    this.height = size;
  }

  containsPoint(x, y) {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }

  render(ctx) {
    // Don't render if menu is open (optional preference)
    if (this.core.menuPopup.visible) return;

    // Use styles from gui_menu but simplified
    const guiData = this.core.dataCache?.gameGUI?.gui_menu;
    const borderColor = guiData?.gui_menu_BorderColor || "#fff";
    const bgColor = guiData?.gui_menu_ButtonBackgroundColor || "#333";
    const hoverColor = guiData?.gui_menu_ButtonBackgroundColor_Hover || "#555";

    ctx.save();

    // Draw Box
    ctx.fillStyle = this.isHovered ? hoverColor : bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;

    // Simple rounded rect
    const r = 5;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, r);
    ctx.fill();
    ctx.stroke();

    // Draw Hamburger Icon (3 lines)
    ctx.strokeStyle = guiData?.gui_menu_ButtonFontColor || "#fff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const pad = this.width * 0.25;
    const lineH = (this.height - pad * 2) / 3; // space for 3 lines?
    // Actually simpler:
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const w = this.width * 0.5;

    // Top
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - w / 3);
    ctx.lineTo(cx + w / 2, cy - w / 3);
    ctx.stroke();

    // Middle
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy);
    ctx.lineTo(cx + w / 2, cy);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + w / 3);
    ctx.lineTo(cx + w / 2, cy + w / 3);
    ctx.stroke();

    ctx.restore();
  }
}
