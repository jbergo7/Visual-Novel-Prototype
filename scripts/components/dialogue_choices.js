// dialogue_choices.js (same as before)
export class DialogueChoices {
  constructor(core, onSelect) {
    this.core = core;
    this.onSelect = onSelect; // callback(choice)
    this.choices = [];
    this.clickHandler = this.handleClick.bind(this);
  }

  setChoices(choices) {
    this.choices = choices || [];
    this.core.canvas.addEventListener("click", this.clickHandler);
  }

  clear() {
    this.choices = [];
    this.core.canvas.removeEventListener("click", this.clickHandler);
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

      if (
        mouseX > x - 20 &&
        mouseX < x + width &&
        mouseY > y &&
        mouseY < y + height
      ) {
        this.onSelect(choice); // <-- call scene.js
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

      // Background box
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(x - boxWidth / 2, y, boxWidth, canvas.height * 0.08);

      // Text
      ctx.fillStyle = "#fff";
      ctx.fillText(choice.text, x, y + canvas.height * 0.04);
    });
  }
}
