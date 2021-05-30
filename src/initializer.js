'use strict';

const paper = require('paper');

const Mouse = require('./mouse');
const SceneManager = require('./scene-manager');
const { TensionedString } = require('./tensioned-string');
const Background = require('./background');
const AudioContextFactory = require('./audio-context-factory');

const MAX_MOUSE_SEGMENTS = 50000;

const SOURCE_WIDTH = 4032;
const SOURCE_HEIGHT = 3024;
const SOURCE_ASPECT_RATIO = SOURCE_WIDTH / SOURCE_HEIGHT;

const AUDIO_THREADS = 4;

const NOTE = {
  'B2': 123.47,
  'C3': 130.81,
  'C#3': 138.59,
  'D3': 146.83,
  'D#3': 155.56,
  'E3': 164.81,
  'F3': 174.61,
  'F#3': 185.00,
  'G3': 196.00,
  'G#3': 207.65,
  'A3': 220.00,
  'A#3': 233.08,
  'B3': 246.94,
  'C4': 261.63,
  'C#4': 277.18,
  'D4': 293.66,
  'D#4': 311.13,
  'E4': 329.63,
  'F4': 349.23,
  'F#4': 369.99,
  'G4': 392.00,
  'G#4': 415.30,
  'A4': 440.00,
  'A#4': 466.16,
  'B4': 493.88,
  'C5': 523.25,
  'C#5': 554.37,
  'D5': 587.33
};

function scalarize(point) {
  return new paper.Point(point[0] / SOURCE_WIDTH, point[1] / SOURCE_HEIGHT);
}

window.onload = () => {
  paper.setup('myCanvas');

  const viewportTopLeft = scalarize([0, 0]);
  const viewportBottomRight = scalarize([SOURCE_WIDTH, SOURCE_HEIGHT]);
  const viewportAspectRatio = SOURCE_ASPECT_RATIO;

  let background = new Background('background', SOURCE_ASPECT_RATIO, viewportTopLeft,
                                  viewportBottomRight, viewportAspectRatio);

  let mouse = new Mouse(MAX_MOUSE_SEGMENTS);

  // if ((new URLSearchParams(window.location.search)).get('a') == 1) {
  let strings = [
    // Left-side to center telephone pole (upper group)
    // [[0, 612], [1611, 511], 'C4']// ,
    [[0, 612], [1611, 511], 'C3'],
    [[0, 660], [1651, 574], 'D3'],
    [[0, 697], [1670, 622], 'E3'],

    // Center telephone pole to right-side
    [[1628, 514], [4032, 113], 'F3'],
    [[1707, 571], [4032, 205], 'G3'],
    [[1719, 622], [4032, 282], 'A3'],

    // Left-side to center telephone pole (lower group)
    [[0, 1218], [1650, 1110], 'B3'],
    [[0, 1246], [1648, 1146], 'C4'],

    // Center telephone pole to right-side (lower group)
    [[1650, 1110], [3527, 1107], 'D4'],
    [[1648, 1146], [3516, 1127], 'E4'],

    // Diagonal, left-side to center telephone pole
    [[137, 1394], [1654, 579], 'F4'],

    // Right-side mostly vertical
    [[3254, 0], [3659, 711], 'G4'],
    [[3395, 0], [4032, 1278], 'A4'],
    [[3566, 0], [4032, 942], 'B4']
  ];

  // If URL ends with '?notes=', extract the comma separated list of notes and use that instead.
  const userNotes = (new URLSearchParams(window.location.search)).get('notes');
  if (userNotes) {
    const notes = userNotes.split(',')

    if (notes.length === strings.length) {
      console.log('Loading alternative notes: ', notes);
      for (let i = 0; i < strings.length; i++) {
        strings[i][2] = notes[i].toUpperCase().replace('S', '#');
      }
    }
  }

  const stringProperties = strings.map((pair) => {
    return {
      start: scalarize(pair[0]),
      end: scalarize(pair[1]),
      frequency: NOTE[pair[2]]
    };
  });

  // Create all of the AudioContext objects ahead of time. They will be in state "suspended".
  // The TensionedString class will then take one of the contexts as a data member.
  const audioContextFactory = new AudioContextFactory(AUDIO_THREADS);

  const scene = new SceneManager(background, mouse, audioContextFactory, stringProperties);

  // AudioContexts are constructed in a "suspended" state that can only be resumed once the user
  // has interacted with the browser in some way. Chrome is smart and will allow you to resume
  // anywhere in the call stack of a window event listener. Safari for IOS is ... I don't even
  // know. I can only get Safari for IOS to enable the AudioContexts in this top-level
  // EventListener and even then only without any other redirection. UGH.
  window.addEventListener('touchstart', () => {
    for (let i = 0; i < audioContextFactory.contexts.length; i++) {
      if (audioContextFactory.contexts[i].state === 'suspended') {
        audioContextFactory.contexts[i].resume();
      }
    }
  });

  // Prevent the window from scrolling on mobile
  window.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
};
