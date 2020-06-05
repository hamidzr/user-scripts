// ==UserScript==
// @name         GitHub PullRequests Plus
// @namespace    http://tampermonkey.net/
// @version      0.3.2
// @updateURL
// @description  Display additional information next to the github pull requests.
// @author       Hamid Zare @hamidzr
// @require      https://cdnjs.cloudflare.com/ajax/libs/axios/0.16.2/axios.min.js
// @match        https://github.com/*/*/pulls/*
// @run-at document-idle
// ==/UserScript==

'use strict';

let parser = new DOMParser();
const PAGECHECKDELAY = 5000;

//check to see if we recently arrived on pullrequests page. (due to ajax loading)
setTimeout(() => {
  setupPrPage();
}, PAGECHECKDELAY);

const selectors = {
  prATags: 'div.js-issue-row a[href*="/pull/"].js-navigation-open',
};

// setup pull request page
function setupPrPage() {
  // add preview wrapper element to dom
  // const sideSpace = (document.body.clientWidth - document.querySelector('div.issues-listing').offsetWidth ) / 2;
  // const previewWrapper = parser.parseFromString(`<div id="previewWrapper" style="position:fixed;left: 10px; top: 15rem; width: ${sideSpace-20}px;"></div>`, 'text/html').body.firstChild;
  // document.body.append(previewWrapper);

  document.querySelectorAll(selectors.prATags).forEach(a => {
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
