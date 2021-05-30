'use strict';

// There's a maximum number of AudioContexts we can generate that is hardware-dependent. Eventually
// the constructor just returns null. Use either a specified number or maximum amount of contexts.
class AudioContextFactory {
  constructor(maxContexts) {
    this.useNext = -1;
    this.maxContexts = maxContexts;
    this.contexts = [];

    if (maxContexts < 1) {
      throw Error('Need at least one AudioContext');
    }

    for (let i = 0; i < maxContexts; i++) {
      this.create();
    }
  }

  create() {
    let audioContext;

    if (this.contexts.length === this.maxContexts) {
      audioContext = this.contexts[this.useNext];
    } else {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();

      if (audioContext) {
        this.contexts.push(audioContext);
      } else {
        console.log('AudioContext constructor failed at size ' + this.contexts.length);
        this.useNext = 0;
        this.maxContexts = this.contexts.length;

        audioContext = this.contexts[this.useNext];
      }
    }

    this.useNext++;

    if (this.useNext === this.maxContexts) {
      this.useNext = 0;
    }

    return audioContext;
  }
}

module.exports = AudioContextFactory;
