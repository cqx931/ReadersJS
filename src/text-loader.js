var TEXTS = [{
  title: 'Misspelt Landings',
  file: 'data/misspeltLandings.txt',
  trigrams: 'data/misspeltLandings-trigrams.js',
  mesostic: 'reaching out falling through circling over landing on turning within spelling as'
}, {
  title: 'Poetic Caption',
  file: 'data/poeticCaption.txt',
  trigrams: 'data/poeticCaption-trigrams.js',
  mesostic: 'reading as writing through'
}, {
  title: 'The Image',
  file: 'data/image.txt',
  trigrams: 'data/theImage-trigrams.js',
  mesostic: 'comes in is over goes out is done lolls in stays there is had no more'
}];

var notify, timerStart = Date.now(),
  textLoaded = [ TEXTS[0].title ];

//tmp
var isFirefox = typeof InstallTrigger !== 'undefined'; 

function loadTexts() {
  //tmp
  if(isFirefox) return;
  
  loadTheFirst();

  var menu = document.getElementById('interface'),
    overlay = document.getElementById('overlay');
  
  var monitor = function(element, callback) {

    var self = element;
    var h = self.clientHeight;
    var w = self.clientWidth;
    var txt = self.innerText;
    var html = self.innerHTML;
    (function flux() {
      setTimeout(function () {
        var done = h === self.clientHeight &&
          w === self.clientWidth &&
          txt === self.innerText &&
          html === self.innerHTML;
        if (done) {
          callback();
        } else {
          h = self.clientHeight;
          w = self.clientWidth;
          txt = self.innerText;
          html = self.innerHTML;
          flux();
        }
      }, 250);
    })()
  };

  monitor(menu, function () {

    // fadeout overlay
    overlay.classList.toggle('fade', setTimeout(function () {
      // overlay.style.display = "none";
      var time = Date.now() - timerStart - 2000; // WHY -2000 ?
      console.log('[LOAD] ' + TEXTS[0].title + ' ' + time + 'ms');
      reloadTheRest();

    }, 2000));
  });
}

function finishLoading(text) {

  textLoaded.push(text);
  var time = Date.now() - timerStart;
  console.log('[LOAD] ' + text + ' ' + time + 'ms');

  if (overlay.classList.value === "" && notify === text) {
    overlay.classList.toggle('fade');
    textChanged();
  }
}

function loadTheFirst() {

    var script = document.createElement("script");

    script.src = TEXTS[0].trigrams;
    script.id = TEXTS[0].title;

    document.getElementsByTagName("html")[0].appendChild(script);

    script.onload = function () {

      var s = document.createElement("script");
      s.src = "src/multi-page.js";
      s.id = "multi-page"

      document.getElementsByTagName("html")[0].appendChild(s);

      s.onload = function() {
        console.log("finishLoading" + s.id);
      };


      // var s2 = document.createElement("script");
      // s2.src = "src/multi-page-ui.js";
      
      // document.getElementsByTagName("html")[0].appendChild(s2);

      // s2.onload = function () {
      //   console.log("finishLoading");
      // };

    };

}

function reloadTheRest() {

  for (var i = 1; i < TEXTS.length; i++) { // skip the first text

    var script = document.createElement("script");

    script.src = TEXTS[i].trigrams;
    script.id = TEXTS[i].title;

    document.getElementsByTagName("html")[0].appendChild(script);
    script.onload = function () {
      finishLoading(this.id);
    };
  }
}

window.onload = loadTexts;
