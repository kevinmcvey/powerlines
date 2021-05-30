'use strict';

const paper = require('paper');
const Oscillator = require('./oscillator');

const FRAMERATE = Math.floor(1000 / 60);
// const FRAMERATE = 1000;

const PIXELS_PER_SEGMENT = 12;

const stringStates = {
  HELD: 0,
  LOOSE: 1,
};

function clamp(value, min, max) {
  return Math.max(Math.min(value, max), min);
}

class TensionedString {
  constructor(startUnitPoint, endUnitPoint, audioFrequency, audioContextFactory, background) {
    this.startUnitPoint = startUnitPoint;
    this.endUnitPoint = endUnitPoint;

    // I haven't really gotten to the bottom of this but segmentLength cannot dip below (t + 1)
    // while timeStep is 30.0. I think my wave equation solver is wrong in some way.
    this.m = 20.0;
    this.t = 10.0;
    this.maxMagnitude = 60; // TODO: make this configurable, string by string? (make based upon string size? On mobile the string stretches too far)
    this.damp = 0.995;
    this.timeStep = 30.0;

    this.oscillator = new Oscillator(audioContextFactory, audioFrequency);

    this.regenerate(background);
  }

  regenerate(background) {
    if (this.path) {
      this.path.remove();
      clearInterval(this.processId);
    }

    this.start = background.scaleUnitPointToWorld(this.startUnitPoint);
    this.end = background.scaleUnitPointToWorld(this.endUnitPoint);

    // Must use an even number of segments
    let initialSegments = Math.floor(this.end.getDistance(this.start) / PIXELS_PER_SEGMENT);
    if (initialSegments % 2 != 0) {
      initialSegments -= 1;
    }

    this.path = this.constructPath(this.start, this.end, initialSegments);

    // numSegments counts the initial SVG moveTo as a segment
    this.numSegments = this.path.segments.length;
    this.segmentLength = this.start.getDistance(this.end) / (this.numSegments - 1);

    this.normal = this.getNormal(this.start, this.end);
    this.unitVector = this.end.subtract(this.start).normalize();

    this.initializeSegments();

    this.draw();

    // TODO: Make this configurable
    this.path.strokeColor = '#555';
    this.path.strokeWidth = 1;

    this.processId = this.scheduleUpdates();
  }

  constructPath(start, end, numSegments) {
    let path = new paper.Path();

    path.moveTo(start);
    path.segments[0].home = start;
    path.segments[0].homet = 0;

    const deltaX = (end.x - start.x) / numSegments;
    const deltaY = (end.y - start.y) / numSegments;

    for (let i = 0; i < numSegments; i++) {
      const endpointIndex = i + 1;
      const x = start.x + (endpointIndex * deltaX);
      const y = start.y + (endpointIndex * deltaY);

      let point = new paper.Point(x, y);
      path.lineTo(point);

      path.segments[path.segments.length - 1].home = point;
      path.segments[path.segments.length - 1].homet = (i + 1) / numSegments;
    }

    return path;
  }

  getNormal(start, end) {
    const delta = end.subtract(start);
    const normal = new paper.Point(delta.y, -delta.x);

    return normal.normalize();
  }

  initializeSegments() {
    for (let i = 0; i < this.numSegments; i++) {
      this.path.segments[i].displacement = 0;
    }

    this.updateSlopes();
    this.updateDeltaSlopes();
    this.updateAccelerations();
    this.initializeZeroVelocity();

    // this.state = stringStates.HELD;
    this.state = stringStates.LOOSE;
  }

  holdSegment(segmentId, displacement) {
    for (let i = 0; i < segmentId; i++) {
      this.path.segments[i].displacement = -displacement * (i / segmentId);
    }

    this.path.segments[segmentId].displacement = -displacement;

    for (let i = segmentId + 1; i < this.numSegments; i++) {
      this.path.segments[i].displacement = -displacement * (1 - ((i - segmentId) / (this.numSegments - segmentId - 1)));
    }

    this.draw();
  }

  initializeZeroVelocity() {
    for (let i = 0; i < this.numSegments; i++) {
      this.path.segments[i].velocity = 0;
    }
  }

  //  change in slope
  // (d2y / dx2) = ((M / L) / T) * (d2y / dt2)
  updateSlopes() {
    for (let i = 1; i < this.numSegments - 1; i++) {
      const x = this.path.segments[i - 1].homet * this.path.length;
      const displacement = this.path.segments[i - 1].displacement;
      const nextX = this.path.segments[i + 1].homet * this.path.length;
      const nextDisplacement = this.path.segments[i + 1].displacement;

      let slope = (nextDisplacement - displacement) / (nextX - x);
      this.path.segments[i].slope = slope;
    }

    this.path.segments[0].slope = this.path.segments[1].slope;
    this.path.segments[this.numSegments - 1].slope = this.path.segments[this.numSegments - 2].slope;
  }

