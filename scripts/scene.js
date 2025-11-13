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

    // Track all applied stat changes per dialogue
    this.appliedStats = {};

    this.dialogueBox = new DialogueBox(core);
    this.choicesBox = new DialogueChoices(core, (choice) =>
      this.handleChoice(choice)
    );

    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    this.popupNotif = core.popupNotif;

    if (!core.statsManager) core.statsManager = new StatsManager(core);
    this.statsManager = core.statsManager;

    this.isLoading = false;
    this.clickHandler = (e) => this.nextDialogue();
  }

  async load() {
    const sceneCache = this.core.dataCache?.scenes;
    if (!sceneCache) return;
    this.data = sceneCache[this.sceneId];
    if (!this.data) return;
    this.dialogues = this.data.dialogues || [];

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

    // right-click = back
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

    const deltas = { money: 0, energy: 0, max_energy: 0, prevEnergy: null };

    // ✅ Apply max_energy change
    if (typeof current.max_energy === "number" && current.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(current.max_energy);
      deltas.max_energy = current.max_energy;
    }

    // ✅ Apply money
    if (current.money !== undefined) {
      this.statsManager.applyStats({ money: current.money });
      if (typeof current.money === "number") deltas.money = current.money;
    }

    // ✅ Apply energy (with "reset" support)
    if (current.energy !== undefined) {
      const c = this.core.currentCharacter;
      deltas.prevEnergy = c?.energy ?? null;

      this.statsManager.applyStats({ energy: current.energy });

      if (typeof current.energy === "number") {
        deltas.energy = current.energy;
      } else if (current.energy === "reset") {
        deltas.energy = "reset";
      }
    }

    this.appliedStats[this.currentLine] = deltas;

    // ✅ Handle choices
    if (current.choices) {
      this.choicesBox.setChoices(current.choices);
      return;
    }

    // ✅ Handle background changes
    if (current.background) {
      await this.changeBackground(current.background, current.transition);
      this.nextDialogue();
      return;
    }

    // ✅ Update Game State
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

    if (this.choicesBox.choices.length > 0) this.choicesBox.clear();
    if (this.currentLine <= 0) return;

    const nextLineIndex = this.currentLine;
    const next = this.dialogues[nextLineIndex];

    // 🔁 Reverse stats
    const deltas = this.appliedStats[nextLineIndex];
    if (deltas) {
      const reverse = {};

      // 💰 Reverse money
      if (typeof deltas.money === "number" && deltas.money !== 0) {
        reverse.money = -deltas.money;
      }

      // ⚡ Reverse energy
      if (deltas.energy !== undefined) {
        if (deltas.energy === "reset" && deltas.prevEnergy !== null) {
          // restore energy before reset
          const c = this.core.currentCharacter;
          c.energy = deltas.prevEnergy;
          this.popupNotif?.show("Energy Reverted", "yellow");
        } else if (typeof deltas.energy === "number" && deltas.energy !== 0) {
          reverse.energy = -deltas.energy;
        }
      }

      // 🔋 Reverse max_energy
      if (typeof deltas.max_energy === "number" && deltas.max_energy !== 0) {
        this.statsManager.modifyMaxEnergy(-deltas.max_energy);
      }

      if (Object.keys(reverse).length > 0) {
        this.statsManager.applyStats(reverse);
      }

      delete this.appliedStats[nextLineIndex];
    }

    // Move back
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

    if (prev?.choices) this.choicesBox.setChoices(prev.choices);

    if (this.core.gameState) {
      this.core.gameState.currentScene.dialogues = this.currentLine;
    }

    this.render(this.core.ctx);
  }

  handleChoice(choice) {
    const deltas = { money: 0, energy: 0, max_energy: 0, prevEnergy: null };

    if (typeof choice.max_energy === "number" && choice.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(choice.max_energy);
      deltas.max_energy = choice.max_energy;
    }

    if (choice.money !== undefined) {
      this.statsManager.applyStats({ money: choice.money });
      if (typeof choice.money === "number") deltas.money = choice.money;
    }

    if (choice.energy !== undefined) {
      const c = this.core.currentCharacter;
      deltas.prevEnergy = c?.energy ?? null;

      this.statsManager.applyStats({ energy: choice.energy });
      if (typeof choice.energy === "number") deltas.energy = choice.energy;
      else if (choice.energy === "reset") deltas.energy = "reset";
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
