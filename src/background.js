'use strict';

// For debug rectangle
const paper = require('paper');

class Background {
  constructor(divId, imageAspectRatio, topLeft, bottomRight, viewportAspectRatio) {
    this.div = document.getElementById(divId);
    this.imageAspectRatio = imageAspectRatio;
    this.viewportAspectRatio = viewportAspectRatio;

    this.topLeft = topLeft;
    this.bottomRight = bottomRight;

    this.reposition();
    this.bindToWindow();
  }

  reposition() {
    const windowWidth = this.div.parentElement.clientWidth;
    const windowHeight = this.div.parentElement.clientHeight;
    const windowAspectRatio = windowWidth / windowHeight;

    const viewportWidthScalar = this.bottomRight.x - this.topLeft.x;
    const viewportHeightScalar = this.bottomRight.y - this.topLeft.y;

    const fillDimension = (windowAspectRatio < this.viewportAspectRatio) ? 'width' : 'height';

    // TODO: This can be made more DRY but it's not like this is for a job or anything. :)
    if (fillDimension === 'width') {
      const scale = 1 / viewportWidthScalar;
      const newWidth = windowWidth * scale;
      const newHeight = newWidth / this.imageAspectRatio;

      const newSize = new paper.Point(newWidth, newHeight);

      // 1. move viewport to window edge
      let newTopLeft = newSize.multiply(this.topLeft);
      let newBottomRight = newSize.multiply(this.bottomRight);

      // 2. center the entire scaled image
      let centerImageTransform = ((windowHeight - newHeight) / 2.0);
      newTopLeft.y += centerImageTransform;
      newBottomRight.y += centerImageTransform;

      // 3. prevent the centering transform from clipping the viewport
      let correction = 0;
      correction -= Math.max(0, newBottomRight.y - windowHeight);
      correction += Math.abs(Math.min(0, newTopLeft.y));

      centerImageTransform += correction;

      this.width = newWidth;
      this.height = newHeight;
      this.x = -newTopLeft.x;
      this.y = centerImageTransform;
    }

    if (fillDimension === 'height') {
      const scale = 1 / viewportHeightScalar;
      const newHeight = windowHeight * scale;
      const newWidth = newHeight * this.imageAspectRatio;

      const newSize = new paper.Point(newWidth, newHeight);

      // 1. move viewport to window edge
      let newTopLeft = newSize.multiply(this.topLeft);
      let newBottomRight = newSize.multiply(this.bottomRight);

      // 2. center the entire scaled image
      let centerImageTransform = ((windowWidth - newWidth) / 2.0);
      newTopLeft.x += centerImageTransform;
      newBottomRight.x += centerImageTransform;

      // 3. prevent the centering transform from clipping the viewport
      let correction = 0;
      correction -= Math.max(0, newBottomRight.x - windowWidth);
      correction += Math.abs(Math.min(0, newTopLeft.x));

      centerImageTransform += correction;

      this.width = newWidth;
      this.height = newHeight;
      this.x = centerImageTransform;
      this.y = -newTopLeft.y;
    }

    this.adjustDiv();
  }

  adjustDiv() {
    this.div.style['width'] = this.width;
    this.div.style['height'] = this.height;
    this.div.style['left'] = this.x;
    this.div.style['top'] = this.y;
  }

  scaleUnitPointToWorld(unitPoint) {
    return new paper.Point(
      (unitPoint.x * this.width) + this.x,
      (unitPoint.y * this.height) + this.y
    );
  }

  informSceneOfResize() {
    this.scene.onWindowResize();
  }

  registerScene(scene) {
    this.scene = scene;
  }

  bindToWindow() {
    window.addEventListener('resize', () => {
      this.reposition();
      this.informSceneOfResize();
    });
  }
}

module.exports = Background;
