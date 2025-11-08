import { DialogueBox } from "./components/dialoguebox.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.dialogues = [];
    this.currentLine = 0;
    this.dialogueBox = new DialogueBox(core);

    this.clickHandler = (e) => this.nextDialogue(e);

    // Delay flag
    this.canClick = true;
    this.clickDelay = 100; // milliseconds
  }

  async load() {
    const res = await fetch("./data/data-scenes.json");
    const data = await res.json();
    this.data = data[this.sceneId];

    if (!this.data) {
      console.error(`Scene '${this.sceneId}' not found.`);
      return;
    }

    this.dialogues = this.data.dialogues;

    // Load background image of the scene (reuse background from data)
    const bgRes = await fetch("./data/data-backgrounds.json");
    const bgData = await bgRes.json();
    const bg = bgData[this.data.background];
    if (bg && bg.image) {
      this.image = new Image();
      this.image.src = bg.image;
      await new Promise((resolve) => (this.image.onload = resolve));
    }

    // Add click listener
    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
  }

  onResize(scale) {
    this.dialogueBox = new DialogueBox(this.core); // text size recalculated on render
  }

  nextDialogue() {
    if (this.dialogueBox.isTyping) {
      // If still typing, finish immediately
      this.dialogueBox.currentText = this.dialogues[this.currentLine].text;
      this.dialogueBox.isTyping = false;
      return;
    }

    this.currentLine++;
    if (this.currentLine >= this.dialogues.length) {
      const goto = this.data.goto;
      if (goto) {
        import("./background.js").then(async (mod) => {
          const bg = new mod.Background(this.core, goto);
          await bg.load();
          this.core.setActiveScene(bg);
        });
      }
    }
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw dialogue
    if (this.currentLine < this.dialogues.length) {
      const { speaker, text } = this.dialogues[this.currentLine];
      this.dialogueBox.render(ctx, speaker, text);
    }
  }

  update() {}
}
