//Interface hide & show
var options = document.getElementById('options');
console.log(options);
options.addEventListener('click', function() {
  document.getElementById("interface").style.display = 'block';
}, false);

var body = document.getElementsByTagName('body')[0];
body.addEventListener('click', function() {
  if (event.pageX > 520 || event.pageY > 524) {
      hideInterface();
  }
}, false);

function hideInterface() {
  document.getElementById("interface").style.display = 'none';
}


$("ul").on("click", ".init", function() {
    $(this).parent().children('li').toggle();
});

var allOptions = $("ul").children('li:not(.init)');

$("ul").on("click", "li:not(.init)", function() {
    allOptions.removeClass('selected');
    $(this).addClass('selected');
    $(this).parent().children('.init').html($(this).html());
    $(this).closest("ul").children('li').toggle();
});