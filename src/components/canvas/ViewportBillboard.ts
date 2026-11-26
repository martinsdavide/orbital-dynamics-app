import { Sprite, SpriteMaterial, Vector2, type CanvasTexture } from 'three';

const viewportSize = new Vector2();

export class ViewportBillboard extends Sprite {
  constructor(texture: CanvasTexture, height: number, depthTest = true) {
    super(new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest,
      sizeAttenuation: false,
    }));

    const image = texture.image;
    const width = height * image.width / image.height;

    // Frustum culling would use the sprite's unprojected size near the viewport edge.
    this.frustumCulled = false;
    this.onBeforeRender = (renderer, _scene, camera) => {
      const viewportHeight = renderer.getSize(viewportSize).y;
      if (viewportHeight <= 0) return;

      // The sprite shader cancels perspective depth. Convert CSS pixels using the current projection.
      const scale = 2 / (viewportHeight * camera.projectionMatrix.elements[5]);
      if (this.scale.y === height * scale) return;
      this.scale.set(width * scale, height * scale, 1);
      this.updateMatrixWorld();
    };
  }
}
