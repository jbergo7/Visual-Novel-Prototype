import { Scene } from "./scene.js";
import { Background } from "./background.js";

export class TitleScreen {
  constructor(core) {
    this.core = core;
    this.buttons = [];
    this.hoveredButtonIndex = null;

    this.backgroundColor = "#1a1a1a";

    // TRACK IF CONTINUE IS AVAILABLE
    this.showContinue = this.checkIfCanContinue();

    this.updateLayout();

    // Events
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

  /** 🔍 Check kung may save or may active scene/background */
  checkIfCanContinue() {
    const gs = this.core.gameState;
    if (!gs) return false;

    // May active scene?
    if (gs.currentScene?.active && gs.currentScene.target) return true;

    // May active background?
    if (gs.currentBackground?.active && gs.currentBackground.target)
      return true;

    return false;
  }

  onResize() {
    this.updateLayout();
  }

  updateLayout() {
    const canvas = this.core.canvas;
    const centerX = canvas.width / 2;

    const baseY = canvas.height * 0.55;
    const spacing = canvas.height * 0.08;

    this.buttons = [];
    let y = baseY;

    // --- Continue on top ---
    if (this.showContinue) {
      this.buttons.push({ text: "Continue", id: "continue", x: centerX, y });
      y += spacing;
    }

    // --- Standard buttons ---
    this.buttons.push({ text: "New Game", id: "newgame", x: centerX, y });
    y += spacing;

    this.buttons.push({ text: "Load Game", id: "loadgame", x: centerX, y });
    y += spacing;

    this.buttons.push({ text: "Settings", id: "settings", x: centerX, y });

    // Equal button widths
    const ctx = this.core.ctx;
    let maxWidth = 0;

    this.buttons.forEach((b) => {
      ctx.font = `${canvas.height * 0.035}px Arial`;
      const w = ctx.measureText(b.text).width;
      if (w > maxWidth) maxWidth = w;
    });

    this.buttons.forEach((b) => {
      b.width = maxWidth + 50;
      b.height = canvas.height * 0.035 * 1.2 + 20;
    });
  }

  handleMouseMove(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.hoveredButtonIndex = null;

    this.buttons.forEach((btn, i) => {
      const hw = btn.width / 2;
      const hh = btn.height / 2;

      if (
        x > btn.x - hw &&
        x < btn.x + hw &&
        y > btn.y - hh &&
        y < btn.y + hh
      ) {
        this.hoveredButtonIndex = i;
      }
    });
  }

  render(ctx) {
    const canvas = this.core.canvas;

    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Title ---
    let titleSize = canvas.height * 0.07;
    ctx.font = `${titleSize}px Arial`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("My Visual Novel", canvas.width / 2, canvas.height * 0.3);

    // --- Buttons ---
    this.buttons.forEach((btn, i) => {
      const hw = btn.width / 2;
      const hh = btn.height / 2;

      ctx.fillStyle = i === this.hoveredButtonIndex ? "#444" : "#333";
      ctx.fillRect(btn.x - hw, btn.y - hh, btn.width, btn.height);

      ctx.fillStyle = i === this.hoveredButtonIndex ? "#ffd700" : "#fff";
      ctx.font = `${canvas.height * 0.035}px Arial`;
      ctx.fillText(btn.text, btn.x, btn.y);
    });

    // --- Version / Last Update ---
    const fontSize = canvas.height * 0.02;
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = "#686868";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    const margin = 20;
    let bottomY = canvas.height - margin;

    if (this.core.version) {
      ctx.fillText(`v${this.core.version}`, canvas.width - margin, bottomY);
      bottomY -= fontSize * 1.5;
    }

    if (this.core.date_updated) {
      const d = new Date(this.core.date_updated);
      const formatted = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      ctx.fillText(`Last Update ${formatted}`, canvas.width - margin, bottomY);
    }
  }

  handleClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.buttons.forEach((btn) => {
      const hw = btn.width / 2;
      const hh = btn.height / 2;

      if (
        x > btn.x - hw &&
        x < btn.x + hw &&
        y > btn.y - hh &&
        y < btn.y + hh
      ) {
        console.log("Clicked:", btn.id);

        if (btn.id === "continue") this.startContinue();
        if (btn.id === "newgame") this.startNewGame();
      }
    });
  }

  /** ⭐ Continue from last save */
  async startContinue() {
    this.unload();

    const gs = this.core.gameState;
    if (!gs) return console.error("❌ No gameState found!");

    // If scene active → load scene
    if (gs.currentScene?.active) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load(gs.currentScene.dialogues || 0);
      this.core.setActiveScene(scene);
      return;
    }

    // If background active → load background
    if (gs.currentBackground?.active) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      return;
    }

    console.warn("⚠️ Nothing to continue.");
  }

  /** ⭐ New Game (same as before) */
  async startNewGame() {
    this.unload();

    const gs = this.core.gameState;
    if (!gs) {
      console.error("❌ No runtime gameState found!");
      return;
    }

    let started = false;

    if (gs.currentBackground?.active) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      started = true;
    }

    if (!started && gs.currentScene?.active) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();
      scene.currentLine = gs.currentScene.dialogues || 0;
      this.core.setActiveScene(scene);
      started = true;
    }

    if (!started) {
      console.warn("⚠️ No active scene/background.");
    }
  }

  update() {}
}
