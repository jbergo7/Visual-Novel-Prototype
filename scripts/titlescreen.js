import { Scene } from "./scene.js";
import { Background } from "./background.js";

export class TitleScreen {
  constructor(core) {
    this.core = core;
    this.buttons = [];
    this.backgroundColor = "#1a1a1a";

    // Font size ratios
    this.titleMinRatio = 0.04;
    this.titleMaxRatio = 0.08;
    this.buttonMinRatio = 0.025;
    this.buttonMaxRatio = 0.05;

    this.updateLayout();

    // Store reference for cleanup
    this.clickHandler = (e) => this.handleClick(e);
    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  unload() {
    // Remove the click listener when leaving the title screen
    if (this.clickHandler) {
      this.core.canvas.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
  }

  onResize() {
    this.updateLayout();
  }

  updateLayout() {
    const canvas = this.core.canvas;
    const centerX = canvas.width / 2;
    const baseY = canvas.height * 0.65;
    const buttonSpacing = canvas.height * 0.08;

    this.buttons = [
      { text: "New Game", id: "newgame", x: centerX, y: baseY },
      {
        text: "Load Game",
        id: "loadgame",
        x: centerX,
        y: baseY + buttonSpacing,
      },
      {
        text: "Settings",
        id: "settings",
        x: centerX,
        y: baseY + buttonSpacing * 2,
      },
    ];
  }

  render(ctx) {
    const canvas = this.core.canvas;

    // Background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Title Text ---
    let titleFontSize = canvas.height * 0.06;
    titleFontSize = Math.max(
      canvas.height * this.titleMinRatio,
      Math.min(titleFontSize, canvas.height * this.titleMaxRatio)
    );

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${titleFontSize}px Arial`;
    ctx.fillText("My Visual Novel", canvas.width / 2, canvas.height * 0.3);

    // --- Buttons ---
    this.buttons.forEach((btn) => {
      let buttonFontSize = canvas.height * 0.035;
      buttonFontSize = Math.max(
        canvas.height * this.buttonMinRatio,
        Math.min(buttonFontSize, canvas.height * this.buttonMaxRatio)
      );

      ctx.fillStyle = "#fff";
      ctx.font = `${buttonFontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.text, btn.x, btn.y);
    });
  }

  handleClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvas = this.core.canvas;

    this.buttons.forEach((btn) => {
      const fontSize = canvas.height * 0.035;
      const textHeight = fontSize * 1.2;
      const textWidth = this.core.ctx.measureText(btn.text).width;
      const halfWidth = textWidth / 2;
      const halfHeight = textHeight / 2;

      if (
        mouseX > btn.x - halfWidth &&
        mouseX < btn.x + halfWidth &&
        mouseY > btn.y - halfHeight &&
        mouseY < btn.y + halfHeight
      ) {
        console.log(`Button clicked: ${btn.text}`);

        if (btn.id === "newgame") {
          this.startNewGame();
        }
      }
    });
  }

  async startNewGame() {
    // Remove old title screen listener before loading new scene
    this.unload();

    // Start the prologue scene first
    const scene = new Scene(this.core, "prologue");
    await scene.load();
    this.core.setActiveScene(scene);

    // if load background
    // const background = new Background(this.core, "home");
    // await background.load();
    // this.core.setActiveScene(background);
  }

  update() {}
}
