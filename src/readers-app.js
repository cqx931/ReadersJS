//////////// Reader,Grid,PageManager Classes /////////////

/* BUG: *********  !!!!!!!!
 * 	 Font-measurement is not accurate between FF and Chrome, so layout is different,
 * 	 and thus (in FF) node grids do not match browser grids
 */

/////////////////////// GLOBALS /////////////////////////

subclass = function (constructor, superConstructor) {

  function surrogateConstructor() {}

  surrogateConstructor.prototype = superConstructor.prototype;

  var prototypeObject = new surrogateConstructor();
  prototypeObject.constructor = constructor;

  constructor.prototype = prototypeObject;
}

inNode = function () {

  return (typeof module != 'undefined');
}

info = function (msg) {
  console.log("[INFO] " + msg);
}

warn = function (msg) {
  console.log("[WARN] " + msg);
}

err = function (msg, e) {

  e = e || Error(msg);
  console.log("[ERR] " + msg);
  throw e;
}

is = function (obj, type) {

  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase() === type;
}

////////////////////////////// GRID ////////////////////////////////

Grid.SINGLE_GRID_MODE = false;

// see Grid.neighborhood comment for explanation
// allows words that 'could have been' vertical
// NW or SW neighbors to be included in the neighborhood
// and 'previous' words at the end of a line above to be the W neighbor

Grid.ALLOW_ACROSTIC_NEIGHBORS = false;

// add(ing the width of a) space (6 works) to slop will mean that for
// scripts like chinese where all 'words' have equal boundingbox width
// the relevant neighborhood NE, NW, SE, and SW cells will be included

Grid.SLOP = 3;

Grid.instances = [];

Grid.DIRECTION = {

  NW: 0,
  N: 1,
  NE: 2,
  W: 3,
  C: 4,
  E: 5,
  SW: 6,
  S: 7,
  SE: 8
}

function Grid(c, x, y, w, h) {

  this.id = Grid.instances.length;

  this.cells = c;

  this.x = x;
  this.y = y;

  this.header = RiText('', x + w / 2, y / 2);
  this.footer = RiText('' + (this.id + 1), x + w / 2, y + h + 15);

  this.allRiTexts = this.all(); // a 1d array of RiTexts
  this.origWords = this._getWords(); // a 2d  array of strings

  Grid.instances.push(this);
}

