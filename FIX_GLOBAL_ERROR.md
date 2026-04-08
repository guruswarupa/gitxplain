# Quick Fix for "global is not defined" Error

## Install Required Polyfills

Run this command in your terminal:

```bash
pnpm add -D path-browserify crypto-browserify stream-browserify util buffer process
```

Then restart the dev server:

```bash
# Press Ctrl+C to stop the current process
# Then run:
pnpm dev
```

## What This Fixes

The error "global is not defined" happens because webpack is trying to bundle Node.js code for the browser renderer process. The polyfills allow Node.js-style code to work in the Electron renderer.

## After Installing

The app should load successfully and you'll see the Commit Story Desktop interface!
