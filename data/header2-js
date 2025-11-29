import MenuButton from "./menu_button.js";
import MenuPopup from "./menu_popup.js";

export class Header {
  constructor(core) {
    this.core = core;
    this.baseWidth = 1920;

    // --- Singleton Handling ---
    // Ensure only one instance of MenuButton/Popup exists in core
    if (!core.menuButton) core.menuButton = new MenuButton(core);
    if (!core.menuPopup) core.menuPopup = new MenuPopup(core);

    this.menuBtn = core.menuButton;
    this.menuPopup = core.menuPopup;
  }

  // Helper: Hex to RGBA conversion
  hexToRgba(color, alpha = 1) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    if (color.startsWith("rgba")) return color;
    if (color.startsWith("rgb")) return color;

    if (color[0] === "#") {
      let r, g, b;
      if (color.length === 4) {
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  onResize(scaleRatio) {
    const canvas = this.core.canvas;
    const guiData = this.core.dataCache?.gameGUI?.gui_header;

    // Calculate Header Height based on ratio (default 0.06 or 6%)
    const heightRatio = guiData?.header_HeightRatio || 0.06;
    const headerHeight = canvas.height * heightRatio;

    // --- Resize Menu Button ---
    // Button size is relative to header height (e.g., 60% of header)
    const btnSize = headerHeight * 0.7;
    this.menuBtn.setSize(btnSize);

    // Position Button: Right side, vertically centered
    const padding = (headerHeight - btnSize) / 2;
    this.menuBtn.x = canvas.width - btnSize - 20; // 20px margin right
    this.menuBtn.y = padding;
  }

  checkClick(e) {
    // Note: MenuPopup handles its own clicks internally via event listeners,
    // but the Header handles the *Toggle Button*.

    // We pass the raw event coordinates to the button
    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.menuBtn.containsPoint(x, y)) {
      this.menuPopup.toggle();
      return true; // Stop propagation
    }
    return false;
  }

  render(ctx) {
    const c = this.core.currentCharacter;
    if (!c) return;

    const guiData = this.core.dataCache?.gameGUI?.gui_header;
    const canvas = this.core.canvas;

    // Default values if JSON is not loaded yet
    const heightRatio = guiData?.header_HeightRatio || 0.06;
    const headerHeight = canvas.height * heightRatio;
    const opacity = guiData?.header_Opacity ?? 0.95;
    const bgColor = this.hexToRgba(
      guiData?.header_BackgroundColor || "#2a1f11",
      opacity
    );
    const borderColor = guiData?.header_BorderBottomColor || "#ffcc95";
    const borderThickness = guiData?.header_BorderBottomThickness || 4;
    const fontColor = guiData?.header_FontColor || "#fff";

    // --- 1. Draw Background Bar ---
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    // --- 2. Draw Bottom Border ---
    if (borderThickness > 0) {
      ctx.fillStyle = borderColor;
      ctx.fillRect(
        0,
        headerHeight - borderThickness,
        canvas.width,
        borderThickness
      );
    }

    // --- 3. Draw Stats Text ---
    const scaleRatio = canvas.width / this.baseWidth;
    const fontSize = (guiData?.header_FontSize || 24) * scaleRatio;
    const fontFamily = guiData?.header_FontFamily || "Arial, sans-serif";

    ctx.fillStyle = fontColor;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "middle";

    // Money Icon/Text (Left)
    ctx.textAlign = "left";
    ctx.fillText(`Money: ${c.money}`, canvas.width * 0.03, headerHeight / 2);

    // Energy Icon/Text (Center-Left)
    // You can adjust this X position (e.g., 0.20 or 20%)
    const energyText = c.max_energy
      ? `Energy: ${c.energy}/${c.max_energy}`
      : `Energy: ${c.energy}`;

    ctx.fillText(energyText, canvas.width * 0.2, headerHeight / 2);

    // --- 4. Render Components ---
    // Draw the Menu Button (Hamburger)
    this.menuBtn.render(ctx);

    // Draw the Popup (if open) - it usually draws an overlay over the whole screen
    this.menuPopup.render(ctx);
  }
}
