import { Terminal } from "@xterm/xterm";
import { BootOptions } from "@/kernel/Emulator";
import { File } from "@/kernel/File";
import fsh from "./executables/fsh";
import cat from "./executables/cat";
import ls from "./executables/ls";
import mkdir from "./executables/mkdir";
import login from "./executables/login";
import init from "./executables/system/init";
import { Storage } from "@/kernel/Device";
import { Filesystem, FilesystemBuilder } from "../kernel/Filesystem";

/** ShalfeltOS を生成します。 */
export default function ShalfeltOS(terminal: Terminal): { options: BootOptions, storage: Storage } {
    return {
        options: {
            kernel: {
                parameters: {
                    "kernel.hostname": "kotonepc",
                    "kernel.ostype": "ShalfeltOS",
                    "kernel.osrelease": "0.2.0",
                    "kernel.init": "/sbin/init",
                    "boot.flagentry": "/dev",
                    "fs.specialdir.proc": "/proc",
                    "fs.specialdir.dev": "/dev",
                    "fs.specialdir.tmp": "/tmp",
                    "fs.specialdir.sys": "/sys",
                }
            }
        },
        storage: new Storage([
            new FilesystemBuilder()
                .create("/dev", {
                    name: "dev",
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777
                })
                .create("/dev/tty1", {
                    type: "device",
                    owner: 0,
                    group: 0,
                    mode: 0o777,

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
                })
                .create("/dev/tty2", {
                    type: "device",
                    owner: 0,
                    group: 0,
                    mode: 0o777,

                    read() {
                        return new Promise(r => process.stdin.once("data", data => r(new Uint8Array(data))));
                    },
                    write(data) {
                        process.stdout.write(new Uint8Array(data));
                    }
                })
                .create("/mnt", {
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                })
                .create("/root", {
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                })
                .create("/root/hello.txt", {
                    type: "regular-file",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    data: new Uint8Array([97, 98, 99, 100, 101, 102, 103])
                })
                .create("/root/.hidden.txt", {
                    type: "regular-file",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    data: new Uint8Array([104, 105, 100, 100, 101, 110])
                })
                .create("/root/ankosoba.txt", {
                    type: "regular-file",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    data: new TextEncoder().encode(`ankosoba

ankosoba


ankosoba



ankosoba`)
                })
                .create("/root/hello", {
                    type: "executable-file",
                    owner: 0,
                    group: 0,
                    mode: 0o777,

                    async onStart() {
                        // console.log(emu.processes);
                        console.log("Hello Kotonemu World!");

                        await new Promise(r => setTimeout(r, 5000));
                    }
                })
                .create("/root/filelink", {
                    type: "symlink",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    target: "/hello.txt"
                })
                .create("/root/ttylink", {
                    type: "symlink",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    target: "/dev/tty1"
                })
                .create("/home", {
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777
                })
                .create("/bin", {
                    type: "symlink",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    target: "/usr/bin"
                })
                .create("/sbin", {
                    type: "symlink",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    target: "/usr/sbin"
                })
                .create("/usr", {
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777
                })
                .create("/usr/bin", {
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                })
                .create("/usr/bin/sh", {
                    type: "symlink",
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    deleted: false,
                    target: "/usr/bin/fsh"
                })
                .create("/usr/bin/login", login)
                .create("/usr/bin/fsh", fsh)
                .create("/usr/bin/cat", cat)
                .create("/usr/bin/ls", ls)
                .create("/usr/bin/mkdir", mkdir)
                .create("/usr/sbin", {
                    type: "directory",
                    owner: 0,
                    group: 0,
                    mode: 0o777
                })
                .create("/usr/sbin/init", init(terminal))
                .filesystem
            ])
    };
}
