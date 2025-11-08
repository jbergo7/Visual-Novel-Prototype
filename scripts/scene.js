import { DialogueBox } from "./components/dialoguebox.js";
import { DialogueChoices } from "./components/dialogue_choices.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.dialogues = [];
    this.currentLine = -1; // start before first dialogue
    this.dialogueBox = new DialogueBox(core);
    this.choicesBox = new DialogueChoices(core, (choice) =>
      this.handleChoice(choice)
    );

    this.clickHandler = this.nextDialogue.bind(this);
    this.isLoading = false;
  }

  async load() {
    // Load scene data
    const res = await fetch("./data/data-scenes.json");
    const data = await res.json();
    this.data = data[this.sceneId];
    if (!this.data) return console.error(`Scene '${this.sceneId}' not found.`);

    this.dialogues = this.data.dialogues || [];

    // No more local character fetch
    // Use global runtime character from core
    if (!this.core.currentCharacter) {
      console.warn("No currentCharacter found in core!");
      return;
    }

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
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
    this.choicesBox.clear();
  }

  handleChoice(choice) {
    const c = this.core.currentCharacter; // use global character

    if (choice.money) {
      c.money += choice.money;
      console.log(`${c.name} money: ${c.money}`);
    }
    if (choice.energy) {
      c.energy += choice.energy;
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

    if (current.choices) {
      this.choicesBox.setChoices(current.choices);
    } else if (current.background) {
      await this.changeBackground(current.background, current.transition);
    } else if (current.money || current.energy) {
      // Apply stat changes directly to global character
      const c = this.core.currentCharacter;
      if (current.money) c.money += current.money;
      if (current.energy) c.energy += current.energy;
    }
  }

  async changeBackground(bgId, transition) {
    const bgRes = await fetch("./data/data-backgrounds.json");
    const bgData = await bgRes.json();
    const bg = bgData[bgId];
    if (bg && bg.image) {
      const newImg = new Image();
      newImg.src = bg.image;
      await new Promise((resolve) => (newImg.onload = resolve));

      if (transition === "fade") {
        const canvas = this.core.canvas;
        const ctx = this.core.ctx;
        let alpha = 0;
        return new Promise((resolve) => {
          const fadeInterval = setInterval(() => {
            alpha += 0.05;
            if (alpha >= 1) {
              alpha = 1;
              clearInterval(fadeInterval);
              resolve();
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = alpha;
            ctx.drawImage(newImg, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
          }, 30);
        }).then(() => {
          this.image = newImg;
        });
      } else {
        this.image = newImg;
      }
    }
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

    // Draw choices if any
    this.choicesBox.render(ctx);
  }

  update() {}
}
