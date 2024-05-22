import { StdReadFlag } from "packages/kernel/Flags";
import { generateApplicationFile } from "../Utils";

export default generateApplicationFile(async function (lib) {
    const info = this.uname();

    lib.io.write(`${info.nodename} login: `);
    const userId = (await lib.io.read()).trimEnd();

    lib.io.write("Password: ");
    const password = (await lib.io.read(0, StdReadFlag.READ_LINE)).trimEnd();

    if (userId === "a" && password === "b") {
        lib.io.write("Last login: Wed Dec  9 04:09:57 on tty1\n");

        this.env.HOME = "/root";

        await this.spawn(async function () {
            await this.exec("/bin/sh");
        });
    } else {
        await new Promise(r => setTimeout(r, 5000));
        lib.io.write("Login incorrect\n\n");

        // TODO: current process path
        await this.exec("/bin/login");
    }
});
