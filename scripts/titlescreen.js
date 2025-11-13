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

    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Title ---
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

  /**
   * 🔹 New Game loader using runtime gameState from GameCore
   */
  async startNewGame() {
    this.unload();

    const gameState = this.core.gameState;
    if (!gameState) {
      console.error("❌ No runtime gameState found!");
      return;
    }

    let started = false;

    // 1️⃣ Load background if active
    if (gameState.currentBackground?.active) {
      const bgTarget = gameState.currentBackground.target;
      if (bgTarget) {
        console.log(`🎬 Starting game with background: ${bgTarget}`);
        const bg = new Background(this.core, bgTarget);
        await bg.load();
        this.core.setActiveScene(bg);
        started = true;
      }
    }

    // 2️⃣ Load scene if active (or if background is inactive)
    if (!started && gameState.currentScene?.active) {
      const sceneTarget = gameState.currentScene.target;
      const dialogueIndex = gameState.currentScene.dialogues || 0;

      if (sceneTarget) {
        console.log(
          `🎬 Starting game with scene: ${sceneTarget}, dialogue ${dialogueIndex}`
        );
        const scene = new Scene(this.core, sceneTarget);
        await scene.load();

        // continue from saved dialogue index
        scene.currentLine = dialogueIndex;
        this.core.setActiveScene(scene);
        started = true;
      }
    }
    console.dir(this.core);
    if (!started) {
      console.warn("⚠️ No active scene or background to load from gameState!");
    }
  }

  update() {}
}