Grid.prototype = {

  dispose: function () {

    RiText.disposeAll(this.allRiTexts);
    RiText.disposeAll([this.header, this.footer]);
  },

  draw: function (isRecto) { // not called in Node

    push();

    isRecto && (translate(width / 2, 0));

    for (var i = 0; i < this.cells.length; i++) {
      for (var j = 0; j < this.cells[i].length; j++)
        if (this.cells[i][j]) {
          this.cells[i][j].draw();
        }
    }

    this.header && (this.header.draw());
    this.footer && (this.footer.draw());

    pop();
  },

  /* Returns the RiText on the grid cell with the specified coords or undefined if it doesnt exist */
  cellAt: function (_x, _y) {

    var word, line = this.lineAt(_y);
    if (line && _x >= 0 && _x < line.length)
      word = line[_x];
    return word;
  },

  dump: function () {

    // log the page to console
    var s = '\n---------------- page #' + (1 + this.id) + ' ---------------\n';
    for (var i = 0; i < this.cells.length; i++) {
      for (var j = 0; j < this.cells[i].length; j++)
        s += this.cells[i][j].text() + " "; //  "("+j+","+i+ ") ";
      s += "\n";
    }

  },

  lineAt: function (_y) {

    if (this.cells.length == 0 || _y < 0 || _y > (this.cells.length - 1))
      return undefined;

    return this.cells[_y]; // array
  },

  /**
   * Returns the next word according to typical reading patterns, right->left,
   * top-bottom. The returned cell may be on a different grid.
   * @param x/y grid coords
   */
  next: function (x, y) {

    // try next word on the line
    var newY = y,
      newX = x + 1,
      g = this;

    // is there a line here?
    var rts = g.lineAt(newY);
    if (!rts)
      throw Error("No line at y=" + y + " on grid#" + this.id);

    // are we at end of the line?
    if (newX >= rts.length) {

      // if so, move to 1st word of next line
      newX = 0;
      newY++;
    }

    // is it the last line? if so, look at top of the nextGrid
    if (newY >= g.numLines()) {

      newY = 0;
      g = g.getNext(); // next grid
    }

    // find cell at those coords
    return g.cellAt(newX, newY);
  },

  /**
   * Returns the previous word according to typical reading patterns,
   * right->left, top->bottom.
   */
  previous: function (x, y) {

    // try prev word on the line
    var newY = y,
      newX = x - 1,
      g = this,
      tmp;

    // are we at beginning of line?
    if (newX < 0) {
      // DEBUG console.info("beginning of line in previous");
      newY--; // if so, first reduce Y
    }

    // was it the first line?
    if (newY < 0) {

      // move back to prev grid
      tmp = g.getPrevious(); //

      if (!tmp) {
        err("No previous grid for previousCell(" + x + "," + y + ")" + Grid.currentGrid);
      }

      g = tmp;

      // if so, set to prev last line
      newY = g.numLines() - 1;
    }

    // set newX to end of the new line
    if (newX < 0) {

      if (!g.lineAt(newY)) {
        newX = 0;
        newY = 0;
      } else {
        newX = g.lineAt(newY).length - 1;
      }
    }

    return g.cellAt(newX, newY);
  },

  numLines: function () {

    return (!this.cells || !this.cells.length) ? 0 : this.cells.length;
  },

  getPrevious: function () {

    if (Grid.SINGLE_GRID_MODE) return this;

    return Grid.instances[(this.id == 0) ? Grid.instances.length - 1 : this.id - 1];
    //return this == currentGrid ? nextGrid : currentGrid; // DCH: ???
  },

  getNext: function () {

    if (Grid.SINGLE_GRID_MODE) return this;

    return Grid.instances[(this.id == Grid.instances.length - 1) ? 0 : this.id + 1];
    //return Grid.currentGrid == Grid.currentGrid ? this.nextGrid : Grid.currentGrid;
  },

  /**
   * Returns the 9-cell neighborhood for the specified cell ([4]), as follows:<br>
   *
   * <pre>
   * [0] [1] [2]
   * [3] [4] [5]
   * [6] [7] [8]
   * </pre>
   *
   * One or more of these cells may be undefined if they are off the edge of the
   * grid.
   * <p>
   * Positions (for layout above) are specified as follows:
   *
   * <pre>
   *         [4] = undefined (current word should not be a neighbor of itself?) DH: ok
   *         [3] = the preceding word
   *         [5] = the next word
   *
   *         [2] = rightmost overlapping word on line above
   *               (if current is on first line remains undefined)
   *               but if current is last word in line AND
   *               ALLOW_ACROSTIC_NEIGHBORS = true AND
   *               there is at least one intersectsOnX-word above AND
   *               center juts out rightwards more than this intersecting word THEN
   *               = first word of current line
   *         [8] = rightmost overlapping word on line below
   *               (including the first line of next grid or same if only one)
   *               but if current is last word on line AND
   *               ALLOW_ACROSTIC_NEIGHBORS = true AND
   *               there is at least one intersectsOnX-word below AND
   *               center juts out rightwards more than this intersecting word THEN
   *               = first word 2 lines below wrapping
   *               to first line
   *
   *         [1] = overlapping word preceding 2, otherwise undefined
   *         [7] = overlapping word preceding 8, otherwise undefined
   *
   *         [0] = overlapping word preceding 1, otherwise undefined
   *         [6] = overlapping word preceding 7, otherwise undefined
   * </pre>
   */
  neighborhood: function (center) {

    if (!center) {
      warn("Null RiText passed to Grid.neighborhood()");
      return []; // returning an empty array. Was: new RiText[9];
    }

    var over, under; // rt's (not arrays)
    var pOver, pUnder; // points: grid x,y's of over and under
    var pCenter = Grid.coordsFor(center); // point object
    // info(pCenter.x); // DEBUG

    if (!pCenter) {
      warn("No coords " + "for center: " + center + ", returning []!");
      return [];
    }

    var g = pCenter.grid,
      nextGrid = g.getNext(),
      lineY = pCenter.y,
      lineX = pCenter.x,
      rts = [];

    // get cell directly above if not 1st line
    // we do not allow the first line to wrap back to end of text
    if (lineY > 0) {

      over = g.bestAbove(center, Grid.SLOP);

      if (over) {
        if (g.isLineEnd(center) && Grid.ALLOW_ACROSTIC_NEIGHBORS) {
          if (g.rightOutdentIsGreater(center, over)) {
            over = g.cellAt(0, lineY);
          }
        }
        pOver = Grid.coordsFor(over); // must be the same grid
      }

      // now get the point for 'over' = rts[2]
      //pOver = this.coordsFor(over);
    } else {
      // J: on first line of grid, do nothing - 'over' remains undefined
    }

    // get cell directly below
    if (lineY < g.numLines() - 1) { // not the last line

      under = g.bestBelow(center, Grid.SLOP);

      if (under) { // at least one word is under

        if (g.isLineEnd(center) && Grid.ALLOW_ACROSTIC_NEIGHBORS) {
          if (g.rightOutdentIsGreater(center, under)) {
            under = (lineY < g.numLines() - 2) ? g.cellAt(0, lineY + 2) :
              g.cellAt(0, lineY + 1);
          }
        }
        pUnder = Grid.coordsFor(under);
      }
    } else {

      // is last line so wrap
      under = undefined;

      var firstLine = nextGrid.lineAt(0);

      for (var i = firstLine.length - 1; i >= 0; i--) {

        if (nextGrid.intersectsOnX(center, firstLine[i], Grid.SLOP)) {
          under = firstLine[i];
          break; // must break to grab the *rightmost* match
        }
      }
      if (under)
        pUnder = Grid.coordsFor(under);
    }

    // center row (3,4,5)
    // the lineX > 0 here means that if Grid.ALLOW_ACROSTIC_NEIGHBORS is false
    // then a previous word at the end of the line above will not be put into rts[3] West
    if (lineX > 0 || Grid.ALLOW_ACROSTIC_NEIGHBORS) {

      rts[3] = Grid.previousCell(center);
    }

    rts[4] = undefined; // DEBUG or: center if center is allowed to be a neighbor

    // always wrap, to defer test: if (x < (y).length - 1)
    rts[5] = Grid.nextCell(center); // JC: what if rts[5] is on the next grid?

    // top row (2,1,0)
    if (over) {

      rts[2] = over;
      // DEBUG console.info("rts[2]: " + rts[2] + " " + pOver.x + "," + pOver.y);
      var top = g;

      // always wrap or test: if (pOver.x > 0) {
      rts[1] = top.previous(pOver.x, pOver.y)

      // DEBUG console.info("rts[1]: " + rts[1]);
      if (rts[1]) {

        // DCH NB & TODO: seems to need 'slop' of 3 to work
        // in the following intersectsOnX tests otherwise
        if (!top.intersectsOnX(rts[1], center, Grid.SLOP)) { // 'slop' was 0
          rts[1] = undefined;
        } else {
          top = Grid.gridFor(rts[1]);
        }
      }

      // e.g. if slop is 0 and current.x = 0 then rts[1] will be undefined here
      // DEBUG console.info("rts[1]: " + rts[1]);

      // always wrap or: }
      if (rts[1]) {

        pOver = Grid.coordsFor(rts[1]); // JC: can this

        // always wrap or test: if (pOver.x > 0) {
        rts[0] = top.previous(pOver.x, pOver.y);

        // what if rts[0] is on a diff grid?

        if (rts[0] && !top.intersectsOnX(rts[0], center, Grid.SLOP)) { // 'slop' was 0
          rts[0] = undefined;
          // always wrap or: }
        }
      }
    }

    // bottom row (8,7,6)
    if (under) {

      rts[8] = under;

      // JC: what if rts[8] is on the next grid?
      nextGrid = Grid.gridFor(rts[8]);

      // always wrap or test: if (pUnder.x > 0)
      rts[7] = nextGrid.previous(pUnder.x, pUnder.y);
      //info("rts[7] " + rts[7]);

      if (rts[7]) {

        nextGrid = Grid.gridFor(rts[8]); // need this?

        if (!nextGrid.intersectsOnX(rts[7], center, Grid.SLOP)) { // 'slop' was 0
          // info("defined rts[7]: " + rts[7] + " rejected."); // DEBUG
          rts[7] = undefined;
        } else {
          // what if rts[7] is on a different grid?
          nextGrid = Grid.gridFor(rts[7]);
        }
      }

      if (rts[7]) {

        pUnder = Grid.coordsFor(rts[7]);

        // always wrap or test: if (pUnder.x > 0) {
        rts[6] = nextGrid.previous(pUnder.x, pUnder.y);

        // what if rts[6] is on a diff grid? 'slop' was 0
        if (rts[6] && !nextGrid.intersectsOnX(rts[6], center, Grid.SLOP)) {
          rts[6] = undefined;
        }
      }
    }

    return rts;

  },

  /**
   * Returns all words whose bounding boxes contain the x position of the RiText
   * specified, plus or minus the amount of 'slop' specified.
   */
  bestBelows: function (rt, slop) {

    // Does this handle multiple/incorrect grids??

    if (!rt) {
      warn("Undefined rt passed to Grid.bestBelows()");
      return undefined;
    }

    var p1 = Grid.coordsFor(rt),
      p2, l = new Array();
    if (p1.y < this.numLines() - 1) {
      for (var i = 0; i < this.allRiTexts.length; i++) {
        var test = this.allRiTexts[i];
        p2 = Grid.coordsFor(test);
        if ((p1.y == (p2.y - 1)) && this.intersectsOnX(rt, test, slop)) {
          l.push(test);
        }
      }
    }

    return l;
  },

  bestBelow: function (rt, slop) {

    // Does this handle multiple/incorrect grids??

    var best, bestY = 0,
      l = this.bestBelows(rt, slop);

    if (!l || l == []) {
      warn("Undefined or empty array passed to Grid.bestBelow");
      return undefined;
    }

    for (var i = 0; i < l.length; i++) {
      var cand = l[i];
      if (cand.x > bestY) {
        bestY = cand.x;
        best = cand;
      }
    }
    return best;
  },

  bestAboves: function (rt, slop) {

    // Does this handle multiple/incorrect grids??

    if (!rt) {
      warn("Undefined rt passed to Grid.bestAboves()");
      return undefined;
    }

    var l = new Array(),
      p1 = Grid.coordsFor(rt),
      p2;

    if (p1.y > 0) {
      for (var i = 0; i < this.allRiTexts.length; i++) {
        var test = this.allRiTexts[i];
        p2 = Grid.coordsFor(test);
        if ((p1.y == (p2.y + 1)) && this.intersectsOnX(rt, test, slop)) {
          l.push(test);
        }
      }
    }

    return l;
  },

  bestAbove: function (rt, slop) {

    // Does this handle multiple/incorrect grids??

    var best, bestY = 0,
      l = this.bestAboves(rt, slop);

    if (!l) {
      warn("Undefined line found in Grid.bestAbove()");
      return undefined;
    }

    for (var i = 0; i < l.length; i++) {

      var cand = l[i];

      if (cand.x > bestY) {
        bestY = cand.x;
        best = cand;
      }
    }

    return best;
  },

  intersectsOnX: function (rt1, rt2, slop) {

    // Does this handle (or throw error for) wrong/multiple grids??

    return rt1 && rt2 && this.oneWayOverlapX(rt1, rt2, slop) || this.oneWayOverlapX(rt2, rt1, slop);
  },

  oneWayOverlapX: function (rt1, rt2, slop) {

    var bb, rt1x, bb2x, pad, g1 = Grid.gridFor(rt1),
      g2 = Grid.gridFor(rt2);

    if (g1 != g2) {
      //info('different grids in oneWayOverlapX() g1='+g1+' g2='+g2);
      return false; // JC: is this correct?
    }

    bb = rt2.boundingBox(true);
    rt1x = rt1.x - g1.x;
    bb2x = bb.x - g2.x;
    pad = 2; // ? // was bbPadding  TODO: wha?

    //info("rt1.x: " + rt1.x + " bb.x: " + bb.x +
    //" g1.x: " + g1.x + " g2.x: " + g2.x); // DEBUG

    return (rt1x + pad > (bb2x + pad - slop) &&
      rt1x - pad < (bb2x + bb.width - pad + slop));
  },

  /** returns true if 'rt' is the last word on its line */
  isLineEnd: function (rt) {

    // Does this handle (or throw error for) wrong grid??

    var p = Grid.coordsFor(rt);
    var lineLength = this.lineAt(p.y).length;
    return p.x == lineLength - 1;
  },

  // if its bbx-end < current.bb-end

  rightOutdentIsGreater: function (center, vNeighbor) {

    // Does this handle (or throw error for) wrong grid??

    // changed from rightOutdentIsGreaterOrEqual because // if
    var centerbb = center.boundingBox(),
      vbb = vNeighbor.boundingBox();
    return ((center.x) + centerbb.width > (vNeighbor.x + vbb.width));
  },

  /** Returns the RiText for last cell in the grid. */
  lastCell: function () {

    var p = this.lastCellCoords();
    return this.cellAt(p.x, p.y);
  },

  // returns false if it is last-line of another grid
  onLastLine: function (rt) {

    var cf = Grid.coordsFor(rt);
    return (cf.grid == this && cf.y == numLines() - 1);
  },

  // returns false if it is first-line of another grid
  onFirstLine: function (rt) {

    var cf = Grid.coordsFor(rt);
    return (cf.grid == this && cf.y == 0);
  },

  /** Returns true if the RiText exists on this grid */
  gridContains: function (rt) {

    if (!this.cells) throw Error("gridContains() -> No cells!");

    for (var i = 0; i < this.cells.length; i++) {
      for (var j = 0; j < this.cells[i].length; j++) {
        if (this.cells[i][j] == rt)
          return true;
      }
    }

    return false;
  },

  maxWordLen: function () { // works for only this grid

    var maxWordLength = 0,
      rtl;

    for (var i = 0, k = 0; this.cells.length > 0 && i < this.cells.length; i++) {
      for (var j = 0; j < this.cells[i].length; j++)
        rtl = this.cells[i][j].length();
      if (rtl > maxWordLength)
        maxWordLength = rtl;
    }

    return maxWordLength;
  },

  // returns a single dimensional array of all rts on the grid
  all: function () {

    if (!this.allRiTexts) {
      this.allRiTexts = [];
      for (var i = 0, k = 0; this.cells.length > 0 && i < this.cells.length; i++) {
        for (var j = 0; j < this.cells[i].length; j++)
          this.allRiTexts[k++] = this.cells[i][j];
      }
    }
    return this.allRiTexts;
  },

  // returns a 2d string array of all cells at time of grid creation
  _getWords: function () {

    var words = [];
    for (var i = 0; i < this.cells.length; i++) {
      var line = [];
      for (var j = 0; j < this.cells[i].length; j++) {
        line.push(this.cells[i][j].text());
      }
      words.push(line);
    }
    return words;
  }
};

