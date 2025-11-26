import { Scene } from "./scene.js";
import { Background } from "./background.js";

export class TitleScreen {
  constructor(core) {
    this.core = core;
    this.buttons = [];
    this.backgroundColor = "#1a1a1a";
    this.hoveredButtonIndex = null;

    // Default flag on first boot
    if (this.core.hasSave === undefined) {
      this.core.hasSave = false;
    }

    // Check saves BEFORE building UI
    this.checkLocalSaves();
    this.updateLayout();

    // Event handlers
    this.clickHandler = (e) => this.handleClick(e);
    this.mouseMoveHandler = (e) => this.handleMouseMove(e);

    this.core.canvas.addEventListener("click", this.clickHandler);
    this.core.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }

  // ------------------------------
  // SAVE DETECTION
  // ------------------------------
  checkLocalSaves() {
    this.core.hasSave = false;

    for (let i = 0; i < 10; i++) {
      const raw = localStorage.getItem("vn_save_slot_" + i);
      if (!raw) continue;

      const data = JSON.parse(raw);
      if (data?.gameState) {
        this.core.hasSave = true;
        return;
      }
    }
  }

  getLatestSave() {
    let latest = null;

    for (let i = 0; i < 10; i++) {
      const raw = localStorage.getItem("vn_save_slot_" + i);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (!data.timestamp) continue;
      if (!latest || new Date(data.timestamp) > new Date(latest.timestamp)) {
        latest = { ...data, slot: i };
      }
    }

    return latest;
  }

  // ------------------------------
  // RESUME SYSTEM
  // ------------------------------
  async resumeFromGameState(gs) {
    if (gs.currentBackground?.active) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      return;
    }

    if (gs.currentScene?.active) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();

      const idx =
        typeof gs.currentScene.dialogues === "number"
          ? gs.currentScene.dialogues
          : 0;

      scene.currentLine = idx;
      scene.resumeIndex = idx;

      this.core.setActiveScene(scene);
      return;
    }

    console.warn("⚠ No scene or background to resume.");
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

  // ------------------------------
  // BUTTON LAYOUT
  // ------------------------------
  updateLayout() {
    const canvas = this.core.canvas;
    const centerX = canvas.width / 2;
    const baseY = canvas.height * 0.6;
    const spacing = canvas.height * 0.08;

    this.buttons = [];

    if (this.core.hasSave) {
      this.buttons.push({
        text: "Continue",
        id: "continue",
        x: centerX,
        y: baseY,
      });
    }

    this.buttons.push({
      text: "New Game",
      id: "newgame",
      x: centerX,
      y: baseY + (this.core.hasSave ? spacing : 0),
    });

    this.buttons.push({
      text: "Load Game",
      id: "loadgame",
      x: centerX,
      y: baseY + spacing * (this.core.hasSave ? 2 : 1),
    });

    this.buttons.push({
      text: "Settings",
      id: "settings",
      x: centerX,
      y: baseY + spacing * (this.core.hasSave ? 3 : 2),
    });

    // Auto-adjust widths
    const ctx = this.core.ctx;
    let maxTextWidth = 0;

    this.buttons.forEach((btn) => {
      const fontSize = canvas.height * 0.035;
      ctx.font = `${fontSize}px Arial`;
      const tw = ctx.measureText(btn.text).width;
      if (tw > maxTextWidth) maxTextWidth = tw;
    });

    this.buttons.forEach((btn) => {
      btn.width = maxTextWidth + 40;
      btn.height = canvas.height * 0.035 * 1.2 + 20;
    });
  }

  // ------------------------------
  // INPUT HANDLING
  // ------------------------------
  handleMouseMove(e) {
    if (this.core.saveLoadPopup?.visible) return;

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

  handleClick(e) {
    if (this.core.saveLoadPopup?.visible) return;

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
        if (btn.id === "continue") this.continueGame();
        if (btn.id === "newgame") this.startNewGame();
        if (btn.id === "loadgame") this.core.saveLoadPopup.open("load");
      }
    });
  }

  // ------------------------------
  // GAME START & CONTINUE
  // ------------------------------
  async startNewGame() {
    this.core.hasSave = false;
    this.unload();
    this.core.resetGameState();

    const gs = this.core.gameState;
    let started = false;

    if (gs.currentBackground?.active && gs.currentBackground.target) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      started = true;
    }

    if (!started && gs.currentScene?.active && gs.currentScene.target) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();
      scene.currentLine = gs.currentScene.dialogues || 0;
      this.core.setActiveScene(scene);
      started = true;
    }

    if (!started) {
      console.warn(
        "⚠ No default starting scene or background in gameSettings!"
      );
    }
  }

  async continueGame() {
    const latest = this.getLatestSave();

    //console.log(latest.gameState);

    // Use runtime data if there is still exisitng
    if (this.core.hasRuntimeDataCache) {
      const runtimeHasProgress =
        this.core.gameState?.currentBackground?.active ||
        this.core.gameState?.currentScene?.active;

      console.log(this.core.gameState);
      if (runtimeHasProgress) {
        this.unload();
        return this.resumeFromGameState(this.core.gameState);
      }
    } else {
      // If browser refreshed or if there are no runtime data then use the existing localStorage
      if (!latest) {
        console.warn("⚠ Continue pressed but no save found.");
        return;
      }

      this.core.gameState = structuredClone(latest.gameState);
      this.core.characters = structuredClone(latest.characters);

      this.core.currentCharacter =
        this.core.characters.find((ch) => ch.default) ||
        this.core.characters[0];

      this.unload();
      this.core.hasRuntimeDataCache = true;
      return this.resumeFromGameState(this.core.gameState);
    }
  }

  update() {}

  // ------------------------------
  // RENDER
  // ------------------------------
  render(ctx) {
    const canvas = this.core.canvas;

    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    const titleFont = canvas.height * 0.06;
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

    // Version info
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
}
