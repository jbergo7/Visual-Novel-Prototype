import { Header } from "./components/header.js";
import { Button } from "./components/button.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";
import MenuButton from "./components/menu_button.js";
import MenuPopup from "./components/menu_popup.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;

    this.bgData = null;
    this.image = null;
    this.buttons = [];
    this.scale = 1;
    this.isLoading = false;

    // Shared singletons
    if (!core.header) core.header = new Header(core);
    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    if (!core.statsManager) core.statsManager = new StatsManager(core);
    if (!core.menuButton) core.menuButton = new MenuButton(core);
    if (!core.menuPopup) core.menuPopup = new MenuPopup(core);

    this.header = core.header;
    this.popupNotif = core.popupNotif;
    this.statsManager = core.statsManager;
    this.menuButton = core.menuButton;
    this.menuPopup = core.menuPopup;

    // add click listener instead of core.input
    this._clickHandler = (e) => this.handleCanvasClick(e);
    this.core.canvas.addEventListener("click", this._clickHandler);
  }

  dispose() {
    this.core.canvas.removeEventListener("click", this._clickHandler);
  }

  async load() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const bgCache = this.core.dataCache?.backgrounds;
      if (!bgCache) throw new Error("Background data not found in cache");

      this.bgData = bgCache[this.backgroundId];
      if (!this.bgData)
        throw new Error(`Background '${this.backgroundId}' not found.`);

      console.debug(`🎨 Loading background: ${this.backgroundId}`);

      // Load BG Image
      const img = new Image();
      img.src = this.bgData.image;
      await new Promise((r) => (img.onload = r));
      this.image = img;

      // clear old buttons
      this.unload();

      // build new buttons
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);

        btn.addClickListener(async () => {
          if (this.menuPopup.visible) return;
          if (this.isLoading) return;

          const action = btn.data?.action;
          if (!action) return;

          // resource check
          const check = this.statsManager.checkResources(action);
          if (!check.enough) {
            this.popupNotif.show(check.message, "red");
            return;
          }

          // modify max energy
          if (
            typeof action.max_energy === "number" &&
            action.max_energy !== 0
          ) {
            this.statsManager.modifyMaxEnergy(action.max_energy);
          }

          this.statsManager.applyStats(action);

          if (!action.type) return;

          this.isLoading = true;
          this.unload();

          // background / scene transitions
          switch (action.type) {
            case "background": {
              this.core.updateGameState("background", action.target);
              const { Background } = await import("./background.js");
              const bg = new Background(this.core, action.target);
              await bg.load();
              this.core.setActiveScene(bg);
              break;
            }
            case "scene": {
              this.core.updateGameState("scene", action.target, 0);
              const { Scene } = await import("./scene.js");
              const scene = new Scene(this.core, action.target);
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

      console.debug(`✅ Background ready: ${this.backgroundId}`);
    } catch (err) {
      console.error("❌ Failed to load background:", err);
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
    this.popupNotif?.onResize(scale);

    // place global menu button (header also adjusts it)
    const canvas = this.core.canvas;
    const size = this.menuButton.size || 30;
    this.menuButton.x = canvas.width - size - 10;
    this.menuButton.y = 20;
  }

  executeGameFunction(name) {
    const c = this.core.currentCharacter;
    if (!c) return;

    switch (name) {
      case "restPlayer":
        c.energy = c.max_energy || 100;
        this.popupNotif.show("Energy Restored", "green");
        break;
    }
  }

  // THIS is the fixed click handler
  handleCanvasClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1. Menu button toggle
    if (this.menuButton.containsPoint(x, y)) {
      this.menuPopup.toggle();
      return;
    }

    // 2. If menu is open → block everything except popup
    if (this.menuPopup.visible) {
      return;
    }

    // 3. Background buttons
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw BG
    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // header
    this.header?.render(ctx);

    // background buttons
    this.buttons.forEach((btn) => btn.render(ctx));

    // notifications
    this.popupNotif?.render(ctx);

    // dim if menu is open
    if (this.menuPopup.visible) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // menu button
    this.menuButton.render(ctx);

    // popup menu (final layer)
    this.menuPopup.render(ctx);
  }
}
