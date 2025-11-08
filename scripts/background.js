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

    // Bind click handler once
    this.clickHandler = this.handleClick.bind(this);
  }

  async load() {
    const res = await fetch("./data/data-backgrounds.json");
    const data = await res.json();
    this.bgData = data[this.backgroundId];

    if (!this.bgData) {
      console.error(`Background '${this.backgroundId}' not found.`);
      return;
    }

    this.image = new Image();
    this.image.src = this.bgData.image;
    await new Promise((resolve) => (this.image.onload = resolve));

    this.buttons = this.bgData.buttons.map(
      (btnData) => new Button(this.core, btnData)
    );

    // Remove old listener first to prevent duplicates
    this.unload();

    // Attach click listener
    this.core.canvas.addEventListener("click", this.clickHandler);

    // Initial resize
    this.onResize(this.scale);
  }

  unload() {
    // Remove listener safely
    this.core.canvas.removeEventListener("click", this.clickHandler);
  }

  onResize(scale) {
    this.scale = scale;

    this.buttons.forEach((btn) => btn.resize(scale));
    if (this.header && this.header.onResize) {
      this.header.onResize(scale);
    }
  }

  async handleClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const btn of this.buttons) {
      if (btn.isInside(mouseX, mouseY)) {
        const action = btn.data?.action;
        if (!action) continue;

        switch (action.type) {
          case "background": {
            // Remove listener only when transitioning
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
            // Do NOT unload listener for normal functions
            this.executeGameFunction(action.name);
            break;
        }

        break; // stop checking after first match
      }
    }
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

    if (this.header) this.header.render(ctx);
    this.buttons.forEach((btn) => btn.render(ctx));
  }

  update() {}
}
