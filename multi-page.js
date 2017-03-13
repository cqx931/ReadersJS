var TEXTS = ["data/image.txt", "data/poeticCaption.txt", "data/misspeltLandings.txt"],
    READER_NAMES = ["Mesostic Reader", "Perigram Reader", "Less Directed Perigram Reader", "Simple Spawning Reader", "Perigram Spawning Reader", "Less Directed Spawning Reader"],
    TEXT_NAMES = [ "THE IMAGE", "POETIC CAPTION", "MISSPELT LANDINGS"],
    TEXT_STYLES = [ "Faint", "Grey", "Dark"],
    COLOR_THEMES = ["Dark", "Light"],
    SPEED_MODES = ["Fluent", "Steady", "Slow", "Slower", "Slowest", "Fast"];

var pManager, rdr, font;
var texts= {}, activeReaders = [];
var mr,pr,ldpr,ssr,psr,ldsr;

var bgColor = 0, gridFillInt = 255, gridAlpha = 40;

function preload() {

  bg = loadImage('data/page.png');
  font = loadFont('fonts/Baskerville.ttf');
}

function setup() {

  createCanvas(1280, 720);

  RiText.defaultFill(gridFillInt,gridAlpha);
  RiText.defaultFont(font, 24);
  RiText.defaults.paragraphIndent = 20;

  //Load other two text as well
  loadTexts();

  RiTa.loadString('data/image.txt', function (txt) {

    // do the layout
    pManager = PageManager.getInstance(Reader.APP);
    pManager.storePerigrams(3, trigrams);
    pManager.layout(txt, 25, 40, 580, 650); // grid-rect

    // add some readers

    rdr = new Reader(pManager.recto, 1, 8, .4);
    pr = new PerigramReader(pManager.recto);
    mr = new MesosticReader(pManager.verso, 1.1);
    
    activeReaders.push(pr);
    activeReaders.push(mr);

    // set page-turner/logger
    pManager.focus(mr);

    //Interface
    
    // 6 Readers
    // checkbox + select
    var readersOptions = {};
    console.log(activeReaders);

    for( var i = 0; i < READER_NAMES.length; i++ ) {
      
      var idName = READER_NAMES[i].replace(/ /g, "");
      var status = isReaderActive(READER_NAMES[i]);
      console.log(idName, status);

      rb = createCheckbox(READER_NAMES[i], status);
      rb.changed(readerOnOffEvent);
      rb.id(idName);
      select = initializeSelect("speedSelect", SPEED_MODES, speedChanged);

      readersOptions[READER_NAMES[i]] = {
        active : status,
        radioButton : rb,
        speedSelect : select
      }
      
      select.parent(rb);
      rb.class("reader");
      rb.parent('interface');
     
    }


    focusSelect = initializeSelect("focusSelect", getActiveReadersName(), focusChanged);
    textSelect = initializeSelect("textSelect", TEXT_NAMES, textChanged);
    styleSelect = initializeSelect("styleSelect", TEXT_STYLES, styleChanged);
    themeSelect = initializeSelect("themeSelect", COLOR_THEMES, themeChanged);


    styleSelect.addClass("half");
    themeSelect.addClass("half");
     
    // button = createButton('go');
    // button.mousePressed(selectionDone);
    // button.id('go');
    
    //Append all elements to interface
    var interfaceElements = [focusSelect, textSelect, styleSelect, themeSelect];
    var discriptText = ["Focus","Text", "Style", "Theme"];
    for ( var i = 0; i < interfaceElements.length; i++ ) {
      // if (i != interfaceElements.length -1) {
        wrapper = createDiv("");
        wrapper.addClass("item");
        wrapper.parent('interface');
        discription = createP(discriptText[i]);
        discription.parent(wrapper);
        interfaceElements[i].parent(wrapper);

      // } else 
      //   interfaceElements[i].parent('interface');
    }

    //set Initial Value of focus
    console.log("FOCUS:",pManager.focus().type);

    $('#focusSelect').val(getReadersNameFromId(pManager.focus().type));
    // document.getElementById('focusSelect');

  });
}