// //////////////////// STATICS ////////////////////////

Grid.findById = function (id) {

  for (var i = 0, j = Grid.instances.length; i < j; i++) {
    if (Grid.instances[i].id == id)
      return Grid.instances[i];
  }

  err('no grid with id=' + id);
}

Grid.maxWordLength = function (rt) {

  var mwl = 0;
  for (var i = 0; i < Grid.instances.length; i++)
    mwl = Math.max(mwl, Grid.instances[i].maxWordLen());
  return mwl;
}

Grid.gridFor = function (rt) {

  if (!rt) throw Error("null RiText in Grid.gridFor()");

  //info("#Grids: "+Grid.instances.length);

  if (!Grid.instances.length)
    throw Error("No grids in Grid.gridFor() !!!");

  for (var i = 0; i < Grid.instances.length; i++) {
    if (Grid.instances[i].gridContains(rt)) {

      //Grid.instances[i].dump();
      return Grid.instances[i];
    }
  }

  throw Error("Grid.gridFor(): no grid for RiText: " + rt);
}

/* Returns the grid coords for the given RiTexts on this grid only */
Grid.coordsFor = function (rt) {

  if (!rt) throw Error("null RiText in Grid.coordsFor()");

  //info("#GRIDS="+Grid.instances.length);

  var grid = Grid.gridFor(rt);

  for (var i = 0; i < grid.cells.length; i++) {
    for (var j = 0; j < grid.cells[i].length; j++) {
      if (grid.cells[i][j] == rt) {
        return {
          "grid": grid,
          "x": j,
          "y": i
        };
      }
    }
  }

  return undefined;
}

