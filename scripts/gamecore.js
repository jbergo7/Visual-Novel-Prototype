export class GameCore {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.baseWidth = 1920;
    this.baseHeight = 1080;

    this.scaleRatio = 1;
    this.activeScene = null;
    this.characters = [];
    this.currentCharacter = null;

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  async initialize() {
    await this.loadCharacters();
    this.resizeCanvas();
    this.startGameLoop();
  }

  async loadCharacters() {
    const res = await fetch("./data/data-characters.json");
    this.characters = await res.json();
    this.currentCharacter =
      this.characters.find((ch) => ch.default === true) || this.characters[0];
  }

  resizeCanvas() {
    // Maintain aspect ratio of 1080x1920
    const aspect = this.baseWidth / this.baseHeight;
    let newWidth = window.innerWidth;
    let newHeight = window.innerHeight;

    if (newWidth / newHeight > aspect) {
      newWidth = newHeight * aspect;
    } else {
      newHeight = newWidth / aspect;
    }

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;

    this.scaleRatio = newWidth / this.baseWidth;

    if (this.activeScene?.onResize) {
      this.activeScene.onResize(this.scaleRatio);
    }
  }

  startGameLoop() {
    const loop = () => {
      this.update();
      this.render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  update() {
    if (this.activeScene?.update) this.activeScene.update();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.activeScene?.render) this.activeScene.render(ctx);
  }

  setActiveScene(scene) {
    this.activeScene = scene;
    if (scene.onResize) scene.onResize(this.scaleRatio);
  }
}