function draw() {

  background(bgColor);
	pManager && (pManager.draw());

}

function keyPressed() {

	keyCode == 39 && (pManager.nextPage());
	keyCode == 37 && (pManager.lastPage());
}

function loadTexts() {

    TEXTS.forEach(function(text, index) {
        RiTa.loadString(text, function(txt) {
           var key = TEXT_NAMES[index].replace(" ", "");
           texts[key] = txt;
        });
    });

}

function isReaderActive(name) {
  for(var i = 0; i < activeReaders.length; i++) {
     var withoutSpace = name.replace(/ /g, "");
     if( withoutSpace === activeReaders[i].type ) return true;
  }
  return false;
}

function getActiveReadersName() {
  var list = [];
  for(var i = 0; i < activeReaders.length; i++) {
    var name = activeReaders[i].type;
    name = name.replace(/([A-Z])/g, ' $1').trim();
    list.push(name);
  }
  return list;
}

function getReadersNameFromId(name) {
  for (var i = 0; i < READER_NAMES.length; i++) {
    var withoutSpace = READER_NAMES[i].replace(/ /g, "");
    if( withoutSpace === name) return READER_NAMES[i];
  }
}

function getReadersFromName(name) {
  switch (name) {
    case "Mesostic Reader":
        return mr;
    case "Perigram Reader":
        return pr;
    case "Less Directed Perigram Reader":
        return ldpr;
    case "Simple Spawner Reader":
        return ssr;
    case "Perigram Spawner Reader":
        return psr;
    case "Less Directed Spawner Reader":
        return ldsr;
  }
}

function setFillInt(fillInt) {
  gridFillInt = fillInt;
  Grid.defaultColor(gridFillInt, gridFillInt, gridFillInt, gridAlpha);
}

function setAlpha(alpha) {
   gridAlpha = alpha;
   RiText.defaultFill(gridFillInt,gridAlpha);
   Grid.defaultColor(gridFillInt, gridFillInt, gridFillInt, gridAlpha);
}
/***************** INTERFACE ***********************/

function initializeSelect(id, options, event) {
    //replace with ul li
    var sel = createSelect();

    for (var i = 0; i < options.length; i++)
        sel.option(options[i]);

    sel.changed(event);
    sel.id(id);

    return sel;

}

function focusChanged() {
   console.log("CHANGE FOCUS TO:" + focusSelect.value());
    var focus = getReadersFromName(focusSelect.value());
    pManager.focus(focus);
    //clear focusDisplay
    document.getElementById('focusDisplay').innerHTML= "";
}

function textChanged() {
  
    var textName = textSelect.value().replace(" ", "");
    console.log("CHANGE TEXT TO:" + textName);
    // pManager.sendUpdate(activeReaders,texts[textName]);
}

function styleChanged() {
  
    var style = styleSelect.value();
  
    var alpha;
    switch (style) {
        case "Faint":
           alpha = 40;
           break;
        case "Grey":
           alpha = 70;
           break;
        case "Dark":
           alpha = 0;
           break;
    }
    console.log(style, alpha);
    setAlpha(alpha);
    //TODO: change text alpha - Grid?
}

function themeChanged() {

   var theme = themeSelect.value();
   var body = document.getElementsByTagName('body')[0];

   if (theme === "Dark") {
       bgColor = 0;
       body.className = "dark";
       //TODO: change default font color to white

   } else {
       bgColor = 232;
       body.className = "light";
      //TODO: change default font color to black
   }

}

function readerOnOffEvent() {
    console.log(this.parent().id, this.checked());
    //TODO: remove/add to activeReaders
}

function speedChanged() {
   console.log(this.parent().id);
   //TODO: change the speed of corresponding reader
}

function selectionDone(){
  hideInterface();
}