/**
 * Returns the next word according to typical reading patterns, right->left,
 * top->bottom. The returned cell may be on a different grid.
 */
Grid.nextCell = function (rt) {
  //info('nextCell('+rt.text()+');');
  var pt = Grid.coordsFor(rt);
  return pt.grid.next(pt.x, pt.y);
}

/**
 * Returns the previous word according to typical reading patterns,
 * right->left, top-bottom. The returned cell may be on a different grid.
 */
Grid.previousCell = function (rt) {

  var pt = Grid.coordsFor(rt);
  return pt.grid.previous(pt.x, pt.y);
}

/** Resets the cell to its original text */
Grid.resetCell = function (rt) {
  var cf = Grid.coordsFor(rt);
  rt.text(cf.grid.origWords[cf.y][cf.x]);
}

/** Prints all pages to the console */
Grid.dumpPages = function (rt) {
  var s = '';
  for (var i = 0; i < Grid.instances.length; i++)
    s += Grid.instances[i].dump();
  console.log(s)
}

Grid.direction = function (dirConst) {
  switch (dirConst) {
  case Grid.DIRECTION.NW:
    return "NW";
  case Grid.DIRECTION.N:
    return "N";
  case Grid.DIRECTION.NE:
    return "NE";
  case Grid.DIRECTION.W:
    return "W";
  case Grid.DIRECTION.C:
    return "C";
  case Grid.DIRECTION.E:
    return "E";
  case Grid.DIRECTION.SW:
    return "SW";
  case Grid.DIRECTION.S:
    return "S";
  case Grid.DIRECTION.SE:
    return "SE";
  }

  throw Error("Bad Direction: " + dirConst);
}

