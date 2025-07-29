// ==UserScript==
// @name         Auto-focus & New Chat Shortcut
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Focus editor on window focus (or Ctrl+I) and adds Ctrl+N for new chat, Ctrl+F for search.
// @author       You
// @match        *://gemini.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // selectors for key elements.
    const SELECTORS = {
        EDITOR: 'div.ql-editor[contenteditable="true"]',
        NEW_CHAT_BUTTON: 'button[aria-label="New chat"]',
        SEARCH_ICON: 'mat-icon[fonticon="search"]',
    };

    /**
     * Finds the rich text editor and sets focus to it.
     */
    function setFocusToEditor() {
        const editor = document.querySelector(SELECTORS.EDITOR);
        if (editor) {
            console.log('Editor found, setting focus.');
            editor.focus();
        } else {
            console.log('Editor not found on the page.');
        }
    }

    /**
     * Triggers search by clicking the search icon or navigating to search page as fallback.
     */
    function triggerSearch() {
        const searchIcon = document.querySelector(SELECTORS.SEARCH_ICON);
        if (searchIcon) {
            console.log('Search icon found, clicking it.');
            searchIcon.click();
        } else {
            console.log('Search icon not found, navigating to search page as fallback.');
            window.location.href = 'https://gemini.google.com/search';
        }
    }

    /**
     * Handles keydown events for shortcuts.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    function handleShortcuts(event) {
        // new chat shortcut.
        if (event.ctrlKey && event.key === 'n') {
            event.preventDefault();
            console.log('Ctrl+N detected. Clicking new chat button.');
            const newChatButton = document.querySelector(SELECTORS.NEW_CHAT_BUTTON);
            if (newChatButton) {
                newChatButton.click();
            } else {
                console.log('New chat button not found.');
            }
        }

        // search shortcut.
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            console.log('Ctrl+F detected. Triggering search.');
            triggerSearch();
        }

        // focus input shortcut.
        if (event.ctrlKey && event.key === 'i') {
            event.preventDefault();
            console.log('Ctrl+I detected. Focusing editor.');
            setFocusToEditor();
        }
    }

    // --- Event Listeners ---

    // focus the editor when the tab is selected.
    window.addEventListener('focus', setFocusToEditor);

    // handle keyboard shortcuts.
    document.addEventListener('keydown', handleShortcuts);

    // focus the editor once on script load.
    setFocusToEditor();
})();

