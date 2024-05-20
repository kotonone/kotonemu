import { parseOptions, OpenFlag, ENOENT, EISDIR } from "../../core";
import { generateApplicationFile } from "../Utils";

export default generateApplicationFile("cat", async function(lib) {
    const args = this.args;
    let options = parseOptions(
        args,
        ["-n", "-b", "-s", "-E", "-T", "-v", "-u", "A", "-e", "-t"],
        ["--help", "--version", "--number-nonblank", "--show-ends", "--number", "--squeeze-blank", "--show-tabs", "--show-nonprinting", "--show-all"]
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
                    readText = readText.replace(/\n\n\n+/g, "\n\n");
                }
                if (options.index["-E"] !== -1) {
                    readText = readText.replaceAll("\n", "$\n");
                }
                if (options.index["-T"] !== -1) {
                    readText = readText.replaceAll("\t", "^I");
                }
                if (options.index["-v"] !== -1) {
                    const caret: { [key: string]: string } = {
                        "\x00": "^@",
                        "\x01": "^A",
                        "\x02": "^B",
                        "\x03": "^C",
                        "\x04": "^D",
                        "\x05": "^E",
                        "\x06": "^F",
                        "\x07": "^G",
                        "\x08": "^H",
                        "\x0b": "^K",
                        "\x0c": "^L",
                        "\x0d": "^M",
                        "\x0e": "^N",
                        "\x0f": "^O",
                        "\x10": "^P",
                        "\x11": "^Q",
                        "\x12": "^R",
                        "\x13": "^S",
                        "\x14": "^T",
                        "\x15": "^U",
                        "\x16": "^V",
                        "\x17": "^W",
                        "\x18": "^X",
                        "\x19": "^Y",
                        "\x1a": "^Z",
                        "\x1b": "^[",
                        "\x1c": "^\\",
                        "\x1d": "^]",
                        "\x1e": "^^",
                        "\x1f": "^_",
                        "\x7f": "^?"
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
                    readText.replaceAll("\t", "^I");
                } else {
                    lib.io.write(readText, 1)
                }
            }
        }
    }
})