////////////////////////////// Reader /////////////////////////////////

Reader.SERVER = 3, Reader.CLIENT = 2, Reader.APP = 1; // modes
Reader.HISTORY_SIZE = 10, Reader.NETWORK_PAUSE = 5000;
Reader.WAIT_FOR_NETWORK = false, Reader.PORT = 8088;

// punctuation not included. "’" (right curly quote is part of the character set
Reader.CLOSED_CLASS_WORDS = ["the", "and", "a", "of", "in", "i", "you", "is", "to", "that", "it", "for", "on", "have", "with", "this", "be", "not", "are", "as", "was", "but", "or", "from", "my", "at", "if", "they", "your", "all", "he", "by", "one", "me", "what", "so", "can", "will", "do", "an", "about", "we", "just", "would", "there", "no", "like", "out", "his", "has", "up", "more", "who", "when", "don’t", "some", "had", "them", "any", "their", "it’s", "only", "which", "i’m", "been", "other", "were", "how", "then", "now", "her", "than", "she", "well", "also", "us", "very", "because", "am", "here", "could", "even", "him", "into", "our", "much", "too", "did", "should", "over", "want", "these", "may", "where", "most", "many", "those", "does", "why", "please", "off", "going", "its", "i’ve", "down", "that’s", "can’t", "you’re", "didn’t", "another", "around", "must", "few", "doesn’t", "every", "yes", "each", "maybe", "i’ll", "away", "doing", "oh", "else", "isn’t", "he’s", "there’s", "hi", "won’t", "ok", "they’re", "yeah", "mine", "we’re", "what’s", "shall", "she’s", "hello", "okay", "here’s", "less"];
Reader.STOP_WORDS = ["a", "about", "above", "across", "after", "afterwards", "again", "against", "all", "almost", "alone", "along", "already", "also", "although", "always", "am", "among", "amongst", "amount", "an", "and", "another", "any", "anyhow", "anyone", "anything", "anyway", "anywhere", "are", "around", "as", "at", "back", "be", "became", "because", "become", "becomes", "becoming", "been", "before", "beforehand", "behind", "being", "below", "beside", "besides", "between", "beyond", "bill", "both", "bottom", "but", "by", "call", "can", "cannot", "cant", "co", "computer", "con", "could", "couldn’t", "cry", "de", "describe", "detail", "do", "done", "does", "down", "due", "during", "each", "eg", "eight", "either", "eleven", "else", "elsewhere", "empty", "enough", "etc", "even", "ever", "every", "everyone", "everything", "everywhere", "except", "few", "fifteen", "fifty", "fill", "find", "fire", "first", "five", "for", "former", "formerly", "forty", "found", "four", "from", "front", "full", "further", "get", "give", "go", "had", "has", "hasn’t", "have", "he", "hence", "her", "here", "hereafter", "hereby", "herein", "hereupon", "hers", "herself", "him", "himself", "his", "how", "however", "hundred", "i", "ie", "if", "in", "inc", "indeed", "interest", "into", "is", "it", "its", "itself", "keep", "last", "latter", "latterly", "least", "less", "ltd", "made", "many", "may", "me", "meanwhile", "might", "mill", "mine", "more", "moreover", "most", "mostly", "move", "much", "must", "my", "myself", "name", "namely", "neither", "never", "nevertheless", "next", "nine", "no", "nobody", "none", "noone", "nor", "not", "nothing", "now", "nowhere", "of", "off", "often", "on", "once", "one", "only", "onto", "or", "other", "others", "otherwise", "our", "ours", "ourselves", "out", "over", "own", "part", "per", "perhaps", "please", "put", "rather", "re", "same", "see", "seem", "seemed", "seeming", "seems", "serious", "several", "she", "should", "show", "side", "since", "sincere", "six", "sixty", "so", "some", "somehow", "someone", "something", "sometime", "sometimes", "somewhere", "still", "such", "system", "take", "ten", "than", "that", "the", "their", "them", "themselves", "then", "thence", "there", "thereafter", "thereby", "therefore", "therein", "thereupon", "these", "they", "thick", "thin", "third", "this", "those", "though", "three", "through", "throughout", "thru", "thus", "to", "together", "too", "top", "toward", "towards", "twelve", "twenty", "two", "un", "under", "until", "up", "upon", "us", "very", "via", "was", "we", "well", "were", "what", "whatever", "when", "whence", "whenever", "where", "whereafter", "whereas", "whereby", "wherein", "whereupon", "wherever", "whether", "which", "while", "whither", "who", "whoever", "whole", "whom", "whose", "why", "will", "with", "within", "without", "would", "yet", "you", "your", "yours", "yourself", "yourselves"];

Reader.instances = [];

Reader.modeName = function (mode) {

  return mode == Reader.SERVER ? "Server" : (mode == Reader.CLIENT ? "Client" : "App");
  // + '[' + RiText.renderer._type() + ']';
}

Reader.pauseAll = function (b) {
  if (typeof b === 'undefined') throw Error('Reader.pauseAll() needs an argument');
  for (var i = 0, j = Reader.instances.length; i < j; i++) {
    Reader.instances[i].pause(b);
  }
}

Reader.findById = function (id) {

  for (var i = 0, j = Reader.instances.length; i < j; i++) {
    if (Reader.instances[i].id == id)
      return Reader.instances[i];
  }

  err('no reader with id=' + id);
}

// NOTE: Uses Grid functions: cellAt, neighborhood, coordsFor, gridFor, nextCell

