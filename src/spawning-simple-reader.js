///////////////////// SpawningSimpleReader /////////////////////

subclass(SpawningSimpleReader, PerigramReader);
// subclassed from PerigramReader in order to have access to certain of its methods

function SpawningSimpleReader(g, rx, ry, speed) {

  Reader.call(this, g, rx, ry, speed); // superclass constructor
  this.type = 'SpawningSimpleReader'; //  superclass variable(s)

  this.consoleString = '';
  this.downWeighting = .6;
  this.upWeighting = .12;

  if (!speed) this.speed = SPEED.Fluent; // default speed for SpawningSimpleReaders (DH shouldn't be needed)

  this.activeFill =  colorToObject(255, 252, 0, 255); // #FFFD00
  // this.neighborCol = [127, 10, 30, 255];

  // factors
  this.fadeInFactor = .8;
  this.fadeOutFactor = 10;
  this.delayFactor = 2.5;

}

SpawningSimpleReader.prototype.onEnterCell = function (curr) {

  // console.log('onEnter: '+ curr.text() + " " + this.speed + " " + this.stepTime);
  // curr.showBounds(1); // DEBUG

  // ---- based on Java VB NeighborFadingVisual ---- //
  // variables needed individually for instances of perigram readers:
  this.actualStepTime = this.stepTime / 1000;
  this.fadeInTime = this.actualStepTime * this.fadeInFactor;
  this.fadeOutTime = this.actualStepTime * this.fadeOutFactor;
  this.delayBeforeFadeBack = this.actualStepTime * this.delayFactor;

  // fading current in and out
  fid = curr.colorTo(this.activeFill, this.fadeInTime);
  curr.colorTo(this.pman.defaultFill, this.fadeOutTime, this.delayBeforeFadeBack + this.fadeInTime); // 1st arg: this.pman.defaultFill

  var coords, spawned, g = Grid.gridFor(curr), neighbors = g.neighborhood(curr);

	// SE:
  if (this._isViableDirection(this.lastRead(2), curr, neighbors[8], 8)) {
    //info("SpawningSimple ack'd and spawned on " + neighbors[8].text());
    coords = Grid.coordsFor(neighbors[8]);
    spawned = new OnewayPerigramReader(g, coords.x, coords.y, SPEED.Fast, 8, curr);
    Reader.DEBUG_CREATES && console.log('[MEM] Create #'+spawned.id+'  (SE)');
	}

  // NE: (No else if here: these readers should be able to spawn in both vectors at once)
  if (this._isViableDirection(this.lastRead(2), curr, neighbors[2], 2)) {
    //info("SpawningSimple ack'd and spawned on " + neighbors[2].text());
    coords = Grid.coordsFor(neighbors[2]);
    spawned = new OnewayPerigramReader(g, coords.x, coords.y, SPEED.Fast, 2, curr);
    Reader.DEBUG_CREATES && console.log('[MEM] Create #'+spawned.id+'  (NE)');
    // this.pause(true); // DEBUG
  }

}

SpawningSimpleReader.prototype.selectNext = function () {

  var last = this.lastRead(2),
    neighbors = Grid.gridFor(this.current).neighborhood(this.current);

  return this._determineReadingPath(last, neighbors);
}

SpawningSimpleReader.prototype.onExitCell = function (curr) {
  // unused dummy method override that prevents an error generated by superclass methods (in Reader)
}

SpawningSimpleReader.prototype._determineReadingPath = function (last, neighbors) {

  if (!neighbors) throw Error("no neighbors");

  if (!this.current) throw Error("no current cell!");

  return neighbors[5] || this.current; // 5 = E(ast), the natural next word

}

//////////////////////// Exports ////////////////////////

if (typeof module != 'undefined' && module.exports) { // for node

  module.exports = SpawningSimpleReader;
}
