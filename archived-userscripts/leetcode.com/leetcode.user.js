// ==UserScript==
// @name         LeetCode Helper
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Download a leetcode problem to run locally
// @match        https://leetcode.com/problems/*
// @run-at context-menu
// ==/UserScript==

// 'use strict';

// global hmd

const cleanTag = (text) => {
  return text
    .replace(/[^a-zA-Z0-9_ |]/g, '')
    .replace(/\n/g, '')
    .replace(/ +/g, ' ');
};

const title = document.querySelector('div[data-cy="question-title"]').innerText;

// turn the title into a file name.
// replace spaces with underscores, and remove all non-alphanumeric characters
const fileName = title
  .replace(/ /g, '_')
  .replace(/[^a-zA-Z0-9_]/g, '')
  .toLowerCase();
const fileType = '.py';

// get page url
const url = window.location.href;
const question = document.querySelector('.question-content__JfgR');

const topicTags = hmd.findAll('a[href^="/tag/"]').map((e) => e.innerText);
const companyTags = hmd
  .findAll('a[href^="/company/"]')
  .map((e) => e.innerText)
  .map(cleanTag);

const statsBar = document.querySelector('.css-10o4wqw').innerText;

const doc = `
# ${title}

page url: ${url}

## Question Content
${question.innerText}

## Stats

Stats: ${statsBar}

Topic:
${topicTags.join(', ')}

Company:
${companyTags.join(', ')}

`;

const getCode = () => {
  const cleanCode = (code) => {
    const toRemove = ['​', ' '];
    return code.replace(new RegExp(toRemove.join('|'), 'g'), '').replace(/^ +$/, '');
  };

  const code = hmd
    .findAll('div.CodeMirror-code .CodeMirror-line')
    .map((e) => e.innerText)
    .map(cleanCode)
    .join('\n');

  const prefix = `#!/usr/bin/env python3

## emulate lc environment
import math
import heapq
import functools
import collections
import typing
import bisect
from typing import *
from collections import *
from functools import *
`;

  const suffix = `# if __name__ == "__main__":
#   s = Solution()
#   args: List = [[4,10,4,3,8,9]]
#   print("in", *args)
#   print("#########")
#   o = s.lengthOfLIS(*args)
#   print("#########")
#   print("out", o)


`;
  return [prefix, code, suffix].join('\n');
};

window.hmd = hmd || {};
window.hmd.lc = {
  dl: () => {
    hmd.download(fileName + fileType, getCode());
    hmd.download(fileName + '.question.md', doc);
  },
  downloadCode: () => {
    hmd.download(fileName + fileType, codeLine.join('\n'));
  },
  downloadDoc: () => {
    hmd.download(fileName + '.question.md', doc);
  },
  copyCode: () => hmd.writeClipboard(getCode()),
};

hmd.lc.copyCode().then(() => {
  window.alert('Code copied to clipboard');
});
