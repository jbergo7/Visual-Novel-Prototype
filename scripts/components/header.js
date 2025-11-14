import MenuButton from "./menu_button.js";
import MenuPopup from "./menu_popup.js";

export class Header {
  constructor(core) {
    this.core = core;

    // Use global instances from core
    if (!core.menuButton) core.menuButton = new MenuButton(core);
    if (!core.menuPopup) core.menuPopup = new MenuPopup(core);

    this.menuBtn = core.menuButton;
    this.menuPopup = core.menuPopup;

    this.fontSize = 24;
    this.minFontRatio = 0.3;
    this.maxFontRatio = 0.6;
  }

  onResize(scale) {
    const canvas = this.core.canvas;
    const headerHeight = canvas.height * 0.06;

    this.fontSize = Math.max(
      headerHeight * this.minFontRatio,
      Math.min(headerHeight * 0.5, headerHeight * this.maxFontRatio)
    );

    // menu button size & position
    this.menuBtn.setSize(headerHeight * 0.6);
    this.menuBtn.setPosition(canvas.width - headerHeight, headerHeight / 2);
  }

  checkClick(e) {
    if (this.menuBtn.checkClick(e)) {
      this.menuPopup.toggle();
      return true; // stop game click propagation
    }
    return false;
  }

  render(ctx) {
    const canvas = this.core.canvas;
    const headerHeight = canvas.height * 0.06;

    const c = this.core.currentCharacter;
    if (!c) return;

    // Header bar
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    ctx.fillStyle = "#fff";
    ctx.font = `${this.fontSize}px Arial`;
    ctx.textBaseline = "middle";

    // Money - left
    ctx.textAlign = "left";
    ctx.fillText(`Money: ${c.money}`, canvas.width * 0.04, headerHeight / 2);

    // Energy - center-left
    ctx.textAlign = "left";
    const energyText = c.max_energy
      ? `Energy: ${c.energy}/${c.max_energy}`
      : `Energy: ${c.energy}`;
    ctx.fillText(energyText, canvas.width * 0.25, headerHeight / 2);

    // Menu button - right (render global button)
    this.menuBtn.render(ctx);

    // Render popup if visible (global)
    this.menuPopup.render(ctx);
  }
}