function Reader(g, cx, cy, speed) { // constructor

  if (!g) error("No grid for Reader() ...");

  this.id = 1 + Reader.instances.length;
  this.steps = 0;
  this.history = [];
  this.socket = null;
  this.hidden = false;
  this.paused = false;
  this.type = 'Reader';
  this.neighborhood = [];
  this.showNeighbors = true;
  this.waitForNetwork = false;
  this.speed = speed || SPEED.Slow;
  this.pman = PageManager.getInstance();

  if (cx && !cy && !speed) { // 2-arg version

    this.speed = arguments[1] || 1.5;
    cx = cy = 0;
  }

  this.position(g, cx, cy);

  Reader.instances.push(this);

  var reader = this;
  if (this.pman.mode != Reader.CLIENT) {
    setTimeout(function () {
      reader.step();
    }, 1);
  }
}

Reader.prototype = {

  onEnterCell: function (curr) {

    //console.log(this.type+'.onEnterCell('+curr+')');
    curr.showBounds(false);
    this.fill = curr.fill();
    curr.fill(255, 0, 0, 255);

    if (this.showNeighbors) {
      this.neighborhood = Grid.gridFor(curr).neighborhood(curr);
      this.showBounds(this.neighborhood, true);
    }
  },

  onExitCell: function (curr) {

    if (this.neighborhood) {
      this.showBounds(this.neighborhood, false);
    }

    if (curr) {
      curr.showBounds(false);
      //curr.fill.call(curr, this.fill); // DCH: 2/2/2017
      curr.fill.call(curr, this.fill.r, this.fill.g, this.fill.b, this.fill.a);
    }
  },

  position: function (g, cx, cy) {

    this.current = g.cellAt(cx || 0, cy || 0);
  },

  hide: function (b) {

    this.hidden = b;
    if (this.hidden)
      this.onExitCell(this.current);
  },

  pause: function (b) {

    this.paused = b;
    if (b) this.steps = 0;
  },

  step: function () {

    var grid, msg, pMan = PageManager.getInstance();

    if (!this.paused && !this.hidden) {

      if (this.steps) {

        grid = Grid.gridFor(this.current);
        this.onExitCell(this.current);
        this.current = this.selectNext();

        this.history.push(this.current); // or .text()?
        while (this.history.length > Reader.HISTORY_SIZE) {

          this.history.splice(0, 1);
        }

        // if focused-reader and moving to a new grid, do page-turn
        if (this.hasFocus() && grid != Grid.gridFor(this.current)) {

          // info('\n'+this.type+'.pageTurn()\n');
          pMan.nextPage();
        }
      }

      msg = this.textForServer();

      pMan.notifyServer && (pMan.sendUpdate(this, msg));

      if (!this.hidden && this.hasFocus() && typeof createP === 'function') {
        //console.log(msg);
        logToDisplay(msg.replace(/ /g, "&nbsp;"));
        createP().parent('focusDisplay');
      }

      this.onEnterCell(this.current);

      this.steps++;
    }

    var reader = this; // schedule the next step
    setTimeout(function () {
      reader.step();
    }, reader.speed * 1000);
  },

  hasFocus: function () {

    return this === PageManager.getInstance().focused;
  },

  textForServer: function () {

    var pt = Grid.coordsFor(this.current);
    return this.current.text() + " [#" + pt.grid.id + ": " + pt.x + "," + pt.y + "]";
  },

  /*
     lastRead() = lastRead(1) = last-cell-read
     lastRead(2) = second-to-last-cell-read
     lastRead(3) = third-to-last-cell-read
   */
  lastRead: function (num) {

    num = num || 1;
    var h = this.history;
    return h && h.length ? h[h.length - num] : null;
  },

  selectNext: function () {

    return Grid.nextCell(this.current);
  },

  showBounds: function (rts, b) {
    for (var i = 0; i < rts.length; i++) {
      if (rts[i]) rts[i].showBounds(b);
    }
  },

  dumpHistory: function () {
    var s = '[',
      i;
    for (var i = 0, j = this.history.length; i < j; i++) {
      s += this.history[i].text();
      if (i < j - 1) s += ',';
    };
    console.log(s + "]");
  },

  addToHistory: function (curr) {
    history.push(curr);
  }
};

////////////////////////////// PageManager ////////////////////////////////
//////// singleton: use PageManager.getInstance();
//////////////////////////////////////////////////////////////////////////

