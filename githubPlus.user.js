// ==UserScript==
// @name         GitHub PullRequests Plus
// @namespace    http://tampermonkey.net/
// @version      0.3.0
// @updateURL
// @description  Displays a bunch of usefull information next to the github pullrequests such as diff stats and latest comments
// @author       Hamid Zare @hamidzr
// @require      https://cdnjs.cloudflare.com/ajax/libs/axios/0.16.2/axios.min.js
// @match        https://github.com/*/*
// @run-at document-idle
// ==/UserScript==

let parser = new DOMParser();
let prevLocation;
const PAGECHECKDELAY = 1000;

//check to see if we recently arrived on pullrequests page. (due to ajax loading)
setInterval(() => {
  if (prevLocation !== location.href && location.href.endsWith('/pulls')) {
    console.log('we are on the pulls page');
    setupPrPage();
  }
  prevLocation = location.href;
}, PAGECHECKDELAY);

// setup pull request page
function setupPrPage() {
  // add preview wrapper element to dom
  const sideSpace = (document.body.clientWidth - document.querySelector('div.issues-listing').offsetWidth ) / 2;
  const previewWrapper = parser.parseFromString(`<div id="previewWrapper" style="position:fixed;left: 10px; top: 15rem; width: ${sideSpace-20}px;"></div>`, 'text/html').body.firstChild;
  document.body.append(previewWrapper);

  console.log('getting diffstats and previews');
  document.querySelectorAll('ul.js-navigation-container .js-navigation-open').forEach(a => {
    axios.get(a.href).then( resp => {
      const pullDoc = parser.parseFromString(resp.data, 'text/html');
      const diffStat = pullDoc.getElementById('diffstat');
      a.append(diffStat);
      /** disable last comment view
                let nodes = pullDoc.querySelector('.js-discussion').childNodes;
                nodes = toArray(nodes).filter(node => node.nodeType === 1);
                let el = nodes[nodes.length -2];
                toggleVisibility(el);
                previewWrapper.append(el);
                let parentLi = a.parentNode.parentNode.parentNode;
                parentLi.addEventListener('mouseenter', e => {
                    toggleVisibility(el);
                });
                parentLi.addEventListener('mouseleave', e => {
                    toggleVisibility(el);
                });
                */
    }).catch(console.error);

  });
};


function toggleVisibility(element) {
  if (element.style.display === 'none') {
    element.style.display = 'block';
  } else {
    element.style.display = 'none';
  }
}

// nodesObj to array
function toArray(obj) {
  var array = [];
  // iterate backwards ensuring that length is an UInt32
  for (var i = obj.length >>> 0; i--;) {
    array[i] = obj[i];
  }
  return array;
}
