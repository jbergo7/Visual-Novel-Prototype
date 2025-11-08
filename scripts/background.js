import { Header } from "./components/header.js";
import { Button } from "./components/button.js";
import { PopupNotif } from "./components/popup_notif.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;
    this.bgData = null;
    this.image = null;
    this.buttons = [];

    // Use global header and popup notif
    if (!core.header) core.header = new Header(core);
    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);

    this.header = core.header;
    this.popupNotif = core.popupNotif;

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

      // Load new background image
      const newImg = new Image();
      newImg.src = this.bgData.image;
      await new Promise((resolve) => (newImg.onload = resolve));
      this.image = newImg;

      this.unload();

      // Create buttons
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);

        btn.addClickListener(async () => {
          if (this.isLoading) return;

          const action = btn.data?.action;
          if (!action) return;

          const c = this.core.currentCharacter;
          if (c) {
            // Check for insufficient resources before proceeding
            if (
              typeof action.energy === "number" &&
              c.energy + action.energy < 0
            ) {
              this.popupNotif.show("Not Enough Energy", "red");
              return;
            }

            if (
              typeof action.money === "number" &&
              c.money + action.money < 0
            ) {
              this.popupNotif.show("Not Enough Money", "red");
              return;
            }

            // Apply valid changes
            if (typeof action.energy === "number") {
              c.energy += action.energy;
              console.log(`${c.name} energy updated: ${c.energy}`);
            }
            if (typeof action.money === "number") {
              c.money += action.money;
              console.log(`${c.name} money updated: ${c.money}`);
            }
          }

          this.isLoading = true;
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
    this.buttons.forEach((btn) => btn.removeClickListener());
    this.buttons = [];
  }

  onResize(scale) {
    this.scale = scale;
    this.buttons.forEach((btn) => btn.resize(scale));
    this.header?.onResize(scale);
    this.popupNotif?.onResize(this.scale);
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

  update() {
    // Nothing yet
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

    // Render popup notification if visible
    this.popupNotif?.render(ctx);
  }
}
