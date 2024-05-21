import { Terminal } from "@xterm/xterm";
import { generateApplicationFile } from "../../Utils";

export default (terminal: Terminal) => generateApplicationFile("init", async function (lib) {
    try {
        const info = this.uname();
        lib.io.write(`\n${info.os_name} ${info.os_version}\n`);
        lib.io.write("Copyright (C) 2024 Kotonone and ShalfeltOS contributors\n\n");

        await this.spawn(async function () {
            await this.exec("/bin/login", [], {
                PWD: "/",
                PATH: "/bin:/sbin",
                HOME: "/"
            });
        });
    } catch (e) {
        console.error(e);
        terminal.write(`\x1b[2J\x1b[H\x1b[0m\x1b[40m  ${"\x1b[43m  \x1b[40m  ".repeat(10)}\n\n`);
        terminal.write(`\x1b[0m  \x1b[1m\x1b[4m\x1b[33mShalfeltOS Kernel Panic\n\n`);
        terminal.write(`\x1b[0m  ${(e as Error).stack}`);
    }
});
