import { Scene } from "./scene.js";
import { Background } from "./background.js";

export class TitleScreen {
  constructor(core) {
    this.core = core;
    this.buttons = [];
    this.backgroundColor = "#1a1a1a";
    this.hoveredButtonIndex = null;

    // Font size ratios
    this.titleMinRatio = 0.04;
    this.titleMaxRatio = 0.08;
    this.buttonMinRatio = 0.025;
    this.buttonMaxRatio = 0.05;

    this.updateLayout();

    // Event listeners
    this.clickHandler = (e) => this.handleClick(e);
    this.mouseMoveHandler = (e) => this.handleMouseMove(e);
    this.core.canvas.addEventListener("click", this.clickHandler);
    this.core.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }

  unload() {
    if (this.clickHandler) {
      this.core.canvas.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    if (this.mouseMoveHandler) {
      this.core.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
      this.mouseMoveHandler = null;
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

    // Calculate maximum text width for equal button width
    const ctx = this.core.ctx;
    let maxTextWidth = 0;
    this.buttons.forEach((btn) => {
      const fontSize = canvas.height * 0.035;
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(btn.text).width;
      if (textWidth > maxTextWidth) maxTextWidth = textWidth;
    });

    this.buttons.forEach((btn) => {
      btn.width = maxTextWidth + 40; // padding X = 20 each side
      btn.height = canvas.height * 0.035 * 1.2 + 20; // padding Y = 10 each side
    });
  }

  handleMouseMove(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.hoveredButtonIndex = null;

    this.buttons.forEach((btn, index) => {
      const halfWidth = btn.width / 2;
      const halfHeight = btn.height / 2;

      if (
        mouseX > btn.x - halfWidth &&
        mouseX < btn.x + halfWidth &&
        mouseY > btn.y - halfHeight &&
        mouseY < btn.y + halfHeight
      ) {
        this.hoveredButtonIndex = index;
      }
    });
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

    // --- Buttons with equal width boxes ---
    this.buttons.forEach((btn, index) => {
      let buttonFontSize = canvas.height * 0.035;
      buttonFontSize = Math.max(
        canvas.height * this.buttonMinRatio,
        Math.min(buttonFontSize, canvas.height * this.buttonMaxRatio)
      );

      const halfWidth = btn.width / 2;
      const halfHeight = btn.height / 2;

      // Draw box
      ctx.fillStyle = index === this.hoveredButtonIndex ? "#444" : "#333";
      ctx.fillRect(
        btn.x - halfWidth,
        btn.y - halfHeight,
        btn.width,
        btn.height
      );

      // Draw text
      ctx.fillStyle = index === this.hoveredButtonIndex ? "#ffd700" : "#fff";
      ctx.font = `${buttonFontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.text, btn.x, btn.y);
    });

    // --- Version & Last Update ---
    const versionFontSize = canvas.height * 0.02;
    ctx.font = `${versionFontSize}px Arial`;
    ctx.fillStyle = "#686868";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    const margin = 20;
    let bottomY = canvas.height - margin;

    if (this.core.version) {
      ctx.fillText(`v${this.core.version}`, canvas.width - margin, bottomY);
      bottomY -= versionFontSize * 1.5;
    }

    if (this.core.date_updated) {
      const dateObject = new Date(this.core.date_updated);
      const options = { month: "short", day: "numeric", year: "numeric" };
      const formattedDate = dateObject.toLocaleDateString("en-US", options);
      ctx.fillText(
        `Last Update ${formattedDate}`,
        canvas.width - margin,
        bottomY
      );
    }
  }

  handleClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.buttons.forEach((btn) => {
      const halfWidth = btn.width / 2;
      const halfHeight = btn.height / 2;

      if (
        mouseX > btn.x - halfWidth &&
        mouseX < btn.x + halfWidth &&
        mouseY > btn.y - halfHeight &&
        mouseY < btn.y + halfHeight
      ) {
        console.log(`Button clicked: ${btn.text}`);
        if (btn.id === "newgame") this.startNewGame();
      }
    });
  }

  async startNewGame() {
    this.unload();

    const gameState = this.core.gameState;
    if (!gameState) {
      console.error("❌ No runtime gameState found!");
      return;
    }

    let started = false;

    if (gameState.currentBackground?.active) {
      const bgTarget = gameState.currentBackground.target;
      if (bgTarget) {
        const bg = new Background(this.core, bgTarget);
        await bg.load();
        this.core.setActiveScene(bg);
        started = true;
      }
    }

    if (!started && gameState.currentScene?.active) {
      const sceneTarget = gameState.currentScene.target;
      const dialogueIndex = gameState.currentScene.dialogues || 0;
      if (sceneTarget) {
        const scene = new Scene(this.core, sceneTarget);
        await scene.load();
        scene.currentLine = dialogueIndex;
        this.core.setActiveScene(scene);
        started = true;
      }
    }

    if (!started) {
      console.warn("⚠️ No active scene or background to load from gameState!");
    }
  }

  update() {}
}
