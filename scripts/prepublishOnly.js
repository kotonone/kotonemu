import { join } from "node:path";
import { readdir, copyFile } from "node:fs/promises";

for (const file of await readdir("dist")) {
    await copyFile(join("dist", file), file);
}
