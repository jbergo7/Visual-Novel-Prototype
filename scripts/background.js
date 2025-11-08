import { Header } from "./components/header.js";
import { Button } from "./components/button.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;
    this.bgData = null;
    this.image = null;
    this.buttons = [];
    this.header = new Header(core);
    this.scale = 1;

    // Flag para i-disable click habang naglo-load
    this.isLoading = false;
  }

  async load() {
    this.isLoading = true;

    const res = await fetch("./data/data-backgrounds.json");
    const data = await res.json();
    this.bgData = data[this.backgroundId];

    if (!this.bgData) {
      console.error(`Background '${this.backgroundId}' not found.`);
      this.isLoading = false;
      return;
    }

    // Load background image
    this.image = new Image();
    this.image.src = this.bgData.image;
    await new Promise((resolve) => (this.image.onload = resolve));

    // Remove old listeners
    this.unload();

    // Create buttons
    this.buttons = this.bgData.buttons.map((btnData) => {
      const btn = new Button(this.core, btnData);
      btn.addClickListener(async () => {
        if (this.isLoading) return; // ignore clicks while loading
        const action = btn.data?.action;
        if (!action) return;

        // Start loading new scene/background
        this.isLoading = true;

        switch (action.type) {
          case "background": {
            this.unload();
            const bgModule = await import("./background.js");
            const bg = new bgModule.Background(this.core, action.target);
            await bg.load();
            this.core.setActiveScene(bg);
            break;
          }
          case "scene": {
            this.unload();
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
    this.isLoading = false;
  }

  unload() {
    this.buttons.forEach((btn) => btn.removeClickListener());
  }

  onResize(scale) {
    this.scale = scale;
    this.buttons.forEach((btn) => btn.resize(scale));
    if (this.header?.onResize) this.header.onResize(scale);
  }

  executeGameFunction(name) {
    if (name === "restPlayer") {
      console.log("Player is resting... energy restored!");
      // TODO: update character energy
    }
  }

  render(ctx) {
    const canvas = this.core.canvas;

    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    this.header?.render(ctx);
    this.buttons.forEach((btn) => btn.render(ctx));
  }

  update() {}
}
