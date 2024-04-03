import { Terminal } from "@xterm/xterm";
import { EmulatorInit } from "@/core/Emulator";
import { EISDIR, ELIBBAD, ENOENT } from "@/core/Error";
import { StdReadFlag } from "@/core/Flags";
import { StatMode } from "@/core/Process";
import { basename, join, split } from "@/core/Utils";
import { Directory } from "@/core/File";

/** ShalfeltOS を生成します。 */
export default function ShalfeltOS(terminal: Terminal): { options: EmulatorInit, storage: Directory["children"] } {
    return {
        options: {
            info: {
                nodename: "kotonepc",
                os_name: "ShalfeltOS",
                os_version: "0.1.0"
            }
        },
        storage: [
            {
                name: "dev",
                type: "directory",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                children: [
                    {
                        name: "tty1",
                        type: "device",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,

                        read() {
                            return new Promise(r => terminal.onData(data => r(new TextEncoder().encode(data))));
                        },
                        write(data) {
                            const str = new TextDecoder("utf-8").decode(data)
                                .replaceAll("\u007F", "\b \b");

                            if (str.includes("\x07")) {
                                console.log("Ring!");
                            }

                            // TODO: 2バイト文字の削除対応
                            terminal.write(str);
                        }
                    },
                    {
                        name: "tty2",
                        type: "device",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,

                        read() {
                            return new Promise(r => process.stdin.once("data", data => r(new Uint8Array(data))));
                        },
                        write(data) {
                            process.stdout.write(new Uint8Array(data));
                        }
                    }
                ]
            },
            {
                name: "mnt",
                type: "directory",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                children: []
            },
            {
                name: "root",
                type: "directory",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                children: [
                    {
                        name: "hello.txt",
                        type: "regular-file",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        data: new Uint8Array([97, 98, 99, 100, 101, 102, 103])
                    },
                    {
                        name: "hello",
                        type: "executable-file",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        protected: true,

                        async onStart() {
                            // console.log(emu.processes);
                            console.log("Hello Kotonemu World!");

                            await new Promise(r => setTimeout(r, 5000));
                        }
                    },
                    {
                        name: "filelink",
                        type: "symlink",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        target: "/hello.txt"
                    },
                    {
                        name: "ttylink",
                        type: "symlink",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        target: "/dev/tty1"
                    }
                ]
            },
            {
                name: "home",
                type: "directory",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                children: []
            },
            {
                name: "bin",
                type: "symlink",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                target: "/usr/bin"
            },
            {
                name: "sbin",
                type: "symlink",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                target: "/usr/sbin"
            },
            {
                name: "usr",
                type: "directory",
                owner: 0,
                group: 0,
                mode: 0o777,
                deleted: false,
                children: [
                    {
                        name: "bin",
                        type: "directory",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        children: [
                            {
                                name: "login",
                                type: "executable-file",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                protected: true,

                                async onStart(lib) {
                                    const info = this.uname();

                                    lib.io.write(`${info.nodename} login: `);
                                    const userId = (await lib.io.read()).trimEnd();

                                    lib.io.write("Password: ");
                                    const password = (await lib.io.read(0, StdReadFlag.READ_LINE)).trimEnd();

                                    if (userId === "a" && password === "b") {
                                        lib.io.write("Last login: Wed Dec  9 04:09:57 on tty1\n");

                                        this.spawn(async function () {
                                            await this.exec("/bin/sh");
                                        });
                                    } else {
                                        await new Promise(r => setTimeout(r, 5000));
                                        lib.io.write("Login incorrect\n\n");

                                        // TODO: current process path
                                        await this.exec("/bin/login");
                                    }
                                }
                            },

                            {
                                name: "sh",
                                type: "symlink",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                target: "/usr/bin/fsh"
                            },
                            {
                                name: "fsh",
                                type: "executable-file",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                protected: true,

                                async onStart(lib) {
                                    const info = this.uname();

                                    while (true) {
                                        lib.io.write(`[kotone@${info.nodename} ${this.env.PWD === "/" ? this.env.PWD : basename(this.env.PWD)}]$ `);

                                        const text = (await lib.io.read()).trimEnd();
                                        if (text.trim() === "") continue;

                                        const command = split(text).filter(a => a !== "");
                                        if (command.length < 1) continue;

                                        // TODO: user directory "~"
                                        // TODO: cd.sh: builtin cd "$@"
                                        if (command[0] === "cd") {
                                            if (command.length === 1) {
                                                this.env.PWD = lib.path.absolute("~");
                                            } else if (command.length === 2) {
                                                try {
                                                    const stat = this.stat(command[1]);
                                                    if ((stat.mode & StatMode.IFDIR) == 16384) {
                                                        this.env.PWD = lib.path.absolute(command[1]);
                                                    } else {
                                                        lib.io.write(`-fsh: ${command[0]}: ${command[1]}: ディレクトリではありません\n`, 2);
                                                    }
                                                } catch {
                                                    lib.io.write(`-fsh: ${command[0]}: ${command[1]}: そのようなファイルやディレクトリはありません\n`, 2);
                                                }
                                            } else {
                                                lib.io.write(`-fsh: ${command[0]}: 引数が多すぎます\n`, 2);
                                            }
                                        } else {
                                            let binaryFile: string | null = null;
                                            for (const path of (this.env.PATH ?? "").split(":")) {
                                                try {
                                                    this.stat(binaryFile = join(path, command[0]));
                                                    break;
                                                } catch (e) {
                                                    if (e instanceof ENOENT) {
                                                        binaryFile = null;
                                                    } else {
                                                        throw e;
                                                    }
                                                }
                                            }

                                            await this.spawn(async function () {
                                                try {
                                                    if (!binaryFile) throw new ENOENT(command[0]);

                                                    const stat = this.stat(binaryFile);
                                                    if (stat.mode & StatMode.IFDIR) throw new EISDIR(command[0]);

                                                    await this.exec(binaryFile, command.slice(1));
                                                } catch (e) {
                                                    if (e instanceof ENOENT) {
                                                        lib.io.write(`-fsh: ${command[0]}: コマンドが見つかりません\n`, 2);
                                                    } else if (e instanceof ELIBBAD) {
                                                        lib.io.write(`-fsh: ${command[0]}: 実行形式エラー\n`, 2);
                                                    } else if (e instanceof EISDIR) {
                                                        lib.io.write(`-fsh: ${command[0]}: ディレクトリです\n`, 2);
                                                    } else {
                                                        throw e;
                                                    }
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    {
                        name: "sbin",
                        type: "directory",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        children: [
                            {
                                name: "init",
                                type: "executable-file",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                protected: true,

                                async onStart(lib) {
                                    const info = this.uname();
                                    lib.io.write(`\n${info.os_name} ${info.os_version}\n`);
                                    lib.io.write("Copyright (C) 2024 Kotonone and ShalfeltOS contributors\n\n");

                                    // const fd = this.open("filelink", OpenFlag.READ | OpenFlag.WRITE);
                                    // this.seek(fd, 3);
                                    // this.write(fd, new Uint8Array([97, 98, 99]));
                                    // this.seek(fd, 0);
                                    // console.log(await this.read(fd))
                                    // this.close(fd);

                                    this.spawn(async function() {
                                        await this.exec("/bin/login", [], {
                                            PWD: "/",
                                            PATH: "/bin:/sbin"
                                        });
                                    });

                                    // this.write(1, Buffer.from("===== Process Tree =====\n"));
                                    // const processFlatFunc = (p: Process): string[] => [`${p.name} (${p.id}) [${p.tty}]`, ...p.children.flatMap(processFlatFunc).map(l => "    " + l)];
                                    // this.write(1, Buffer.from([emu.rootProcess].flatMap(processFlatFunc).join("\n") + "\n"));

                                    // this.write(1, Buffer.from("===== Storage Tree =====\n"));
                                    // const storageFlatFunc = (f: File): string[] => [`${f.name}`, ...(isDirectory(f) ? f.children.flatMap(storageFlatFunc).map(l => "    " + l) : [])];
                                    // this.write(1, Buffer.from([emu.storage].flatMap(storageFlatFunc).join("\n") + "\n"));

                                    // const ttyFd = emu.open("/dev/tty1", OpenFlag.READ | OpenFlag.WRITE);
                                    // while (true) {
                                    //     const buf = await emu.read(ttyFd);
                                    //     emu.write(ttyFd, buf);
                                    // }

                                    // const ttyLinkFd = emu.open("/ttylink", OpenFlag.READ | OpenFlag.WRITE);
                                    // while (true) {
                                    //     const buf = await emu.read(ttyLinkFd);
                                    //     emu.write(ttyLinkFd, buf);
                                    // }
                                }
                            }
                        ]
                    }
                ]
            }
        ]
    };
}
