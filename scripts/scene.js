import { DialogueBox } from "./components/dialoguebox.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.nextImage = null;
    this.fadeAlpha = 0;
    this.isFading = false;
    this.fadeDuration = 1000; // ms
    this.fadeStart = 0;
    this.dialogues = [];
    this.currentLine = 0;
    this.dialogueBox = new DialogueBox(core);
    this.clickHandler = this.nextDialogue.bind(this);
    this.isLoading = false;
  }

  async load() {
    const res = await fetch("./data/data-scenes.json");
    const data = await res.json();
    this.data = data[this.sceneId];

    if (!this.data) {
      console.error(`Scene '${this.sceneId}' not found.`);
      return;
    }

    this.dialogues = this.data.dialogues || [];

    // ✅ Load default background if defined
    if (this.data.background) {
      this.image = await this.loadBackground(this.data.background);
    }

    // Remove old listener and add a fresh one
    this.unload();
    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
  }

  async loadBackground(bgId) {
    if (!bgId) return null;

    const bgRes = await fetch("./data/data-backgrounds.json");
    const bgData = await bgRes.json();
    const bg = bgData[bgId];
    if (!bg || !bg.image) {
      console.warn(`Background '${bgId}' not found.`);
      return null;
    }

    const img = new Image();
    img.src = bg.image;
    await new Promise((resolve) => (img.onload = resolve));
    return img;
  }

  async changeBackground(bgId, transition) {
    if (!transition) {
      // No animation
      this.image = await this.loadBackground(bgId);
      return;
    }

    if (transition === "fade") {
      this.nextImage = await this.loadBackground(bgId);
      this.isFading = true;
      this.fadeStart = performance.now();
      this.fadeAlpha = 0;
    } else {
      // fallback to instant switch for unknown transition
      this.image = await this.loadBackground(bgId);
    }
  }

  async nextDialogue() {
    if (this.isLoading || this.isFading) return;

    if (this.dialogueBox.isTyping) {
      this.dialogueBox.finishTyping();
      return;
    }

    this.currentLine++;

    while (this.currentLine < this.dialogues.length) {
      const line = this.dialogues[this.currentLine];

      // 🔹 Handle background changes mid-dialogue
      if (line.background) {
        this.isLoading = true;
        await this.changeBackground(line.background, line.transition);
        this.isLoading = false;
        this.currentLine++;
        continue;
      }

      // 🔹 If it's a valid dialogue line, stop here
      if (line.speaker && line.text) break;

      this.currentLine++;
    }

    // 🔹 End of scene → go to next scene or background
    if (this.currentLine >= this.dialogues.length) {
      const goto = this.data.goto;
      if (goto) {
        this.isLoading = true;
        this.unload();
        const mod = await import("./background.js");
        const bg = new mod.Background(this.core, goto);
        await bg.load();
        this.core.setActiveScene(bg);
        this.isLoading = false;
      }
    }
  }

  onResize() {
    this.dialogueBox = new DialogueBox(this.core);
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Render background with fade transition ---
    if (this.isFading && this.nextImage) {
      const elapsed = performance.now() - this.fadeStart;
      this.fadeAlpha = Math.min(elapsed / this.fadeDuration, 1);

      if (this.image)
        ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.globalAlpha = this.fadeAlpha;
      ctx.drawImage(this.nextImage, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      if (this.fadeAlpha >= 1) {
        this.image = this.nextImage;
        this.nextImage = null;
        this.isFading = false;
      }
    } else {
      if (this.image)
        ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // --- Dialogue box ---
    if (this.currentLine < this.dialogues.length) {
      const line = this.dialogues[this.currentLine];
      if (line.speaker && line.text)
        this.dialogueBox.render(ctx, line.speaker, line.text);
    }
  }

  update() {}
}
