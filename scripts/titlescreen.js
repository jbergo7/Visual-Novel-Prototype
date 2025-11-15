import { Scene } from "./scene.js";
import { Background } from "./background.js";

export class TitleScreen {
  constructor(core) {
    this.core = core;
    this.buttons = [];
    this.backgroundColor = "#1a1a1a";
    this.hoveredButtonIndex = null;

    // ★ If undefined, set default (first boot)
    if (this.core.hasSave === undefined) {
      this.core.hasSave = false;
    }

    this.updateLayout();

    // Event handlers
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

  // ★ MAIN BUTTON LAYOUT BASED ON core.hasSave
  updateLayout() {
    const canvas = this.core.canvas;
    const centerX = canvas.width / 2;
    const baseY = canvas.height * 0.6;
    const spacing = canvas.height * 0.08;

    this.buttons = [];

    // ★ Add Continue if allowed
    if (this.core.hasSave) {
      this.buttons.push({
        text: "Continue",
        id: "continue",
        x: centerX,
        y: baseY,
      });
    }

    // New Game always appears
    this.buttons.push({
      text: "New Game",
      id: "newgame",
      x: centerX,
      y: baseY + (this.core.hasSave ? spacing : 0),
    });

    // Load Game
    this.buttons.push({
      text: "Load Game",
      id: "loadgame",
      x: centerX,
      y: baseY + spacing * (this.core.hasSave ? 2 : 1),
    });

    // Settings
    this.buttons.push({
      text: "Settings",
      id: "settings",
      x: centerX,
      y: baseY + spacing * (this.core.hasSave ? 3 : 2),
    });

    // ---- Calculate Equal Button Sizes ----
    const ctx = this.core.ctx;
    let maxTextWidth = 0;

    this.buttons.forEach((btn) => {
      const fontSize = canvas.height * 0.035;
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(btn.text).width;
      if (textWidth > maxTextWidth) maxTextWidth = textWidth;
    });

    this.buttons.forEach((btn) => {
      btn.width = maxTextWidth + 40;
      btn.height = canvas.height * 0.035 * 1.2 + 20;
    });
  }

  handleMouseMove(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.hoveredButtonIndex = null;

    this.buttons.forEach((btn, index) => {
      const hw = btn.width / 2;
      const hh = btn.height / 2;

      if (
        mx > btn.x - hw &&
        mx < btn.x + hw &&
        my > btn.y - hh &&
        my < btn.y + hh
      ) {
        this.hoveredButtonIndex = index;
      }
    });
  }

  render(ctx) {
    const canvas = this.core.canvas;

    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    let titleFont = canvas.height * 0.06;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${titleFont}px Arial`;
    ctx.fillText("My Visual Novel", canvas.width / 2, canvas.height * 0.3);

    // Buttons
    this.buttons.forEach((btn, idx) => {
      const hw = btn.width / 2;
      const hh = btn.height / 2;

      ctx.fillStyle = idx === this.hoveredButtonIndex ? "#444" : "#333";
      ctx.fillRect(btn.x - hw, btn.y - hh, btn.width, btn.height);

      ctx.fillStyle = idx === this.hoveredButtonIndex ? "#ffd700" : "#fff";
      ctx.font = `${canvas.height * 0.035}px Arial`;
      ctx.fillText(btn.text, btn.x, btn.y);
    });

    // Version + Update
    const vSize = canvas.height * 0.02;
    ctx.font = `${vSize}px Arial`;
    ctx.fillStyle = "#686868";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    const margin = 20;
    let y = canvas.height - margin;

    if (this.core.version) {
      ctx.fillText(`v${this.core.version}`, canvas.width - margin, y);
      y -= vSize * 1.5;
    }

    if (this.core.date_updated) {
      const d = new Date(this.core.date_updated);
      const opt = { month: "short", day: "numeric", year: "numeric" };
      ctx.fillText(
        `Last Update ${d.toLocaleDateString("en-US", opt)}`,
        canvas.width - margin,
        y
      );
    }
  }

  handleClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.buttons.forEach((btn) => {
      const hw = btn.width / 2;
      const hh = btn.height / 2;

      if (
        mx > btn.x - hw &&
        mx < btn.x + hw &&
        my > btn.y - hh &&
        my < btn.y + hh
      ) {
        if (btn.id === "newgame") this.startNewGame();
        if (btn.id === "continue") this.continueGame(); // ★ Added
      }
    });
  }

  async startNewGame() {
    // NEW GAME → remove Continue
    this.core.hasSave = false;

    // Remove TitleScreen event listeners
    this.unload();

    // Reset to original clean gameState
    this.core.resetGameState();

    // IMPORTANT: use the NEW gameState AFTER reset
    const gameState = this.core.gameState;

    let started = false;

    // Start with background if default says so
    if (
      gameState.currentBackground?.active &&
      gameState.currentBackground.target
    ) {
      const bg = new Background(this.core, gameState.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      started = true;
    }

    // Start with scene if default says so
    if (
      !started &&
      gameState.currentScene?.active &&
      gameState.currentScene.target
    ) {
      const scene = new Scene(this.core, gameState.currentScene.target);
      await scene.load();
      scene.currentLine = gameState.currentScene.dialogues || 0;
      this.core.setActiveScene(scene);
      started = true;
    }

    if (!started) {
      console.warn(
        "⚠ No default starting scene or background in gameSettings!"
      );
    }
  }

  // ★ Continue Game
  async continueGame() {
    this.unload();
    const gs = this.core.gameState;

    if (gs.currentBackground?.active) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      return;
    }

    if (gs.currentScene?.active) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();
      scene.currentLine = gs.currentScene.dialogues || 0;
      this.core.setActiveScene(scene);
      return;
    }

    console.warn("⚠️ No saved scene to Continue!");
  }

  update() {}
}