var PageManager = function PageManager(host, port) {

  // constructor
  this.socket = null;
  this.perigrams = {};

  // tmp-hack to force mode (TODO: fix me)
  if (host && !port && host == Reader.APP || host == Reader.CLIENT) {

    this.mode = host;
    host = null;
  }

  this.port = port || Reader.PORT;
  this.host = host || 'localhost';

  this.mode = this.mode || Reader.CLIENT;
  if (inNode()) this.mode = Reader.SERVER

  this.notifyServer = this.mode != Reader.APP;

  var msg = "PageManager.mode=" + Reader.modeName(this.mode);
  info(this.notifyServer ? msg += " [http://" + this.host + ":" + this.port + "]" : msg);

  // instance functions

  this.layout = function (txt, x, y, w, h, leading) {

      this.clear();

      if (typeof txt === 'object') {

        this.perigrams[3] = Trigrams[toSafeName(txt.title)];
        console.log('[PMAN] Stored ' + Object.keys(this.perigrams[3]).length + ' 3-grams');
        txt = txt.contents;
      }

      this.x = x;
      this.y = y;
      this.width = w;
      this.height = h;
      this._loadBigrams(txt); // add cache for multiple texts

      var pfont = RiText.defaultFont(),
        PAGE_BREAK = '<pb/>',
        SP = ' ',
        E = '';

      if (!pfont) throw new Error("No font set");

      if (!txt || !txt.length) throw Error("No text!");

      w = w || Number.MAX_VALUE - x, h = h || Number.MAX_VALUE,
        leading = leading || ((pfont.size || RiText.defaults.fontSize) * RiText.defaults.leadingFactor);

      var ascent, descent, leading, startX = x,
        currentX = 0,
        yPos = 0,
        currentY = y,
        rlines = [],
        sb = E,
        maxW = x + w,
        maxH = y + h,
        words = [],
        next, dbug = 0,
        paraBreak = false,
        pageBreak = false,
        lineBreak = false,
        firstLine = true;

      var ascent = pfont._textAscent(RiText.defaults.fontSize),
        descent = pfont._textDescent(RiText.defaults.fontSize);

      // remove line breaks & add spaces around html
      txt = txt.replace(/&gt;/g, '>').replace(/&lt;/g, '<');
      txt = txt.replace(/ ?(<[^>]+>) ?/g, " $1 ").replace(/[\r\n]/g, SP);

      // split into reversed array of words
      RiText._addToStack(txt, words);

      if (RiText.defaults.indentFirstParagraph)
        startX += RiText.defaults.paragraphIndent;

      while (words.length > 0) {
        next = words.pop();

        if (!next.length) continue;

        // check for HTML-style tags
        if (/<[^>]+>/.test(next)) {

          //info("html:"+next);
          if (next == RiText.NON_BREAKING_SPACE)
            sb += SP;

          else if (next == RiText.PARAGRAPH_BREAK)
            paraBreak = true;

          else if (next == RiText.LINE_BREAK)
            lineBreak = true;

          else if (next == PAGE_BREAK)
            pageBreak = true;

          continue;
        }

        // re-calculate our X position
        currentX = startX + pfont._textWidth(sb + next, RiText.defaults.fontSize);

        //info(g._type()+" -> "+g._textWidth(pfont, sb + next)+" for "+(sb+next));

        // check it against the line-width
        if (!paraBreak && !lineBreak && !pageBreak && currentX < maxW) {

          sb += next + SP; // add-word

        } else {

          // check yPosition for line break

          if (!pageBreak && RiText._withinBoundsY(currentY, leading, maxH, descent)) {

            yPos = firstLine ? currentY : currentY + leading;
            rt = RiText._newRiTextLine(sb, pfont, startX, yPos);
            if (dbug) info("add1: " + rt + " currentY=" + currentY + " yPos=" + yPos);
            rlines.push(rt);

            currentY = paraBreak ? rt.y + RiText.defaults.paragraphLeading : rt.y;
            startX = x;

            // reset
            if (paraBreak) startX += RiText.defaults.paragraphIndent;

            sb = next + SP;

            // reset with next word
            paraBreak = lineBreak = firstLine = false;

          } else {

            if (pageBreak) {

              pageBreak = false;
              rt = RiText._newRiTextLine(sb, pfont, startX, yPos + leading);
              if (dbug) info("add2: " + rt + " currentY=" + currentY + " yPos=" + yPos);
              rlines.push(rt);
              sb = E;
            }
            words.push(next);

            // create a new grid from existing lines
            if (dbug) info("------ new grid(a) -------");
            this._createGrid(rlines);
            firstLine = true;

            // reset everything for next grid
            currentX = startX;
            currentY = y;
            yPos = 0;
            rlines = [];
          }
        }
      }

      // check if leftover words can make a new line
      if (RiText._withinBoundsY(currentY, leading, maxH, descent)) {

        rlines.push(rt = RiText._newRiTextLine(sb, pfont, x, leading + currentY));

        if (dbug) info("add3: " + rt);
        sb = E;

      } else if (words.length) { // IF ADDED: (DCH) 12.4.13

        rlines.push(rt = RiText._newRiTextLine(words.join(SP).trim(), pfont, x, leading));

        if (dbug) info("add4: " + rt);
      }

      // create the last grid with the leftovers
      if (rlines.length) this._createGrid(rlines);

      if (Grid.instances.length < 1)
        throw Error("No enough text for multi-page layout");

      this.verso = Grid.instances[0];
      this.recto = Grid.instances[1];

      //Grid.dumpPages(); // print the layout to console(s)

      return this;
    },

    this.clear = function () {
      while (Grid.instances.length) {
        Grid.instances.pop().dispose();
      }
    },

    this.storePerigrams = function (n, obj) {

      if (this.mode == Reader.CLIENT) return; // dumb-client, no need for data

      if (this.perigrams[n])
        throw Error('Attempt at storing >1 sets of ' + n + '-grams');

      console.log('[PMAN] Stored ' + Object.keys(obj).length + ' ' + n + '-grams');

      this.perigrams[n] = obj;
    },

    this.isTrigram = function (rts, threshold) {

      var key = rts,
        count, words = [],
        S = ' ',
        trigrams = this.perigrams[3];

      if (!trigrams) throw Error("No 3-grams loaded!");

      if (is(rts, 'array')) {

        if (!(rts && rts.length == 3)) throw Error("fail: rts=" + rts);

        key = RiTa.stripPunctuation((rts[0].text() + S +
          rts[1].text() + S + rts[2].text()).toLowerCase());
      }

      threshold = threshold || 0;
      count = trigrams[key] || 0;
      //info(key+' -> '+count);

      return count > threshold;
    },

    // this seems only to work in the browser for smaller files
    // better to include the file as a regular JS-object
    this.loadTrigrams = function (pfile, callback) {

      if (this.mode == Reader.CLIENT) return; // dumb-client, no need for data

      var pMan = this,
        bn = '\n',
        msg = 'Load/hash trigrams';

      console.time(msg);

      RiTa.loadString(pfile, function (txt) {

        var rows = txt.split(bn);

        this.trigrams = {}, num = 0;
        for (var i = 0, j = rows.length; i < j; i++) {

          if (!(rows[i] && rows[i].length && /^[a-z]/.test(rows[i]))) {
            info('Skipping trigram line: "' + rows[i] + '"');
            continue;
          }

          var words = rows[i].split(/ +(\d+)/);

          if (!(words.length && words[0].length && words[1].length))
            throw Error("Bad trigram: '" + rows[i] + "'");

          this.perigrams[3][words[0]] = Number(words[1]);
          num++
        }

        console.log("[PMAN] Loaded " + num + " trigrams");
        console.timeEnd(msg);

        callback.call(this, pMan.perigrams);

      }, bn);
    },

    this.footers = function () {
      var result = [];
      for (var i = 0, j = Grid.instances.length; i < j; i++)
        result.push(Grid.instances[i].footer);
      return result;
    },

    this.headers = function () {
      var result = [];
      for (var i = 0, j = Grid.instances.length; i < j; i++)
        result.push(Grid.instances[i].header);
      return result;
    },

    this.nextPage = function () {

      var next = this.recto.getNext();
      this.verso = this.recto;
      this.recto = next;
      return this;
    },

    this.lastPage = function () {

      var back = this.verso.getPrevious();
      this.recto = this.verso;
      this.verso = back;
      return this;
    },

    this.focus = function (reader) {

      if (arguments.length) {
        this.focused = reader;
        //console.log("Focus:"+this.focused.type);
        return this;
      }
      return this.focused;
    },

    this.draw = function () {

      this.verso && (this.verso.draw(0));
      this.recto && (this.recto.draw(1));

      return this;
    },

    this._createGrid = function (lines) {

      new Grid(this._toCells(lines), this.x, this.y, this.width, this.height);
      RiText.dispose(lines);
    },

    this._toCells = function (rt) {

      var cells = [];
      for (var y = 0; y < rt.length; y++)
        cells.push(rt[y].splitWords());
      return cells;
    },

    this._loadBigrams = function (txt) {

      if (this.mode == Reader.CLIENT) return; // dumb-client, no need for data

      var num = 0,
        words = txt.split(/\s+/),
        last = words[0],
        bigrams = {};

      for (var i = 1, j = words.length; i < j; i++) {

        if (!words[i].length || words[i].match(/<pb?\/?>/)) { // <p/> or <pb/>
          continue;
        }
        bigrams[last + ' ' + words[i]] = 0;
        //console.log(last+' '+words[i]);
        last = words[i];
        num++;
      };

      console.log("[PMAN] Stored " + num + " 2-grams");

      return bigrams;
    },

    this.listenForUpdates = function () {

      var grid, lastGrid, reader, lastCell, pman = this;

      if (!this.socket)
        this.socket = io.connect('http://' + this.host + ':' + this.port);

      this.socket.on('message', function (data) {

        grid = Grid.findById(data.grid);
        reader = Reader.findById(data.id);

        if (reader.current) {

          lastCell = reader.current; // tmp-remove

          reader.onExitCell(reader.current);
          lastGrid = Grid.gridFor(reader.current);
        }

        reader.current = grid.cellAt(data.x, data.y);

        // TMP: hack for changing cell text in mesostic
        if (data.type === 'MesosticReader')
          reader.current.text(data.text.replace(/[\s\r\n]+/, ''));

        if (!reader.current) {

          var pt = Grid.coordsFor(lastCell);
          info('left: ' + pt.x + ',' + pt.y + ", '" + lastCell.text() + "'");
          err('no cell for: ' + data.x + ',' + data.y);
        }

        reader.onEnterCell(reader.current);
        reader.steps++;

        if (data.focused) {

          pman.focused = this;
          if (lastGrid != grid) {

            //info("Listener.nextPage()");
            pman.nextPage();
          }
        }
      });
    },

    this.sendUpdate = function (reader, text) {

      if (Reader.WAIT_FOR_NETWORK) return;

      var cf, data;

      if (typeof io == 'undefined') {
        warn('no io!');
        this.warnAndWait(reader);
        return;
      }

      if (!this.socket)
        this.socket = io.connect('http://' + this.host + ':' + this.port);

      if (!this.socket) {
        warn('no socket!');
        this.warnAndWait(reader);
        return;
      }

      cf = Grid.coordsFor(reader.current);

      data = {
        x: cf.x,
        y: cf.y,
        text: text,
        id: reader.id,
        type: reader.type,
        grid: cf.grid.id,
        focused: this.focused === reader
      };
      //info(this.type+': '+JSON.stringify(data));

      this.socket.emit("reader-update", data);
      // this.socket.emit(this.type, data); // better
    },

    this.warnAndWait = function (reader, ms) {

      if (!reader) err('no reader!');

      ms = ms || Reader.NETWORK_PAUSE;

      Reader.WAIT_FOR_NETWORK = true;

      var msg = reader.type + '.socket: failed, waiting for ' + ms + "ms\n";
      warn(msg);

      setTimeout(function () {
        Reader.WAIT_FOR_NETWORK = false;
      }, ms);
    }

  if (this.mode === Reader.CLIENT) this.listenForUpdates();
}

PageManager.instance = null;

PageManager.getInstance = function (a, b, c) {
  if (this.instance === null)
    this.instance = new PageManager(a, b, c);
  return this.instance;
}

///////////////// GLOBALS (no node) ///////////////////

function toSafeName(name) {
  return name.replace(/ /g, '_');
}

function fromSafeName(name) {
  return name.replace(/_/g, ' ');
}

/////////////////// EXPORTS /////////////////////

if (typeof module != 'undefined' && module.exports) { // for node

  module.exports['PageManager'] = PageManager;
  module.exports['Reader'] = Reader;
  module.exports['Grid'] = Grid;
}
