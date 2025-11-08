import { Header } from "./components/header.js";
import { Button } from "./components/button.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;
    this.bgData = null;
    this.image = null;
    this.buttons = [];

    // Always use global header
    if (!core.header) {
      core.header = new Header(core);
    }
    this.header = core.header;

    this.scale = 1;
    this.isLoading = false;
  }

  async load() {
    this.isLoading = true;

    try {
      const res = await fetch("./data/data-backgrounds.json");
      const data = await res.json();
      this.bgData = data[this.backgroundId];

      if (!this.bgData) {
        console.error(`Background '${this.backgroundId}' not found.`);
        return;
      }

      // Preload new image
      const newImg = new Image();
      newImg.src = this.bgData.image;
      await new Promise((resolve) => (newImg.onload = resolve));

      // Only update image when loaded
      this.image = newImg;

      // Create buttons for this background
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);
        btn.addClickListener(async () => {
          if (this.isLoading) return;
          const action = btn.data?.action;
          if (!action) return;

          this.isLoading = true;

          switch (action.type) {
            case "background": {
              const bgModule = await import("./background.js");
              const bg = new bgModule.Background(this.core, action.target);
              await bg.load();
              this.core.setActiveScene(bg);
              break;
            }
            case "scene": {
              const sceneModule = await import("./scene.js");
              const scene = new sceneModule.Scene(this.core, action.target);
              await scene.load();
              this.core.setActiveScene(scene);
              break;
            }
            case "function":
              this.executeGameFunction(action.name);
              break;
          }

          this.isLoading = false;
        });
        return btn;
      });

      this.onResize(this.scale);
    } catch (err) {
      console.error("Failed to load background:", err);
    } finally {
      this.isLoading = false;
    }
  }

  unload() {
    // Only remove button listeners
    this.buttons.forEach((btn) => btn.removeClickListener());
    this.buttons = [];
    // Do NOT remove header
  }

  onResize(scale) {
    this.scale = scale;
    this.buttons.forEach((btn) => btn.resize(scale));
    this.header?.onResize(scale);
  }

  executeGameFunction(name) {
    const c = this.core.currentCharacter;
    if (!c) return;

    switch (name) {
      case "restPlayer":
        c.energy = 100;
        console.log(`${c.name} energy restored to ${c.energy}`);
        break;
    }
  }

  render(ctx) {
    const canvas = this.core.canvas;

    // Always draw background first
    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw header on top
    this.header?.render(ctx);

    // Draw buttons on top
    this.buttons.forEach((btn) => btn.render(ctx));
  }

  update() {}
}
