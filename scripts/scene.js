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

    // Track applied stat deltas per dialogue line
    this.appliedStats = {}; // { [lineIndex]: { money, energy, max_energy } }

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
    if (!sceneCache) return;
    this.data = sceneCache[this.sceneId];
    if (!this.data) return;
    this.dialogues = this.data.dialogues || [];

    // Load background
    const bgCache = this.core.dataCache?.backgrounds;
    const bgId = this.data.background || "home";
    const bg = bgCache?.[bgId];
    if (bg?.image) {
      this.image = new Image();
      this.image.src = bg.image;
      await new Promise((resolve) => (this.image.onload = resolve));
    }

    this.unload();
    this.core.canvas.addEventListener("click", this.clickHandler);
    this.backHandler = (e) => {
      e.preventDefault();
      this.prevDialogue();
    };
    this.core.canvas.addEventListener("contextmenu", this.backHandler);

    this.currentLine = -1;
    this.nextDialogue();
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
    this.choicesBox.clear();
    if (this.backHandler) {
      this.core.canvas.removeEventListener("contextmenu", this.backHandler);
      this.backHandler = null;
    }
  }

  async nextDialogue() {
    if (this.isLoading || this.choicesBox.choices.length > 0) return;

    this.currentLine++;
    if (this.currentLine >= this.dialogues.length) {
      if (this.data.goto) {
        this.unload();
        const { Background } = await import("./background.js");
        const bg = new Background(this.core, this.data.goto);
        await bg.load();
        this.core.setActiveScene(bg);
      }
      return;
    }

    const current = this.dialogues[this.currentLine];
    if (!current) return;

    // Apply stats and record deltas
    const deltas = { money: 0, energy: 0, max_energy: 0 };
    if (typeof current.max_energy === "number" && current.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(current.max_energy);
      deltas.max_energy = current.max_energy;
    }
    if (typeof current.money === "number" && current.money !== 0) {
      this.statsManager.applyStats({ money: current.money });
      deltas.money = current.money;
    }
    if (typeof current.energy === "number" && current.energy !== 0) {
      this.statsManager.applyStats({ energy: current.energy });
      deltas.energy = current.energy;
    }

    // Save deltas
    this.appliedStats[this.currentLine] = deltas;

    // Show choices if available
    if (current.choices) {
      this.choicesBox.setChoices(current.choices);
      return;
    }

    // Handle background changes
    if (current.background) {
      await this.changeBackground(current.background, current.transition);
      this.nextDialogue();
      return;
    }

    // Update Game State
    if (this.core.gameState) {
      this.core.gameState.currentScene = {
        target: this.sceneId,
        dialogues: this.currentLine,
        active: true,
      };
    }
  }

  async prevDialogue() {
    if (this.isLoading) return;

    // Clear choices if showing
    if (this.choicesBox.choices.length > 0) this.choicesBox.clear();

    if (this.currentLine <= 0) return;

    const nextLineIndex = this.currentLine;
    const next = this.dialogues[nextLineIndex];

    // Reverse stats using stored deltas
    const deltas = this.appliedStats[nextLineIndex];
    if (deltas) {
      if (deltas.money) this.statsManager.applyStats({ money: -deltas.money });
      if (deltas.energy)
        this.statsManager.applyStats({ energy: -deltas.energy });
      if (deltas.max_energy)
        this.statsManager.modifyMaxEnergy(-deltas.max_energy);
      delete this.appliedStats[nextLineIndex];
    }

    this.currentLine--;

    const prev = this.dialogues[this.currentLine];

    // Revert background if next line had one
    if (next?.background) {
      const previousBgLine = [...this.dialogues]
        .slice(0, this.currentLine + 1)
        .reverse()
        .find((d) => d.background);
      const newBgId = previousBgLine?.background || this.data.background;
      if (newBgId && newBgId !== next.background) {
        await this.changeBackground(newBgId, "fade");
      }
    }

    // Restore choices if landed on them
    if (prev?.choices) this.choicesBox.setChoices(prev.choices);

    // Update Game State
    if (this.core.gameState) {
      this.core.gameState.currentScene.dialogues = this.currentLine;
    }

    this.render(this.core.ctx);
  }

  handleChoice(choice) {
    const deltas = { money: 0, energy: 0, max_energy: 0 };
    if (typeof choice.max_energy === "number" && choice.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(choice.max_energy);
      deltas.max_energy = choice.max_energy;
    }
    if (typeof choice.money === "number" && choice.money !== 0) {
      this.statsManager.applyStats({ money: choice.money });
      deltas.money = choice.money;
    }
    if (typeof choice.energy === "number" && choice.energy !== 0) {
      this.statsManager.applyStats({ energy: choice.energy });
      deltas.energy = choice.energy;
    }

    this.appliedStats[this.currentLine] = deltas;

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
    if (!bg?.image) return;

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
    } else this.image = newImg;
  }

  onResize(scaleRatio) {
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

    const line = this.dialogues[this.currentLine];
    if (line?.speaker && line?.text)
      this.dialogueBox.render(ctx, line.speaker, line.text);

    this.choicesBox.render(ctx);
    this.popupNotif.render(ctx);
  }

  update() {}
}
