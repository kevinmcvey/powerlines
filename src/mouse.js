'use strict';

const paper = require('paper');

const mouseStates = {
  DOWN: 0,
  UP: 1,
};

class Mouse {
  constructor(maxSegments) {
    // TODO: Consider removing maxSegments if the segment length doesn't appear to be posing
    //       much of a performance hit
    this.maxSegments = maxSegments;

    this.state = mouseStates.UP;

    this.path = new paper.Path();
    // this.path.strokeColor = 'black';
  }

  registerScene(scene) {
    this.scene = scene;
    this.bindToWindow();
  }

  bindToWindow() {
    window.addEventListener('mousedown', (event) => { this.onMouseDown(event) });
    window.addEventListener('touchstart', (event) => { this.onMouseDown(event) });

    window.addEventListener('mouseup', (event) => { this.onMouseUp(event) });
    window.addEventListener('touchend', (event) => { this.onMouseUp(event) });
    window.addEventListener('touchcancel', (event) => { this.onMouseUp(event) });

    window.addEventListener('mousemove', (event) => { this.onMouseMove(event) });
    window.addEventListener('touchmove', (event) => { this.onMouseMove(event) });
  }

  onMouseDown(event) {
    this.state = mouseStates.DOWN;
    this.addSegment(event);

    this.scene.onMouseDown(this, event);
  }

  onMouseUp(event) {
    this.state = mouseStates.UP;
    this.clear();

    this.scene.onMouseUp(this, event);
  }

  onMouseMove(event) {
    if (this.state === mouseStates.UP) {
      return;
    }

    this.addSegment(event);
    this.removeOldestSegments();

    this.scene.onMouseMove(this, event);
  }

  eventToPoint(event) {
    if (event.type.includes('touch')) {
      return new paper.Point(event.touches[0].clientX, event.touches[0].clientY);
    }

    return new paper.Point(event.clientX, event.clientY);
  }

  addSegment(mouseEvent) {
    const mouseLocation = this.eventToPoint(mouseEvent);
    this.path.add(mouseLocation);
  }

  removeOldestSegments() {
    const length = this.path.segments.length;

    if (length < this.maxSegments) {
      return;
    }

    this.path.removeSegments(0, length - this.maxSegments);
  }

  clear() {
    this.path.removeSegments();
  }
}

module.exports = Mouse;
