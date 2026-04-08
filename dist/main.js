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

/***/ "./node_modules/.pnpm/electron-is-dev@2.0.0/node_modules/electron-is-dev/index.js"
/*!****************************************************************************************!*\
  !*** ./node_modules/.pnpm/electron-is-dev@2.0.0/node_modules/electron-is-dev/index.js ***!
  \****************************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {

eval("{\nconst electron = __webpack_require__(/*! electron */ \"electron\");\n\nif (typeof electron === 'string') {\n\tthrow new TypeError('Not running in an Electron environment!');\n}\n\nconst isEnvSet = 'ELECTRON_IS_DEV' in process.env;\nconst getFromEnv = Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;\n\nmodule.exports = isEnvSet ? getFromEnv : !electron.app.isPackaged;\n\n\n//# sourceURL=webpack://devinsight/./node_modules/.pnpm/electron-is-dev@2.0.0/node_modules/electron-is-dev/index.js?\n}");

/***/ },

/***/ "./src/main/index.ts"
/*!***************************!*\
  !*** ./src/main/index.ts ***!
  \***************************/
(__unused_webpack_module, exports, __webpack_require__) {

eval("{\nvar __importDefault = (this && this.__importDefault) || function (mod) {\n    return (mod && mod.__esModule) ? mod : { \"default\": mod };\n};\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\nconst path_1 = __importDefault(__webpack_require__(/*! path */ \"path\"));\nconst electron_is_dev_1 = __importDefault(__webpack_require__(/*! electron-is-dev */ \"./node_modules/.pnpm/electron-is-dev@2.0.0/node_modules/electron-is-dev/index.js\"));\nlet mainWindow = null;\nfunction createWindow() {\n    mainWindow = new electron_1.BrowserWindow({\n        width: 1400,\n        height: 900,\n        minWidth: 1200,\n        minHeight: 700,\n        webPreferences: {\n            preload: path_1.default.join(__dirname, 'preload.js'),\n            contextIsolation: true,\n            nodeIntegration: false,\n        },\n    });\n    const startUrl = electron_is_dev_1.default\n        ? 'http://localhost:3000'\n        : `file://${path_1.default.join(__dirname, '../../out/index.html')}`;\n    mainWindow.loadURL(startUrl);\n    if (electron_is_dev_1.default) {\n        mainWindow.webContents.openDevTools();\n    }\n    mainWindow.on('closed', () => {\n        mainWindow = null;\n    });\n}\nelectron_1.app.on('ready', createWindow);\nelectron_1.app.on('window-all-closed', () => {\n    if (process.platform !== 'darwin') {\n        electron_1.app.quit();\n    }\n});\nelectron_1.app.on('activate', () => {\n    if (mainWindow === null) {\n        createWindow();\n    }\n});\n// IPC handlers\nelectron_1.ipcMain.handle('get-app-path', () => {\n    return electron_1.app.getAppPath();\n});\nelectron_1.ipcMain.handle('get-app-version', () => {\n    return electron_1.app.getVersion();\n});\n\n\n//# sourceURL=webpack://devinsight/./src/main/index.ts?\n}");

/***/ },

/***/ "electron"
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
(module) {

module.exports = require("electron");

/***/ },

/***/ "path"
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
(module) {

module.exports = require("path");

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
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main/index.ts");
/******/ 	
/******/ })()
;