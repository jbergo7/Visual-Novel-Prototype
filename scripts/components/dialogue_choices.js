export class DialogueChoices {
  constructor(core, onSelect) {
    this.core = core;
    this.onSelect = onSelect; // callback(choice)
    this.choices = [];
    this.hoverIndex = -1; // 🟢 track hovered choice
    this.clickHandler = this.handleClick.bind(this);
    this.moveHandler = this.handleMouseMove.bind(this);
  }

  setChoices(choices) {
    this.choices = (choices || []).map((choice) => ({
      ...choice,
      disabled: this.isChoiceDisabled(choice),
    }));
    this.core.canvas.addEventListener("click", this.clickHandler, {
      capture: true,
    });
    this.core.canvas.addEventListener("mousemove", this.moveHandler, {
      capture: true,
    });
  }

  clear() {
    this.choices = [];
    this.hoverIndex = -1;
    this.core.canvas.removeEventListener("click", this.clickHandler, {
      capture: true,
    });
    this.core.canvas.removeEventListener("mousemove", this.moveHandler, {
      capture: true,
    });
  }

  isChoiceDisabled(choice) {
    const c = this.core.currentCharacter;

    if (choice.money && choice.money < 0 && c.money + choice.money < 0) {
      return true;
    }

    if (choice.energy && choice.energy < 0 && c.energy + choice.energy < 0) {
      return true;
    }

    return false;
  }

  handleMouseMove(e) {
    if (this.choices.length === 0) return;
    if (this.core.menuPopup.visible) return;
    if (this.core.saveLoadPopup?.visible) return;

    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvas = this.core.canvas;
    const boxWidth = canvas.width * 0.6;
    const boxHeight = canvas.height * 0.08;
    const startY = (canvas.height - this.choices.length * (boxHeight + 10)) / 2;

    let hovered = -1;

    this.choices.forEach((_, i) => {
      const y = startY + i * (boxHeight + 10);
      const x = canvas.width / 2 - boxWidth / 2;

      if (
        mouseX > x &&
        mouseX < x + boxWidth &&
        mouseY > y &&
        mouseY < y + boxHeight
      ) {
        hovered = i;
      }
    });

    if (hovered !== this.hoverIndex) {
      this.hoverIndex = hovered;
      // this.core.requestRender(); // 🔄 re-render to update highlight
    }
  }

  handleClick(e) {
    if (this.choices.length === 0) return;
    // Block click if menu or SaveLoadPopup visible
    if (this.core.menuPopup.visible || this.core.saveLoadPopup?.visible) {
      //e.stopImmediatePropagation(); // 🔥 Siguraduhin na hihinto agad
      //e.preventDefault();
      return;
    }

    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvas = this.core.canvas;
    const boxWidth = canvas.width * 0.6;
    const boxHeight = canvas.height * 0.08;
    const startY = (canvas.height - this.choices.length * (boxHeight + 10)) / 2;

    this.choices.forEach((choice, i) => {
      const y = startY + i * (boxHeight + 10);
      const x = canvas.width / 2 - boxWidth / 2;

      if (choice.disabled) return;

      if (
        mouseX > x &&
        mouseX < x + boxWidth &&
        mouseY > y &&
        mouseY < y + boxHeight
      ) {
        this.onSelect(choice);
        this.clear();
        e.stopImmediatePropagation(); // 🔥 stop further click
        e.preventDefault();
      }
    });
  }

  render(ctx) {
    if (this.choices.length === 0) return;

    const canvas = this.core.canvas;
    const boxWidth = canvas.width * 0.6;
    const boxHeight = canvas.height * 0.08;
    const startY = (canvas.height - this.choices.length * (boxHeight + 10)) / 2;

    ctx.font = `${canvas.height * 0.03}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.choices.forEach((choice, i) => {
      const y = startY + i * (boxHeight + 10);
      const x = canvas.width / 2;

      // 🟢 Background colors with hover + disabled states
      if (choice.disabled) {
        ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
      } else if (i === this.hoverIndex) {
        ctx.fillStyle = "rgba(51, 51, 51, 0.47)"; // hover highlight
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      }

      ctx.fillRect(x - boxWidth / 2, y, boxWidth, boxHeight);

      // 🟢 Text color
      ctx.fillStyle = choice.disabled ? "rgba(150, 150, 150, 0.5)" : "#fff";
      ctx.fillText(choice.text, x, y + boxHeight / 2);
    });
  }

  onResize(scaleRatio) {
    this.scaleRatio = scaleRatio;
  }
}