  updateDeltaSlopes() {
    for (let i = 1; i < this.numSegments - 1; i++) {
      const x = this.path.segments[i - 1].homet * this.path.length;
      const slope = this.path.segments[i - 1].slope;
      const nextX = this.path.segments[i + 1].homet * this.path.length;
      const nextSlope = this.path.segments[i + 1].slope;

      const deltaSlope = (nextSlope - slope) / (nextX - x);
      this.path.segments[i].deltaSlope = deltaSlope;
    }

    this.path.segments[0].deltaSlope = this.path.segments[1].deltaSlope;
    this.path.segments[this.numSegments - 1].deltaSlope = this.path.segments[this.numSegments - 2].deltaSlope;
  }

  updateAccelerations() {
    for (let i = 1; i < this.numSegments - 1; i++) {
      const mu = this.m / this.t;

      const acceleration = this.path.segments[i].deltaSlope / mu;
      this.path.segments[i].acceleration = acceleration;
    }

    this.path.segments[0].acceleration = 0;
    this.path.segments[this.numSegments - 1].acceleration = 0;
  }

  updateVelocities() {
    for (let i = 1; i < this.numSegments - 1; i++) {
      this.path.segments[i].velocity += (this.timeStep * this.path.segments[i].acceleration);
    }
  }

  updateDisplacements() {
    let maxDisplacement = -1;
    let peakSegment = -1;

    for (let i = 1; i < this.numSegments - 1; i++) {
      this.path.segments[i].displacement += (this.timeStep * this.path.segments[i].velocity);
      this.path.segments[i].displacement *= this.damp;

      const absDisplacement = Math.abs(this.path.segments[i].displacement);
      if (absDisplacement > maxDisplacement) {
        maxDisplacement = absDisplacement;
        peakSegment = i;
      }
    }

    this.peakSegment = peakSegment;
    this.maxDisplacement = maxDisplacement;
  }

  updateOscillator() {
    // Modulate gain from 0 to 1
    const gain = (this.maxDisplacement / this.maxMagnitude);

    // Pan from -1 to 1
    const pan = ((this.peakSegment / this.numSegments) * 2) - 1;

    this.oscillator.update(gain, pan);
  }

  draw() {
    for (let i = 1; i < this.numSegments - 1; i++) {
      const displacement = this.normal.multiply(this.path.segments[i].displacement);

      this.path.segments[i].point.x = this.path.segments[i].home.x + displacement.x;
      this.path.segments[i].point.y = this.path.segments[i].home.y + displacement.y;
    }
  }

  update() {
    if (this.isHeld()) {
      return;
    }

    this.updateSlopes();
    this.updateDeltaSlopes();
    this.updateAccelerations();
    this.updateVelocities();
    this.updateDisplacements();
    this.updateOscillator();

    this.draw();
  }

  hold(point) {
    this.state = stringStates.HELD;

    const { nearestSegmentId, distance, isOverstretched } = this.findNearestSegment(point);

    if (isOverstretched) {
      return;
    }

    this.holdSegment(nearestSegmentId, distance);

    this.oscillator.stop();
  }

  letGo() {
    this.updateSlopes();
    this.updateDeltaSlopes();
    this.updateAccelerations();
    this.initializeZeroVelocity();

    this.state = stringStates.LOOSE;

    this.oscillator.start();
  }

  // Projection onto the line is defined as:
  //
  //   (X - A) . (B - A) / |(B - A)|
  findNearestSegment(mousePoint) {
    const translated = mousePoint.subtract(this.start);
    const length = translated.dot(this.unitVector);

    const rawSegment = length / this.segmentLength;
    const intSegment = Math.round(rawSegment);

    // Do not allow the nearest segment to be the beginning or end.
    const nearestSegmentId = clamp(intSegment, 1, this.numSegments - 2);
    const nearestPoint = this.path.segments[nearestSegmentId].home;

    let distance = mousePoint.getDistance(nearestPoint);
    let isOverstretched = false;

    if (distance > this.maxMagnitude) {
      distance = this.maxMagnitude;
      isOverstretched = true;
    }

    if (mousePoint.y < nearestPoint.y) {
      distance *= -1;
    }

    return { nearestSegmentId, distance, isOverstretched };
  }

  scheduleUpdates() {
    return setInterval(() => {
      this.update();
    }, FRAMERATE);
  }

  isHeld() {
    return this.state === stringStates.HELD;
  }

  isLoose() {
    return this.state === stringStates.LOOSE;
  }
}

module.exports = { TensionedString, stringStates };
