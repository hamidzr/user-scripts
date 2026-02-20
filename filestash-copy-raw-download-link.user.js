// ==UserScript==
// @name         Filestash Copy Raw Download Link
// @namespace    https://filestash.apps.latentbyte.com
// @version      1.0.1
// @description  adds a "Copy Raw Link" button next to the trash icon in Filestash file views to copy direct download URLs
// @author       Ari Zare
// @match        https://filestash.apps.latentbyte.com/*
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // extract file path from the modal
  function getFilePathFromModal(linkDetailsDiv) {
    // find the path element in the modal
    const pathDiv = linkDetailsDiv.querySelector(".copy.path.ellipsis");
    if (pathDiv) {
      const relativePath = pathDiv.textContent.trim();
      // remove the leading ./ if present
      const cleanPath = relativePath.replace(/^\.\//, "");

      // get the current directory from URL
      const url = new URL(window.location.href);
      const pathMatch = url.pathname.match(/^\/files\/(.+)$/);
      if (pathMatch) {
        const currentDir = pathMatch[1].replace(/\/$/, "");
        return `/${currentDir}/${cleanPath}`;
      }
    }
    return null;
  }

  // build the raw download URL
  function buildRawDownloadUrl(filePath, includeDownload = true) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/files/cat?path=${encodeURIComponent(filePath)}`;
    return includeDownload ? `${url}&download=1` : url;
  }

  // create the copy button as an img element to match the style
  function createCopyButton(filePath) {
    const img = document.createElement("img");
    img.className = "component_icon";
    img.draggable = false;
    img.alt = "copy raw link";
    img.title = "Copy raw download link";
    img.style.cursor = "pointer";

    // copy icon as base64 SVG
    img.src =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNmY2ZjZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgPHJlY3QgeD0iOSIgeT0iOSIgd2lkdGg9IjEzIiBoZWlnaHQ9IjEzIiByeD0iMiIgcnk9IjIiPjwvcmVjdD4KICA8cGF0aCBkPSJNNSAxNUg0YTIgMiAwIDAgMS0yLTJWNGEyIDIgMCAwIDEgMi0yaDlhMiAyIDAgMCAxIDIgMnYxIj48L3BhdGg+Cjwvc3ZnPgo=";

    img.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rawUrl = buildRawDownloadUrl(filePath);

      // copy to clipboard
      if (typeof GM_setClipboard !== "undefined") {
        GM_setClipboard(rawUrl);
      } else {
        // fallback for browsers that don't support GM_setClipboard
        navigator.clipboard.writeText(rawUrl).catch((err) => {
          console.error("Failed to copy:", err);
        });
      }

      // visual feedback - change to checkmark
      const originalSrc = img.src;
      img.src =
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNENBRjUwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgPHBvbHlsaW5lIHBvaW50cz0iMjAgNiA5IDE3IDQgMTIiPjwvcG9seWxpbmU+Cjwvc3ZnPgo=";

      setTimeout(() => {
        img.src = originalSrc;
      }, 1500);
    });

    return img;
  }

  // find the action buttons container and add our button
  function addCopyButtonToUI() {
    // find all link details containers
    const linkDetailsContainers = document.querySelectorAll(".link-details");

    linkDetailsContainers.forEach((container) => {
      // check if we already added the button
      if (container.querySelector('img[alt="copy raw link"]')) {
        return;
      }

      // find the icons container
      const iconsContainer = container.querySelector(".link-details--icons");
      if (!iconsContainer) {
        return;
      }

      // get the file path from this specific link detail
      const filePath = getFilePathFromModal(container);
      if (!filePath) {
        return;
      }

      // create and insert the copy button before the edit icon
      const copyButton = createCopyButton(filePath);
      const editIcon = iconsContainer.querySelector('img[alt="edit"]');
      if (editIcon) {
        iconsContainer.insertBefore(copyButton, editIcon);
      } else {
        iconsContainer.appendChild(copyButton);
      }
    });
  }

  // watch for DOM changes to handle dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    // check if new modals were added
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        // delay slightly to let Filestash finish rendering
        setTimeout(addCopyButtonToUI, 100);
      }
    });
  });

  // start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // initial setup
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addCopyButtonToUI);
  } else {
    addCopyButtonToUI();
  }

  // also try after a short delay in case content loads slowly
  setTimeout(addCopyButtonToUI, 1000);
})();
