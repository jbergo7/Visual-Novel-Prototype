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

    this.clickHandler = this.nextDialogue.bind(this);

    this.isLoading = false; // block clicks during async load
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

    // Load background image
    const bgRes = await fetch("./data/data-backgrounds.json");
    const bgData = await bgRes.json();
    const bg = bgData[this.data.background];
    if (bg && bg.image) {
      this.image = new Image();
      this.image.src = bg.image;
      await new Promise((resolve) => (this.image.onload = resolve));
    }

    // Remove old listener first
    this.unload();

    // Add click listener
    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
  }

  onResize(scale) {
    this.dialogueBox = new DialogueBox(this.core); // recalc text size
  }

  async nextDialogue() {
    if (this.isLoading) return; // prevent duplicate click

    if (this.dialogueBox.isTyping) {
      // Finish typing immediately
      this.dialogueBox.currentText = this.dialogues[this.currentLine].text;
      this.dialogueBox.isTyping = false;
      return;
    }

    this.currentLine++;

    if (this.currentLine >= this.dialogues.length) {
      const goto = this.data.goto;
      if (goto) {
        this.isLoading = true;

        // Remove current listener before transition
        this.unload();

        const mod = await import("./background.js");
        const bg = new mod.Background(this.core, goto);
        await bg.load();
        this.core.setActiveScene(bg);

        this.isLoading = false;
      }
    }
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (this.image)
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Dialogue
    if (this.currentLine < this.dialogues.length) {
      const { speaker, text } = this.dialogues[this.currentLine];
      this.dialogueBox.render(ctx, speaker, text);
    }
  }

  update() {}
}
