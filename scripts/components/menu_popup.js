// components/menu_popup.js
export default class MenuPopup {
  constructor(core) {
    this.core = core;
    this.visible = false;

    this.buttons = [
      { text: "Resume", id: "resume" },
      { text: "Load Game", id: "load" },
      { text: "Save Game", id: "save" },
      { text: "Settings", id: "settings" },
      { text: "Back to Title Screen", id: "title" },
    ];

    this.hoverIndex = -1;

    this._moveHandler = (e) => this.onMouseMove(e);
    this._clickHandler = (e) => this.onClick(e);

    this.core.canvas.addEventListener("mousemove", this._moveHandler);
    this.core.canvas.addEventListener("click", this._clickHandler);
  }

  dispose() {
    this.core.canvas.removeEventListener("mousemove", this._moveHandler);
    this.core.canvas.removeEventListener("click", this._clickHandler);
  }

  open() {
    this.visible = true;
  }

  close() {
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
  }

  onMouseMove(e) {
    if (!this.visible) {
      this.hoverIndex = -1;
      return;
    }

    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const canvas = this.core.canvas;
    const btnHeight = canvas.height * 0.08;
    const startY = canvas.height * 0.25;

    this.hoverIndex = -1;

    this.buttons.forEach((btn, i) => {
      const bx = canvas.width / 2;
      const by = startY + i * (btnHeight + 20);

      const width = canvas.width * 0.5;
      const halfW = width / 2;
      const halfH = btnHeight / 2;

      if (
        x >= bx - halfW &&
        x <= bx + halfW &&
        y >= by - halfH &&
        y <= by + halfH
      ) {
        this.hoverIndex = i;
      }
    });
  }

  onClick(e) {
    if (!this.visible) return;

    const index = this.hoverIndex;
    if (index === -1) return;

    const btn = this.buttons[index];

    switch (btn.id) {
      case "resume":
        this.close();
        break;

      case "load":
        console.log("Load Game clicked");
        break;

      case "save":
        console.log("Save Game clicked");
        break;

      case "settings":
        console.log("Settings clicked");
        break;

      case "title":
        console.log("Returning to Title Screen...");

        this.close();

        // 👉 Reset or dispose current scene/setup
        if (this.core.currentScene && this.core.currentScene.dispose) {
          this.core.currentScene.dispose();
        }

        // 👉 Load the title screen
        this.core.hasSave = true;
        this.core.loadScene("TitleScreen");
        break;
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const canvas = this.core.canvas;

    // dim background
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // popup buttons
    const btnHeight = canvas.height * 0.08;
    const centerX = canvas.width / 2;
    let y = canvas.height * 0.25;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.buttons.forEach((btn, i) => {
      const width = canvas.width * 0.5;
      const halfW = width / 2;
      const halfH = btnHeight / 2;

      // button bg
      ctx.fillStyle =
        this.hoverIndex === i
          ? "rgba(255, 255, 255, 0.25)"
          : "rgba(255, 255, 255, 0.1)";

      ctx.fillRect(centerX - halfW, y - halfH, width, btnHeight);

      // text
      ctx.fillStyle = "#fff";
      ctx.font = `${canvas.height * 0.035}px Arial`;
      ctx.fillText(btn.text, centerX, y);

      y += btnHeight + 20;
    });
  }
}
