import { execFileSync } from "node:child_process";
import process from "node:process";

function runClipboardCommand(command, args, input) {
  execFileSync(command, args, {
    input,
    stdio: ["pipe", "ignore", "ignore"]
  });
}

export function copyToClipboard(text) {
  if (process.platform === "darwin") {
    runClipboardCommand("pbcopy", [], text);
    return;
  }

  if (process.platform === "win32") {
    runClipboardCommand("clip.exe", [], text);
    return;
  }

  try {
    runClipboardCommand("wl-copy", [], text);
    return;
  } catch {
    runClipboardCommand("xclip", ["-selection", "clipboard"], text);
  }
}
