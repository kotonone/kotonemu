import { Terminal } from "@xterm/xterm";
import { EmulatorInit } from "@/core/Emulator";
import { EISDIR, ELIBBAD, ENOENT, ENOTDIR } from "@/core/Error";
import { OpenFlag, StatMode, StdReadFlag } from "@/core/Flags";
import { basename, concatArrayBuffer, join, split, parseOptions } from "@/core/Utils";
import { File } from "@/core/File";
import { Stat } from "@/core/Process";

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
                                        lib.io.write(`詳しくは'cat --help'を実行してください\n`, 2);
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
                            },
                            {
                                name: "ls",
                                type: "executable-file",
                                owner: 0,
                                group: 0,
                                mode: 0o777,
                                deleted: false,
                                protected: true,

                                async onStart(lib) {
                                    const args = this.args;
                                    // TODO: Add more options
                                    let options = parseOptions(
                                        args,
                                        ["-F", "-A", "-a", "-r", "-1", "-m", "-Q", "-U", "-X", "-e", "-q", "-N", "-S", "-v", "-t", "-p", "-R"],
                                        [
                                            "--help", "--version", "--all", "--almost-all", "--classify", "--quote-name", "--reverse", "--escape", "--hide-control-chars", "--show-control-chars", "--literal", "--file-type", "--recursive",
                                            { "id": "--sort", "usesArgument": true, "needsArgument": true},
                                            { "id": "--quoting-style", "usesArgument": true, "needsArgument": true},
                                            { "id": "--indicator-style", "usesArgument": true, "needsArgument": true}
                                        ],
                                        { stopInvalidOption: false }
                                    );
                                    if (options.index["--help"] !== -1) {
                                        lib.io.write(
`使用法: ls [オプション]... [ファイル]...
ファイル (既定ではカレントディレクトリ) に関する情報を一覧表示します。
--sortが指定されていない場合は、要素をアルファベット順に並び替えます

  -a, --all                  . で始まる要素を無視しない
  -A, --almost-all           . 及び .. を一覧表示しない
  -b, --escape               表示不可能な文字の場合に C 形式のエスケープ文字で表示する
  -F, --classify             要素にインジケータ（*/@のいずれか）を追加する
      --file-type            -Fと同じように追加するが、 '*' は追加しない
      --indicator-style=WORD
                             WORDのインジケータを追加する:
                               none, classify (-F),
                               file-type (--file-type), slash (-p)
  -m                         要素のリストをカンマで区切る
  -N, --literal              要素名をそのまま表示する
  -p                         ディレクトリにインジケータ '/' を追加する
  -q, --hide-control-chars   表示不可能な文字を ? で表示する
      --show-control-chars   表示不可能な文字をそのまま表示する
  -Q, --quote-name           要素名をダブルクオーテーションで囲む
      --quoting-style=WORD   WORD のスタイルで要素名を表示する:
                               literal, locale, shell, shell-always,
                               shell-escape, shell-escape-always, c, escape
  -r, --reverse              並び順を反転させる
  -S                         ファイルのサイズで大きい順に並び替える
      --sort=WORD            名前の代わりに WORD にしたがって並び替える:
                               none (-U), extension (-X)
  -t                         ファイルの更新時間で新しい順に並び替える
  -U                         要素を並び替えない
  -v                         テキスト内の(バージョン)番号で自然に並び替える
  -X                         要素の拡張子でアルファベット順にソートする
  -1                         1行に1ファイルをリストする。
                               また、-q 及び -b で ' \\n' を変換しない。
      --help     この使い方を表示して終了する
      --version  バージョン情報を表示して終了する

`, 1);
                                    } else if (options.index["--version"] !== -1) {
                                        lib.io.write(
`ls (ShalfeltOS Coreutils) 1.0.0
Copyright (c) 2024 Kotonone and ShalfeltOS contributors
MIT License: https://opensource.org/license/mit.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

作者 Kotonone and ShalfeltOS contributors
`, 1);
                                    } else {
                                        const quotingType = { type: "literal", index: -1 };
                                        const sortingType = { type: "", index: -1 };
                                        const indicatorType = { type: "none", index: -1 };
                                        if (options.index["--all"] !== -1) {
                                            options.index["-a"] = Math.max(options.index["--all"], options.index["-a"])
                                            delete options.index["--all"];
                                        }
                                        if (options.index["--almost-all"] !== -1) {
                                            options.index["-A"] = Math.max(options.index["--almost-all"], options.index["-A"])
                                            delete options.index["--almost-all"];
                                        }
                                        if (options.index["--recursive"] !== -1) {
                                            options.index["-R"] = Math.max(options.index["--recursive"], options.index["-R"])
                                            delete options.index["--recursive"];
                                        }
                                        if (options.index["--reverse"] !== -1) {
                                            options.index["-r"] = Math.max(options.index["--reverse"], options.index["-r"])
                                            delete options.index["--reverse"];
                                        }

                                        if (options.index["-U"] !== -1) {
                                            if (options.index["-U"] >= sortingType.index) {
                                                sortingType.type = "none";
                                                sortingType.index = options.index["-U"];
                                            }
                                            delete options.index["-U"];
                                        }
                                        if (options.index["-X"] !== -1) {
                                            if (options.index["-X"] >= sortingType.index) {
                                                sortingType.type = "extension";
                                                sortingType.index = options.index["-X"];
                                            }
                                            delete options.index["-X"];
                                        }
                                        if (options.index["-t"] !== -1) {
                                            if (options.index["-t"] >= sortingType.index) {
                                                sortingType.type = "time";
                                                sortingType.index = options.index["-t"];
                                            }
                                            delete options.index["-t"];
                                        }
                                        if (options.index["-v"] !== -1) {
                                            if (options.index["-v"] >= sortingType.index) {
                                                sortingType.type = "version";
                                                sortingType.index = options.index["-v"];
                                            }
                                            delete options.index["-v"];
                                        }
                                        if (options.index["-S"] !== -1) {
                                            if (options.index["-S"] >= sortingType.index) {
                                                sortingType.type = "size";
                                                sortingType.index = options.index["-S"];
                                            }
                                            delete options.index["-S"];
                                        }
                                        if (options.index["--sort"] !== -1) {
                                            switch (options.optionsArguments["--sort"]) {
                                                case "none":
                                                case "extension":
                                                case "time":
                                                case "extensizesion":
                                                case "version":
                                                    if (options.index["--sort"] >= sortingType.index){
                                                        sortingType.type = options.optionsArguments["--sort"];
                                                        sortingType.index = options.index["--sort"]
                                                    }
                                                    delete options.index["--sort"];
                                                    break;
                                                case "":
                                                case undefined:
                                                    lib.io.write(`ls: '--sort' は引数が必要です
詳しくは'ls --help'を実行してください
`, 2)
                                                    return;
                                                default:
                                                    lib.io.write(`ls: '--sort' に対する引数 '${options.optionsArguments["--sort"]}' が間違っています
有効な引数:
  - 'none'
  - 'time'
  - 'size'
  - 'extension'
  - 'version'
詳しくは'ls --help'を実行してください
`, 2)
                                                    return;
                                            }
                                        }
                                        if (options.index["-q"] !== -1) {
                                            options.index["--hide-control-chars"] = Math.max(options.index["--hide-control-chars"], options.index["-q"])
                                            delete options.index["-q"];
                                        }
                                        if (options.index["-b"] !== -1) {
                                            if (options.index["-b"] >= quotingType.index) {
                                                quotingType.type = "escape";
                                                quotingType.index = options.index["-b"];
                                            }
                                            delete options.index["-b"];
                                        }
                                        if (options.index["--escape"] !== -1) {
                                            if (options.index["--escape"] >= quotingType.index) {
                                                quotingType.type = "escape";
                                                quotingType.index = options.index["--escape"];
                                            }
                                            delete options.index["--escape"];
                                        }
                                        if (options.index["--quote-name"] !== -1) {
                                            if (options.index["--quote-name"] >= quotingType.index) {
                                                quotingType.type = "c";
                                                quotingType.index = options.index["--quote-name"];
                                            }
                                            delete options.index["--quote-name"];
                                        }
                                        if (options.index["-Q"] !== -1) {
                                            if (options.index["-Q"] >= quotingType.index) {
                                                quotingType.type = "c";
                                                quotingType.index = options.index["-Q"];
                                            }
                                            delete options.index["-Q"];
                                        }
                                        if (options.index["--literal"] !== -1) {
                                            if (options.index["--literal"] >= quotingType.index) {
                                                quotingType.type = "literal";
                                                quotingType.index = options.index["--literal"];
                                            }
                                            delete options.index["--literal"];
                                        }
                                        if (options.index["-N"] !== -1) {
                                            if (options.index["-N"] >= quotingType.index) {
                                                quotingType.type = "literal";
                                                quotingType.index = options.index["-N"];
                                            }
                                            delete options.index["-N"];
                                        }
                                        if (options.index["--quoting-style"] !== -1) {
                                            switch (options.optionsArguments["--quoting-style"]) {
                                                case "literal":
                                                case "shell":
                                                case "shell-always":
                                                case 'shell-escape':
                                                case 'shell-escape-always':
                                                case 'c':
                                                case 'c-maybe':
                                                case 'escape':
                                                case 'locale':
                                                case 'clocale':
                                                    if (options.index["--quoting-style"] >= sortingType.index){
                                                        quotingType.type = options.optionsArguments["--quoting-style"];
                                                        sortingType.index = options.index["--quoting-style"]
                                                    }
                                                    delete options.index["--quoting-style"];
                                                    break;
                                                case "":
                                                case undefined:
                                                    lib.io.write(`ls: '--quoting-style' は引数が必要です
詳しくは'ls --help'を実行してください
`, 2)
                                                    return;
                                                default:
                                                    lib.io.write(`ls: '--quoting-style' に対する引数 '${options.optionsArguments["--quoting-style"]}' が間違っています
有効な引数:
  - 'literal'
  - 'shell'
  - 'shell-always'
  - 'shell-escape'
  - 'shell-escape-always'
  - 'c'
  - 'c-maybe'
  - 'escape'
  - 'locale'
  - 'clocale'
詳しくは'ls --help'を実行してください
`, 2)
                                                    return;
                                            }
                                        }

                                        if (options.index["-F"] !== -1) {
                                            if (options.index["-F"] >= indicatorType.index) {
                                                indicatorType.type = "classify";
                                                indicatorType.index = options.index["-F"];
                                            }
                                            delete options.index["-F"];
                                        }
                                        if (options.index["--classify"] !== -1) {
                                            if (options.index["--classify"] >= indicatorType.index) {
                                                indicatorType.type = "classify";
                                                indicatorType.index = options.index["--classify"];
                                            }
                                            delete options.index["--classify"];
                                        }
                                        if (options.index["--file-type"] !== -1) {
                                            if (options.index["--file-type"] >= indicatorType.index) {
                                                indicatorType.type = "file-type";
                                                indicatorType.index = options.index["--file-type"];
                                            }
                                            delete options.index["--file-type"];
                                        }
                                        if (options.index["-p"] !== -1) {
                                            if (options.index["-p"] >= indicatorType.index) {
                                                indicatorType.type = "slash";
                                                indicatorType.index = options.index["-p"];
                                            }
                                            delete options.index["-p"];
                                        }
                                        if (options.index["--indicator-style"] !== -1) {
                                            switch (options.optionsArguments["--indicator-style"]) {
                                                case "none":
                                                case "slash":
                                                case "file-type":
                                                case "classify":
                                                    if (options.index["--indicator-style"] >= indicatorType.index){
                                                        indicatorType.type = options.optionsArguments["--indicator-style"];
                                                        indicatorType.index = options.index["--indicator-style"]
                                                    }
                                                    delete options.index["--indicator-style"];
                                                    break;
                                                case "":
                                                case undefined:
                                                    lib.io.write(`ls: '--indicator-style' は引数が必要です
詳しくは'ls --help'を実行してください
`, 2)
                                                    return;
                                                default:
                                                    lib.io.write(`ls: '--indicator-style' に対する引数 '${options.optionsArguments["--indicator-style"]}' が間違っています
有効な引数:
  - 'none'
  - 'slash'
  - 'file-type'
  - 'classify'
詳しくは'ls --help'を実行してください
`, 2)
                                                    return;
                                            }
                                        }
    
                                        let directories = options.arguments;
                                        if (directories.length === 0) {
                                            directories.push("./");
                                        }
                                        const sortFileList = (fileList : string[]) => {
                                            // TODO: size, version, time
                                            if (sortingType.type !== "none") {
                                                if (sortingType.type === "extension") {
                                                    fileList.sort((a, b) => {
                                                        let aType = -1;
                                                        let bType = -1;
                                                        if (!a.includes(".")) {
                                                            aType = 0;
                                                        } else if (a === ".") {
                                                            aType = 1;
                                                        } else if (a === "..") {
                                                            aType = 2;
                                                        } else if (a.startsWith(".") && a.slice(1).includes(".")) {
                                                            aType = 3;
                                                        } else {
                                                            aType = Infinity;
                                                        }

                                                        if (!b.includes(".")) {
                                                            bType = 0;
                                                        } else if (b === ".") {
                                                            bType = 1;
                                                        } else if (b === "..") {
                                                            bType = 2;
                                                        } else if (b.startsWith(".") && b.slice(1).includes(".")) {
                                                            bType = 3;
                                                        } else {
                                                            bType = Infinity;
                                                        }

                                                        if (aType < bType) {
                                                            return -1;
                                                        } else if (aType > bType) {
                                                            return 1;
                                                        } else {
                                                            const aExt = a.split(".").slice(-1)[0];
                                                            const bExt = b.split(".").slice(-1)[0];
                                                            if (aExt === bExt) {
                                                                return a.localeCompare(b);
                                                            } else {
                                                                return aExt.localeCompare(bExt);
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    fileList.sort();
                                                }
                                            }
                                            if (options.index["-r"] !== -1) {
                                                fileList.reverse();
                                            }
                                        };
                                        const getFileList = (dir: string, index: number) => {
                                            let files = this.readdir(dir);
                                            if (options.index["-A"] < options.index["-a"]) {
                                                files = [".", "..", ...files];
                                            }
                                            sortFileList(files);

                                            const fileList = [];
                                            const stats: {[key: string]: Stat} = {};
                                            const childrenDirectory = [];
                                            for (const fileName of files) {
                                                let fileData = fileName;
                                                if (options.index["-A"] === -1 && options.index["-a"] === -1) {
                                                    if (fileName.startsWith(".")) {
                                                        continue;
                                                    }
                                                }
                                                stats[fileName] = this.lstat(`${dir}${dir.endsWith("/") ? "" : "/"}${fileName}`)
                                                if (options.index["-R"] !== -1 && fileName !== "." && fileName !== "..") {
                                                    if (stats[fileName].mode & StatMode.IFDIR) {
                                                        childrenDirectory.push(`${dir}${dir.endsWith("/") ? "" : "/"}${fileName}`);
                                                    } 
                                                }
                                                if (indicatorType.type !== "none") {
                                                    if (stats[fileName].mode & StatMode.IFDIR) {
                                                        fileData += "/";
                                                    } else if (stats[fileName].mode & (StatMode.IFLNK ^ StatMode.IFREG)) {
                                                        if (indicatorType.type !== "slash") {
                                                            fileData += "@";
                                                        }
                                                    } else if (stats[fileName].mode & 0o100) {
                                                        if (indicatorType.type === "classify") {
                                                            fileData += "*";
                                                        }
                                                    }
                                                }

                                                const escapeFileData = () => {
                                                    const caret: { [key: string]: string } = {
                                                        "\x00":"\\0",
                                                        "\x01":"\\001",
                                                        "\x02":"\\002",
                                                        "\x03":"\\003",
                                                        "\x04":"\\004",
                                                        "\x05":"\\005",
                                                        "\x06":"\\006",
                                                        "\x07":"\\a",
                                                        "\x08":"\\b",
                                                        "\x09":"\\t",
                                                        "\x0b":"\\v",
                                                        "\x0c":"\\f",
                                                        "\x0d":"\\r",
                                                        "\x0e":"\\016",
                                                        "\x0f":"\\017",
                                                        "\x10":"\\020",
                                                        "\x11":"\\021",
                                                        "\x12":"\\022",
                                                        "\x13":"\\023",
                                                        "\x14":"\\024",
                                                        "\x15":"\\025",
                                                        "\x16":"\\026",
                                                        "\x17":"\\027",
                                                        "\x18":"\\030",
                                                        "\x19":"\\031",
                                                        "\x1a":"\\032",
                                                        "\x1b":"\\033",
                                                        "\x1c":"\\034",
                                                        "\x1d":"\\035",
                                                        "\x1e":"\\036",
                                                        "\x1f":"\\037",
                                                        "\x7f":"\\177"
                                                    };
                                                    fileData = fileData.replace(
                                                        /[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f]/g,
                                                        s => caret[s]
                                                    );
                                                    if (options.index["-1"] === -1) {
                                                        fileData = fileData.replaceAll("\x0a","\\n");
                                                    }
                                                };

                                                // TODO: locale & clocale
                                                if (quotingType.type === "escape") {
                                                    fileData.replaceAll(" ", e => "\\ ");
                                                    escapeFileData()
                                                } else if (quotingType.type === "c") {
                                                    fileData.replace(/[\\\"]/g, e => "\\" + e);
                                                    fileData = `"${fileData}"`;
                                                    escapeFileData();
                                                } else if (quotingType.type === "c-maybe") {
                                                    if (fileData.includes("\"")) {
                                                        fileData.replaceAll("\"", "\\\"");
                                                        fileData = `"${fileData}"`;
                                                    } else if (/[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f]/.test(fileData) || (options.index["-1"] === -1 && fileData.includes("\x0a"))) {
                                                        fileData = `"${fileData}"`;
                                                    }
                                                    escapeFileData();
                                                } else if (quotingType.type === "shell" || quotingType.type === "shell-always" || quotingType.type === "shell-escape" || quotingType.type === "shell-escape-always") {
                                                    if (quotingType.type === "shell-escape" || quotingType.type === "shell-escape-always" ) escapeFileData();
                                                    const specialCharacters = /[\,\[\\\*\^\$\(\)\+\?\{\|]/g;
                                                    if (specialCharacters.test(fileData)){
                                                        if (fileData.includes("'")) {
                                                            if (fileData.includes("\"")) {
                                                                fileData = `'${fileData.replaceAll("'","\\'")}'`;
                                                            } else {
                                                                fileData = `"${fileData.replace(/[\`\$\\]/g, e => "\\" + e)}'}"`;
                                                            }
                                                        } else {
                                                            fileData = `'${fileData}'`;
                                                        }
                                                    } else if (quotingType.type === "shell-always" || quotingType.type === "shell-escape-always") {
                                                        fileData = `'${fileData}'`;
                                                    }
                                                }

                                                // TODO: change default if output is not a terminal
                                                if (options.index["--hide-control-chars"] >= options.index["--show-control-chars"]){
                                                    fileData = fileData.replace(
                                                        /[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f]/g,
                                                        "?"
                                                    );
                                                    if (options.index["-1"] === -1) {
                                                        fileData = fileData.replaceAll("\x0a","?");
                                                    }
                                                }

                                                fileList.push(fileData);
                                            }

                                            if (childrenDirectory.length !== 0) {
                                                sortFileList(childrenDirectory);
                                                directories.splice(index + 1, 0, ...childrenDirectory)
                                            }

                                            if (options.index["-1"] === -1 && options.index["-m"] === -1) {
                                                return fileList.join("  ");
                                            } else if (options.index["-1"] < options.index["-m"]) {
                                                return fileList.join(", ");
                                            } else {
                                                return fileList.join("\n");
                                            }
                                        }
                                        if (directories.length === 1 && options.index["-R"] === -1) {
                                            try {
                                                lib.io.write(getFileList(directories[0], 0), 1);
                                            } catch (e) {
                                                if (e instanceof ENOENT) {
                                                    lib.io.write(`ls: '${directories[0]}' にアクセスできません: そのようなファイルやディレクトリはありません\n`, 2);
                                                } else if (e instanceof ENOTDIR) {
                                                    lib.io.write(directories[0], 1);
                                                } else {
                                                    throw e;
                                                }
                                            }
                                        } else {
                                            const list = [];
                                            for (let i = 0; i < directories.length; i++) {
                                                console.log(directories);
                                                const directoryPath = directories[i];
                                                try {
                                                    list.push(`${directoryPath}:\n${getFileList(directoryPath, i)}`);
                                                } catch (e){
                                                    if (e instanceof ENOENT) {
                                                        lib.io.write(`ls: '${directoryPath}' にアクセスできません: そのようなファイルやディレクトリはありません\n`, 2);
                                                    } else if (e instanceof ENOTDIR) {
                                                        list.push(directoryPath);
                                                    } else {
                                                        throw e;
                                                    }
                                                }
                                            }
                                            lib.io.write(list.join("\n\n"), 1);
                                        }
                                        lib.io.write("\n", 1);
                                    }
                                }
                            },
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
