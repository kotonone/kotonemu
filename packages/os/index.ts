import { Terminal } from "@xterm/xterm";
import { EmulatorInit } from "@/core/Emulator";
import { EISDIR, ELIBBAD, ENOENT } from "@/core/Error";
import { OpenFlag, StatMode, StdReadFlag } from "@/core/Flags";
import { basename, concatArrayBuffer, join, split, parseOptions } from "@/core/Utils";
import { File } from "@/core/File";

/** ShalfeltOS を生成します。 */
export default function ShalfeltOS(terminal: Terminal): { options: EmulatorInit, storage: File[] } {
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
                        name: "mnt",
                        type: "directory",
                        owner: 0,
                        group: 0,
                        mode: 0o777,
                        deleted: false,
                        children: []
                    },
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
                                name: "root",
                                type: "symlink",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                target: "/root"
                            },
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

                                        await this.spawn(async function () {
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
                                        lib.io.write(`[kotone@${info.nodename} ${basename(this.env.PWD)}]$ `);

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
                                                    if (stat.mode & StatMode.IFDIR) {
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
                                        } else if (command[0] === "pwd") {
                                            if (command.length === 1) {
                                                lib.io.write(this.env.PWD + "\n", 2);
                                            } else if (command.length >= 2) {
                                                let options = parseOptions(command.slice(1),["-P","-L"])

                                                if (options.invalidOption) {
                                                    lib.io.write(`-fsh: ${command[0]}: ${options.invalidOption}: 無効なオプションです\n`, 2);
                                                    lib.io.write(`${command[0]}: 使用法: pwd [-LP]\n`, 2);
                                                }
                                                else {
                                                    if (options.index["-P"] <= options.index["-L"]) {
                                                        lib.io.write(this.env.PWD + "\n", 1);
                                                    } else {
                                                        if (this.env.PWD === "/") {
                                                            lib.io.write("/\n", 1);
                                                        } else {
                                                            const pwdPath = this.env.PWD.split("/");
                                                            let isSymbolic = false;
                                                            for (let i = 0; i < pwdPath.length - 1; i++) {
                                                                isSymbolic = !!(this.lstat(pwdPath.slice(0, -i ? -i : pwdPath.length).join("/")).mode & StatMode.IFLNK);
                                                                if (isSymbolic) {
                                                                    if (i === 0) {
                                                                        lib.io.write(this.readlink(this.env.PWD) + "\n", 1);
                                                                    } else {
                                                                        lib.io.write(this.readlink(pwdPath.slice(0, -i).join("/")) + "/" + pwdPath.slice(-i).join("/") + "\n", 1);
                                                                    }
                                                                    break;
                                                                }
                                                            }
                                                            if (!isSymbolic) {
                                                                lib.io.write(this.env.PWD + "\n", 1);
                                                            }
                                                        }

                                                    }
                                                }
                                            }
                                        } else if (command[0] === "clear") {
                                            if (command.length === 1) {
                                                lib.io.write("\x1b[2J", 1);
                                                lib.io.write("\x1b[H", 1);
                                            } else if (command.length >= 2) {
                                                // TODO: Support for options...?
                                                lib.io.write(`使用例: clear\n`, 2);/*
                                                let options = parseOptions(command.slice(1),["-P","-L"])

                                                if (options.invalidOption) {
                                                    lib.io.write(`-fsh: ${command[0]}: ${options.invalidOption}: 無効なオプションです\n`, 2);
                                                    lib.io.write(`${command[0]}: 使用法: pwd [-LP]\n`, 2);
                                                }
                                                else {
                                                    if (options.index["-P"] <= options.index["-L"]) {
                                                        lib.io.write(this.env.PWD + "\n", 1);
                                                    } else {
                                                        lib.io.write(this.env.PWD + "\n", 1); // TODO: -P option
                                                    }
                                                }*/
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
                            },
                            {
                                name: "cat",
                                type: "executable-file",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                protected: true,

                                async onStart(lib) {
                                    const args = this.args;
                                    let options = parseOptions(
                                        args,
                                        ["-n", "-b", "-s", "-E", "-T", "-v", "-u", "A", "-e", "-t"],
                                        ["--help", "--version", "--number-nonblank", "--show-ends", "--number", "--squeeze-blank", "--show-tabs","--show-nonprinting", "--show-all"]
                                    );

                                    if (options.invalidOption) {
                                        lib.io.write(`cat: 無効なオプション -- ${options.invalidOption}\n`, 2);
                                        lib.io.write(`Try 'cat --help' for more information.\n`, 2);
                                    }
                                    else {
                                        // TODO: Add options
                                        if (options.index["--help"] !== -1) {
                                            lib.io.write(
`使用法: cat [オプション]... [ファイル]...
ファイルを連結し、標準出力に出力します。

  -A, --show-all           -vETと同じ
  -b, --number-nonblank    空でない行に行番号を振る
  -e                       -vEと同じ
  -E, --show-ends          各行末に$を置く
  -n, --number             すべての行に行番号を振る
  -s, --squeeze-blank      2つ以上の空白行を一つにまとめる
  -t                       -vTと同じ
  -T, --show-tabs          TAB文字を'^I'と表示
  -u                       (無視)
  -v, --show-nonprinting   改行とTAB文字以外のASCII制御文字をキャレット記法で表示
      --help     この使い方を表示して終了する
      --version  バージョン情報を表示して終了する

`, 1);
                                        } else if (options.index["--version"] !== -1) {
                                            lib.io.write(
`cat (ShalfeltOS Coreutils) 1.0.0
Copyright (c) 2024 Kotonone and ShalfeltOS contributors
MIT License: https://opensource.org/license/mit.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

作者 Kotonone and ShalfeltOS contributors
`, 1);
                                        } else {
                                            if (options.index["-u"] !== -1) {
                                                delete options.index["-u"];
                                            }
                                            if (options.index["--number-nonblank"] !== -1) {
                                                options.index["-b"] = Math.max(options.index["--number-nonblank"], options.index["-b"])
                                                delete options.index["--number-nonblank"];
                                            }
                                            if (options.index["--show-ends"] !== -1) {
                                                options.index["-E"] = Math.max(options.index["--show-ends"], options.index["-E"])
                                                delete options.index["--show-ends"];
                                            }
                                            if (options.index["--number"] !== -1) {
                                                options.index["-n"] = Math.max(options.index["--number"], options.index["-n"])
                                                delete options.index["--number"];
                                            }
                                            if (options.index["--squeeze-blank"] !== -1) {
                                                options.index["-s"] = Math.max(options.index["--squeeze-blank"], options.index["-s"])
                                                delete options.index["--squeeze-blank"];
                                            }
                                            if (options.index["--show-tabs"] !== -1) {
                                                options.index["-T"] = Math.max(options.index["--show-tabs"], options.index["-T"])
                                                delete options.index["--show-tabs"];
                                            }
                                            if (options.index["--show-nonprinting"] !== -1) {
                                                options.index["-v"] = Math.max(options.index["--show-nonprinting"], options.index["-v"])
                                                delete options.index["--show-nonprinting"];
                                            }
                                            if (options.index["-A"] !== -1 || options.index["--show-all"] !== -1) {
                                                options.index["-v"] = Math.max(options.index["-A"], options.index["--show-all"], options.index["-v"])
                                                options.index["-E"] = Math.max(options.index["-A"], options.index["--show-all"], options.index["-E"])
                                                options.index["-T"] = Math.max(options.index["-A"], options.index["--show-all"], options.index["-T"])
                                                if (options.index["-A"] !== -1)
                                                    delete options.index["-A"];
                                                if (options.index["--show-all"] !== -1)
                                                    delete options.index[options.index["--show-all"]];
                                            }
                                            if (options.index["-e"] !== -1) {
                                                options.index["-v"] = Math.max(options.index["-e"], options.index["-v"])
                                                options.index["-E"] = Math.max(options.index["-e"], options.index["-E"])
                                                delete options.index["-e"];
                                            }
                                            if (options.index["-t"] !== -1) {
                                                options.index["-v"] = Math.max(options.index["-t"], options.index["-v"])
                                                options.index["-T"] = Math.max(options.index["-t"], options.index["-T"])
                                                delete options.index["-t"];
                                            }
                                            let readText = "";
                                            let error = false;
                                            for (let fileName of args.slice(options.lastOptionIndex + 1)) {
                                                try {
                                                    const fd = this.open(fileName, OpenFlag.READ);
                                                    if (options.lastOptionIndex === -1) {
                                                        lib.io.write(new Uint8Array(await this.read(fd)), 1);
                                                    } else {
                                                        readText += new TextDecoder().decode(new Uint8Array(await this.read(fd)));
                                                    }
                                                    this.close(fd);
                                                } catch (e) {
                                                    error = true;
                                                    if (e instanceof ENOENT) {
                                                        lib.io.write(`cat: ${fileName}: そのようなファイルやディレクトリはありません\n`, 2);
                                                        break;
                                                    } else if (e instanceof EISDIR) {
                                                        lib.io.write(`cat: ${fileName}: ディレクトリです\n`, 2);
                                                        break;
                                                    } else {
                                                        throw e;
                                                    }
                                                }
                                            }

                                            if (!error) {
                                                if (options.index["-s"] !== -1) {
                                                    readText = readText.replace(/\n\n\n+/g,"\n\n");
                                                }
                                                if (options.index["-E"] !== -1) {
                                                    readText = readText.replaceAll("\n","$\n");
                                                }
                                                if (options.index["-T"] !== -1) {
                                                    readText = readText.replaceAll("\t","^I");
                                                }
                                                if (options.index["-v"] !== -1) {
                                                    const caret: { [key: string]: string } = {
                                                        "\x00":"^@",
                                                        "\x01":"^A",
                                                        "\x02":"^B",
                                                        "\x03":"^C",
                                                        "\x04":"^D",
                                                        "\x05":"^E",
                                                        "\x06":"^F",
                                                        "\x07":"^G",
                                                        "\x08":"^H",
                                                        "\x0b":"^K",
                                                        "\x0c":"^L",
                                                        "\x0d":"^M",
                                                        "\x0e":"^N",
                                                        "\x0f":"^O",
                                                        "\x10":"^P",
                                                        "\x11":"^Q",
                                                        "\x12":"^R",
                                                        "\x13":"^S",
                                                        "\x14":"^T",
                                                        "\x15":"^U",
                                                        "\x16":"^V",
                                                        "\x17":"^W",
                                                        "\x18":"^X",
                                                        "\x19":"^Y",
                                                        "\x1a":"^Z",
                                                        "\x1b":"^[",
                                                        "\x1c":"^\\",
                                                        "\x1d":"^]",
                                                        "\x1e":"^^",
                                                        "\x1f":"^_",
                                                        "\x7f":"^?"
                                                    }
                                                    readText = readText.replace(
                                                        /[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f]/g,
                                                        s => caret[s]
                                                    );
                                                }
                                                if (options.index["-n"] !== -1 || options.index["-b"] !== -1) {
                                                    let countLine = 1
                                                    const lines = readText.split("\n")
                                                    for (let i = 0; i < lines.length; i++) {
                                                        let line = lines[i];
                                                        if (options.index["-b"] !== -1) {
                                                            if (i === lines.length - 1) {
                                                                if (line === "") {
                                                                    lib.io.write(line, 1)
                                                                } else {
                                                                    const textLength = countLine.toString()
                                                                    lib.io.write("      ".slice(0, 6 - textLength.length) + textLength + "  " + line, 1)
                                                                }
                                                            } else {
                                                                if (line === (options.index["-T"] === -1 ? "" : "$")) {
                                                                    lib.io.write(line, 1)
                                                                } else {
                                                                    const textLength = countLine.toString()
                                                                    lib.io.write("      ".slice(0, 6 - textLength.length) + textLength + "  " + line, 1)
                                                                    countLine++;
                                                                }
                                                                lib.io.write("\n", 1)
                                                            }
                                                        } else {
                                                            const textLength = (i + 1).toString()
                                                            lib.io.write("      ".slice(0, 6 - textLength.length) + textLength + "  " + line, 1)
                                                            if (i !== lines.length - 1) {
                                                                lib.io.write("\n", 1)
                                                            }
                                                        }
                                                    }
                                                    readText.replaceAll("\t","^I");
                                                } else {
                                                    lib.io.write(readText, 1)
                                                }
                                            }
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
                                    try {
                                        const info = this.uname();
                                        lib.io.write(`\n${info.os_name} ${info.os_version}\n`);
                                        lib.io.write("Copyright (C) 2024 Kotonone and ShalfeltOS contributors\n\n");

                                        await this.spawn(async function() {
                                            await this.exec("/bin/login", [], {
                                                PWD: "/",
                                                PATH: "/bin:/sbin"
                                            });
                                        });
                                    } catch (e) {
                                        console.error(e);
                                        terminal.write(`\x1b[2J\x1b[H\x1b[0m\x1b[40m  ${"\x1b[43m  \x1b[40m  ".repeat(10)}\n\n`);
                                        terminal.write(`\x1b[0m  \x1b[1m\x1b[4m\x1b[33mShalfeltOS Kernel Panic\n\n`);
                                        terminal.write(`\x1b[0m  ${(e as Error).stack}`);
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        ]
    };
}
