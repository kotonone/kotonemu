import { Terminal } from "@xterm/xterm";
import { BootOptions } from "packages/kernel/Emulator";
import { File } from "packages/kernel/File";
import fsh from "./executables/fsh";
import cat from "./executables/cat";
import ls from "./executables/ls";
import mkdir from "./executables/mkdir";
import login from "./executables/login";
import init from "./executables/system/init";

/** ShalfeltOS を生成します。 */
export default function ShalfeltOS(terminal: Terminal): { options: BootOptions, storage: File[] } {
    return {
        options: {
            kernel: {
                parameters: {
                    "kernel.hostname": "kotonepc",
                    "kernel.ostype": "ShalfeltOS",
                    "kernel.osrelease": "0.2.0",
                }
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
                        name: ".hidden.txt",
                        type: "regular-file",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        data: new Uint8Array([104, 105, 100, 100, 101, 110])
                    },
                    {
                        name: "ankosoba.txt",
                        type: "regular-file",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        data: new TextEncoder().encode(`ankosoba

ankosoba


ankosoba



ankosoba`)
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
                                name: "sh",
                                type: "symlink",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                target: "/usr/bin/fsh"
                            },
                            login,
                            fsh,
                            cat,
                            ls,
                            mkdir,
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
                            init(terminal)
                        ]
                    }
                ]
            }
        ]
    };
}
