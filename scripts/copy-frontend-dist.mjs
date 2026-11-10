import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(scriptDir, "..", "frontend", "dist");
const dest = path.join(scriptDir, "..", "backend", "public");

if (!fs.existsSync(src)) {
    throw new Error(`Frontend build output not found: ${src}`);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });

console.log(`Copied ${src} -> ${dest}`);