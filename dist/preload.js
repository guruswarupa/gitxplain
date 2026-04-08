/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/main/preload.ts"
/*!*****************************!*\
  !*** ./src/main/preload.ts ***!
  \*****************************/
(__unused_webpack_module, exports, __webpack_require__) {

eval("{\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\nelectron_1.contextBridge.exposeInMainWorld('electron', {\n    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),\n    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),\n    on: (channel, callback) => {\n        electron_1.ipcRenderer.on(channel, (_event, ...args) => callback(...args));\n    },\n    once: (channel, callback) => {\n        electron_1.ipcRenderer.once(channel, (_event, ...args) => callback(...args));\n    },\n    send: (channel, ...args) => {\n        electron_1.ipcRenderer.send(channel, ...args);\n    },\n});\n// Expose Git and Store APIs\nelectron_1.contextBridge.exposeInMainWorld('electronAPI', {\n    // Folder selection\n    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),\n    // Git operations\n    getLog: (path, options) => electron_1.ipcRenderer.invoke('git-log', path, options),\n    getCommitDetails: (path, hash) => electron_1.ipcRenderer.invoke('git-details', { path, hash }),\n    getStatus: (path) => electron_1.ipcRenderer.invoke('git-status', path),\n    commit: (path, message, files) => electron_1.ipcRenderer.invoke('git-commit', { path, message, files }),\n    isRepo: (path) => electron_1.ipcRenderer.invoke('git-is-repo', path),\n    getCurrentBranch: (path) => electron_1.ipcRenderer.invoke('git-current-branch', path),\n    // Store operations\n    storeGet: (key) => electron_1.ipcRenderer.invoke('store-get', key),\n    storeSet: (key, value) => electron_1.ipcRenderer.invoke('store-set', key, value),\n    storeDelete: (key) => electron_1.ipcRenderer.invoke('store-delete', key),\n    // Gitxplain AI operations\n    gitxplainExplain: (repoPath, commitRef, mode) => electron_1.ipcRenderer.invoke('gitxplain-explain', { repoPath, commitRef, mode }),\n    gitxplainSummary: (repoPath, commitRef) => electron_1.ipcRenderer.invoke('gitxplain-summary', { repoPath, commitRef }),\n    gitxplainReview: (repoPath, commitRef) => electron_1.ipcRenderer.invoke('gitxplain-review', { repoPath, commitRef }),\n    gitxplainSecurity: (repoPath, commitRef) => electron_1.ipcRenderer.invoke('gitxplain-security', { repoPath, commitRef }),\n    gitxplainLines: (repoPath, commitRef) => electron_1.ipcRenderer.invoke('gitxplain-lines', { repoPath, commitRef }),\n    gitxplainBranch: (repoPath, baseRef, mode) => electron_1.ipcRenderer.invoke('gitxplain-branch', { repoPath, baseRef, mode }),\n});\n\n\n//# sourceURL=webpack://devinsight/./src/main/preload.ts?\n}");

/***/ },

/***/ "electron"
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
(module) {

module.exports = require("electron");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main/preload.ts");
/******/ 	
/******/ })()
;