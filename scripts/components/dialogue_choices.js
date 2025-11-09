export class DialogueChoices {
  constructor(core, onSelect) {
    this.core = core;
    this.onSelect = onSelect; // callback(choice)
    this.choices = [];
    this.clickHandler = this.handleClick.bind(this);
  }

  setChoices(choices) {
    this.choices = (choices || []).map((choice) => ({
      ...choice,
      disabled: this.isChoiceDisabled(choice),
    }));
    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  clear() {
    this.choices = [];
    this.core.canvas.removeEventListener("click", this.clickHandler);
  }

  /**
   * 💡 Check if choice is affordable
   */
  isChoiceDisabled(choice) {
    const c = this.core.currentCharacter;

    // If choice spends money, check balance
    if (choice.money && choice.money < 0 && c.money + choice.money < 0) {
      return true;
    }

    // If choice consumes energy, check balance
    if (choice.energy && choice.energy < 0 && c.energy + choice.energy < 0) {
      return true;
    }

    return false;
  }

  handleClick(e) {
    if (this.choices.length === 0) return;

    const rect = this.core.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvas = this.core.canvas;
    const ctx = this.core.ctx;
    const boxWidth = canvas.width * 0.6;
    const boxHeight = this.choices.length * (canvas.height * 0.08 + 10);
    const startY = (canvas.height - boxHeight) / 2;

    ctx.font = `${canvas.height * 0.03}px Arial`;

    this.choices.forEach((choice, i) => {
      const y = startY + i * (canvas.height * 0.08 + 10);
      const textWidth = ctx.measureText(choice.text).width;
      const halfWidth = textWidth / 2;
      const x = canvas.width / 2 - halfWidth;
      const width = textWidth + 40;
      const height = canvas.height * 0.08;

      // 🛑 Ignore click if choice is disabled
      if (choice.disabled) return;

      if (
        mouseX > x - 20 &&
        mouseX < x + width &&
        mouseY > y &&
        mouseY < y + height
      ) {
        this.onSelect(choice); // callback to scene.js
        this.clear();
      }
    });
  }

  render(ctx) {
    if (this.choices.length === 0) return;

    const canvas = this.core.canvas;
    const boxWidth = canvas.width * 0.6;
    const boxHeight = this.choices.length * (canvas.height * 0.08 + 10);
    const startY = (canvas.height - boxHeight) / 2;

    ctx.font = `${canvas.height * 0.03}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    this.choices.forEach((choice, i) => {
      const y = startY + i * (canvas.height * 0.08 + 10);
      const x = canvas.width / 2;

      // Different background if disabled
      ctx.fillStyle = choice.disabled
        ? "rgba(80, 80, 80, 0.5)"
        : "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(x - boxWidth / 2, y, boxWidth, canvas.height * 0.08);

      // Text color & opacity
      ctx.fillStyle = choice.disabled ? "rgba(200,200,200,0.5)" : "#fff";
      ctx.fillText(choice.text, x, y + canvas.height * 0.04);
    });
  }

  /**
   * ✅ Optional resize support
   */
  onResize(scaleRatio) {
    this.scaleRatio = scaleRatio;
  }
}
