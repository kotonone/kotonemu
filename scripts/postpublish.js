import { readdir, rm } from "node:fs/promises";

for (const file of await readdir(".")) {
    if (["js", "cjs", "ts", "cts"].some(ext => file.endsWith("." + ext)) && file !== "vite.config.ts")
        await rm(file);
}
