// focus search with / 
const searchInput = document.getElementById('site-search');
document.addEventListener('keydown', (event) => {
// Ignore if a modifier key is pressed
if (event.altKey || event.ctrlKey || event.metaKey) return;

// Only trigger on "/" key
if (event.key === '/') {
  const target = event.target;

  // Don't hijack when user is already typing in an input, textarea, or editable area
  const isTypingField =
	target.tagName === 'INPUT' ||
	target.tagName === 'TEXTAREA' ||
	target.isContentEditable;

  if (!isTypingField) {
	event.preventDefault(); // stop the "/" character from being typed somewhere
	searchInput.focus();
  }
}
});
// back to top
document.getElementById("tt").innerHTML="<a href=\"#\" onclick=\"totop()\" id=\"totop\" rel=\"nofollow\">Back to Top</a>";
window.onscroll = function () {
if (pageYOffset >= 1000) {
   document.getElementById('totop').style.visibility = "visible";
 } else {
document.getElementById('totop').style.visibility = "hidden";
    }
}
function totop() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}
// recently added links
document.getElementById("ra1").innerHTML = "<a href=\"https://www.computerhope.com/issues/ch002395.htm\">What was it like before computers?</a>";
document.getElementById("ra2").innerHTML = "<a href=\"https://www.computerhope.com/jargon/p/pdf-converter.htm\">What is PDF converter?</a>";
document.getElementById("ra3").innerHTML = "<a href=\"https://www.computerhope.com/jargon/l/line-height.htm\">What is line height?</a>";
document.getElementById("ra4").innerHTML = "<a href=\"https://www.computerhope.com/jargon/i/information-age.htm\">What is the information age?</a>";
document.getElementById("ra5").innerHTML = "<a href=\"https://www.computerhope.com/jargon/b/bit-flip.htm\">What is bit flip?</a>";
