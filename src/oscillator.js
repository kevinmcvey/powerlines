const MAX_GAIN = 1.0;
const FRAMERATE = Math.floor(1000 / 60);
const SECONDS_PER_FRAME = FRAMERATE / 1000;

const PAN_STEREO = 'stereo';
const PAN_3D = '3d';

class Oscillator {
  constructor(audioContextFactory, frequency) {
    this.frequency = frequency; // Value is in Hz
    this.playing = false;

    this.audioContextFactory = audioContextFactory;

    this.audioContext = undefined;
    this.oscillatorNode = undefined;
    this.gainNode = undefined;
    this.panType = undefined;
    this.panNode = undefined;
  }

  // Not performed in constructor because audio is blocked from autoplaying
  configure() {
    // this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.audioContext = this.audioContextFactory.create();

    this.oscillatorNode = this.audioContext.createOscillator();
    this.oscillatorNode.type = 'triangle';
    this.oscillatorNode.frequency.setValueAtTime(
      this.frequency, this.audioContext.currentTime);

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0.0;

    // StereoPanner is a newer API that not all browsers support.
    if (this.audioContext.createStereoPanner) {
      this.panType = PAN_STEREO;
      this.panNode = this.audioContext.createStereoPanner();
    } else {
      this.panType = PAN_3D;
      this.panNode = this.audioContext.createPanner();
      this.panNode.panningModel = 'equalpower';
    }

    this.oscillatorNode.connect(this.gainNode);
    this.gainNode.connect(this.panNode);

    // Theoretically this would end with:
    // this.panNode.connect(this.audioContext.destination);
    // But we'll leave that connection for .start()
  }

  isConfigured() {
    return !!this.audioContext;
  }

  update(gain, pan) {
    if (!this.isConfigured()) {
      return;
    }

    // Sudden changes in gain and pan causes a discontinuity in the waveform that the ear hears as
    // a "click" or a "pop". To avoid this problem we linearly interpolate between values with a
    // transition period of one frame.
    this.gainNode.gain.linearRampToValueAtTime(gain * MAX_GAIN, this.nextFrame());

    if (this.panType === PAN_STEREO) {
      this.panNode.pan.linearRampToValueAtTime(pan, this.nextFrame());
    } else if (this.panType === PAN_3D) {
      this.panNode.setPosition(pan, 0, 1 - Math.abs(pan));
    }
  }

  nextFrame() {
    return (this.audioContext.currentTime + SECONDS_PER_FRAME);
  }

  start() {
    if (this.playing) {
      return;
    }

    const mustConfigure = !this.isConfigured();
    if (mustConfigure) {
      this.configure();
    }

    this.panNode.connect(this.audioContext.destination);

    if (mustConfigure) {
      this.oscillatorNode.start();
    }

    this.audioContext.resume();

    this.playing = true;
  }

  stop() {
    if (!this.playing) {
      return;
    }

    this.gainNode.gain.linearRampToValueAtTime(0, this.nextFrame());
    this.panNode.disconnect(this.audioContext.destination);
    this.playing = false;
  }
}

module.exports = Oscillator;
