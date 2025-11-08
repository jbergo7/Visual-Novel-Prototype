import { Header } from "./components/header.js";
import { Button } from "./components/button.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;
    this.bgData = null;
    this.image = null;
    this.buttons = [];

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

      // Preload image
      const newImg = new Image();
      newImg.src = this.bgData.image;
      await new Promise((resolve) => (newImg.onload = resolve));
      this.image = newImg;

      // Remove old buttons before creating new ones
      this.unload();

      // Create new buttons
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);

        btn.addClickListener(async () => {
          if (this.isLoading) return;

          const action = btn.data?.action;
          if (!action) return;

          this.isLoading = true;

          // Remove current buttons immediately to prevent lingering clicks
          this.unload();

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
    // Remove all button listeners
    this.buttons.forEach((btn) => btn.removeClickListener());
    this.buttons = [];
    // Header stays persistent
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

    // Draw background
    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw header
    this.header?.render(ctx);

    // Draw buttons on top
    this.buttons.forEach((btn) => btn.render(ctx));
  }

  update() {}
}
