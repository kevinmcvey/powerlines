'use strict';

const paper = require('paper');

const { TensionedString } = require('./tensioned-string');

class SceneManager {
  constructor(background, mouse, audioContextFactory, stringProperties) {
    this.background = background;
    this.background.registerScene(this);

    this.mouse = mouse;
    this.mouse.registerScene(this);

    this.audioContextFactory = audioContextFactory;

    this.strings = this.constructStrings(stringProperties);
  }

  constructStrings(stringProperties) {
    return stringProperties.map((props) => {
      return new TensionedString(props.start, props.end, props.frequency, this.audioContextFactory,
                                 this.background);
    });
  }

  onWindowResize() {
    this.strings.forEach((string) => {
      string.regenerate(this.background);
    });
  }

  onMouseDown(mouse, event) {
  }

  onMouseUp(mouse, event) {
    for (let string of this.strings) {
      if (string.isHeld()) {
        string.letGo();
      }
    }
  }

  onMouseMove(mouse, event) {
    for (let string of this.strings) {
      if (string.isHeld() || mouse.path.intersects(string.path)) {
        const point = this.eventToPoint(event);
        string.hold(point);
      }
    }
  }

  eventToPoint(event) {
    if (event.type.includes('touch')) {
      return new paper.Point(event.touches[0].clientX, event.touches[0].clientY);
    }

    return new paper.Point(event.clientX, event.clientY);
  }
}

module.exports = SceneManager;
