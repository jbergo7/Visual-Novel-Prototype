import { DialogueBox } from "./components/dialoguebox.js";
import { DialogueChoices } from "./components/dialogue_choices.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.dialogues = [];
    this.currentLine = -1;

    // UI components
    this.dialogueBox = new DialogueBox(core);
    this.choicesBox = new DialogueChoices(core, (choice) =>
      this.handleChoice(choice)
    );

    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    this.popupNotif = core.popupNotif;

    if (!core.statsManager) core.statsManager = new StatsManager(core);
    this.statsManager = core.statsManager;

    // control flags
    this.isLoading = false;
    this.clickHandler = (e) => this.nextDialogue();
  }

  async load() {
    const sceneCache = this.core.dataCache?.scenes;
    if (!sceneCache) {
      console.error("❌ Scene data not found in core.dataCache.");
      return;
    }

    this.data = sceneCache[this.sceneId];
    if (!this.data) {
      console.error(`❌ Scene '${this.sceneId}' not found in cache.`);
      return;
    }

    this.dialogues = this.data.dialogues || [];

    // ✅ Load background
    const bgCache = this.core.dataCache?.backgrounds;
    const bgId = this.data.background || "home";
    const bg = bgCache?.[bgId];

    if (bg?.image) {
      this.image = new Image();
      this.image.src = bg.image;
      await new Promise((resolve) => (this.image.onload = resolve));
    }

    // ✅ Cleanup previous listeners to avoid double firing
    this.unload();

    // ✅ Add fresh click listener
    this.core.canvas.addEventListener("click", this.clickHandler);

    // ✅ Start at line 0
    this.currentLine = -1;
    this.nextDialogue();
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
    this.choicesBox.clear();
  }

  async nextDialogue() {
    if (this.isLoading || this.choicesBox.choices.length > 0) return;

    this.currentLine++;

    // ✅ Update current dialogue index in gameState
    if (this.core.gameState) {
      this.core.gameState.currentScene = {
        target: this.sceneId,
        dialogues: this.currentLine,
        active: true,
      };

      // 🧠 Debug log
      console.log(
        "🟢 Updated Game State:",
        JSON.stringify(this.core.gameState, null, 2)
      );
    } else {
      console.warn("⚠️ core.gameState not found — skipping update log.");
    }

    // ✅ Scene finished? move to next background or scene
    if (this.currentLine >= this.dialogues.length) {
      const goto = this.data.goto;
      if (goto) {
        this.unload();
        const mod = await import("./background.js");
        const bg = new mod.Background(this.core, goto);
        await bg.load();
        this.core.setActiveScene(bg);
      }
      return;
    }

    const current = this.dialogues[this.currentLine];
    if (!current) return;

    // ✅ Apply stats before rendering
    if (typeof current.max_energy === "number" && current.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(current.max_energy);
    }
    if (
      current.money ||
      current.energy ||
      current.energy === "reset" ||
      current.action
    ) {
      this.statsManager.applyStats(current);
    }

    // ✅ Show choices
    if (current.choices) {
      this.choicesBox.setChoices(current.choices);
      return;
    }

    // ✅ Background change
    if (current.background) {
      await this.changeBackground(current.background, current.transition);
      this.nextDialogue();
      return;
    }
  }

  handleChoice(choice) {
    // ✅ Apply stat changes
    if (typeof choice.max_energy === "number" && choice.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(choice.max_energy);
    }
    this.statsManager.applyStats(choice);

    // ✅ Jump to another scene
    if (choice.goto_scene) {
      this.unload();
      import("./scene.js").then(async (mod) => {
        const newScene = new mod.Scene(this.core, choice.goto_scene);
        await newScene.load();
        this.core.setActiveScene(newScene);
      });
      return;
    }

    this.nextDialogue();
  }

  async changeBackground(bgId, transition) {
    const bgCache = this.core.dataCache?.backgrounds;
    const bg = bgCache?.[bgId];
    if (!bg || !bg.image) return;

    const newImg = new Image();
    newImg.src = bg.image;
    await new Promise((resolve) => (newImg.onload = resolve));

    if (transition === "fade") {
      const canvas = this.core.canvas;
      const ctx = this.core.ctx;
      let alpha = 0;

      await new Promise((resolve) => {
        const step = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (this.image)
            ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

          ctx.globalAlpha = alpha;
          ctx.drawImage(newImg, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;

          if (this.popupNotif) this.popupNotif.render(ctx);

          if (alpha < 1) {
            alpha += 0.05;
            requestAnimationFrame(step);
          } else {
            this.image = newImg;
            resolve();
          }
        };
        step();
      });
    } else {
      this.image = newImg;
    }
  }

  onResize(scaleRatio) {
    this.dialogueBox?.onResize(scaleRatio);
    this.choicesBox?.onResize(scaleRatio);
    this.popupNotif?.onResize(scaleRatio);
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.image)
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (this.currentLine >= 0 && this.currentLine < this.dialogues.length) {
      const line = this.dialogues[this.currentLine];
      if (line.speaker && line.text) {
        this.dialogueBox.render(ctx, line.speaker, line.text);
      }
    }

    this.choicesBox.render(ctx);
    this.popupNotif.render(ctx);
  }

  update() {}
}
