import { DialogueBox } from "./components/dialoguebox.js";
import { DialogueChoices } from "./components/dialogue_choices.js";
import { PopupNotif } from "./components/popup_notif.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.dialogues = [];
    this.currentLine = -1;

    this.dialogueBox = new DialogueBox(core);
    this.choicesBox = new DialogueChoices(core, (choice) =>
      this.handleChoice(choice)
    );

    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    this.popupNotif = core.popupNotif;

    this.clickHandler = this.nextDialogue.bind(this);
    this.isLoading = false;
  }

  async load() {
    const res = await fetch("./data/data-scenes.json");
    const data = await res.json();
    this.data = data[this.sceneId];
    if (!this.data) return console.error(`Scene '${this.sceneId}' not found.`);

    this.dialogues = this.data.dialogues || [];

    // Load background
    const bgRes = await fetch("./data/data-backgrounds.json");
    const bgData = await bgRes.json();
    const bgId = this.data.background || "home";
    const bg = bgData[bgId];
    if (bg && bg.image) {
      this.image = new Image();
      this.image.src = bg.image;
      await new Promise((resolve) => (this.image.onload = resolve));
    }

    this.unload();
    this.core.canvas.addEventListener("click", this.clickHandler);
    this.nextDialogue();
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
    this.choicesBox.clear();
  }

  /**
   * 🔁 Shared stat update handler
   */
  updateStat(stat, value) {
    const c = this.core.currentCharacter;
    const current = c[stat];
    const newValue = current + value;

    // ⛔ If insufficient resources
    if (value < 0 && current + value < 0) {
      this.popupNotif.show(
        `Not Enough ${stat.charAt(0).toUpperCase() + stat.slice(1)}`,
        "red"
      );
      return false;
    }

    // ✅ Apply change and show notif
    c[stat] = newValue;
    const amount = Math.abs(value);
    const message =
      value < 0
        ? `-${amount} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`
        : `+${amount} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
    const color = value < 0 ? "red" : "green";
    this.popupNotif.show(message, color);
    return true;
  }

  handleChoice(choice) {
    const c = this.core.currentCharacter;

    // 💰 MONEY
    if (choice.money && choice.money !== 0) {
      const success = this.updateStat("money", choice.money);
      if (!success) return; // stop action if insufficient
    }

    // ⚡ ENERGY
    if (choice.energy && choice.energy !== 0) {
      const success = this.updateStat("energy", choice.energy);
      if (!success) return; // stop action if insufficient
    }

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

  async nextDialogue() {
    if (this.isLoading || this.choicesBox.choices.length > 0) return;

    this.currentLine++;
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

    // Show choices first
    if (current.choices) {
      this.choicesBox.setChoices(current.choices);
      return;
    }

    // Background change
    if (current.background) {
      await this.changeBackground(current.background, current.transition);
      // automatically advance to next dialogue after fade
      this.nextDialogue();
      return;
    }

    // Apply stat changes + show popup
    if (current.money || current.energy) {
      this.applyStats(current);
      // ✅ Auto-advance if no speaker/text or choices
      if (!current.speaker && !current.text && !current.choices) {
        this.nextDialogue();
        return;
      }
    }
  }

  // Unified function for applying stats + popup
  applyStats(current) {
    const c = this.core.currentCharacter;

    if (current.money && current.money !== 0) {
      c.money += current.money;
      const amount = Math.abs(current.money);
      const message =
        current.money < 0 ? `-$${amount} Money` : `+$${amount} Money`;
      const color = current.money < 0 ? "red" : "green";
      this.popupNotif.show(message, color);
    }

    if (current.energy && current.energy !== 0) {
      c.energy += current.energy;
      const amount = Math.abs(current.energy);
      const message =
        current.energy < 0 ? `-${amount} Energy` : `+${amount} Energy`;
      const color = current.energy < 0 ? "red" : "green";
      this.popupNotif.show(message, color);
    }
  }

  // Unified function for applying stats + popup
  applyStats(current) {
    const c = this.core.currentCharacter;

    if (current.money && current.money !== 0) {
      c.money += current.money;
      const amount = Math.abs(current.money);
      const message =
        current.money < 0 ? `-$${amount} Money` : `+$${amount} Money`;
      const color = current.money < 0 ? "red" : "green";
      this.popupNotif.show(message, color);
    }

    if (current.energy && current.energy !== 0) {
      c.energy += current.energy;
      const amount = Math.abs(current.energy);
      const message =
        current.energy < 0 ? `-${amount} Energy` : `+${amount} Energy`;
      const color = current.energy < 0 ? "red" : "green";
      this.popupNotif.show(message, color);
    }
  }

  async changeBackground(bgId, transition) {
    const bgRes = await fetch("./data/data-backgrounds.json");
    const bgData = await bgRes.json();
    const bg = bgData[bgId];
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
    if (this.dialogueBox?.onResize) this.dialogueBox.onResize(scaleRatio);
    if (this.choicesBox?.onResize) this.choicesBox.onResize(scaleRatio);
    if (this.popupNotif?.onResize) this.popupNotif.onResize(scaleRatio);
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
