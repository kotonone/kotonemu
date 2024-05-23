import { join, parseOptions, stringifyMode } from "@/kernel/Utils";
import { ENOENT, ENOTDIR } from "@/kernel/Error";
import { Stat } from "@/kernel/Process";
import { StatMode } from "@/kernel/Flags";
import { generateApplicationFile } from "../Utils";

// TODO: ユーザー名をOSで管理
const users: {
    [key: number]: string;
} = {
    0: "root"
};
const groups: {
    [key: number]: string;
} = {
    0: "root"
};

export default generateApplicationFile(async function(lib) {
    const args = this.args;
    // TODO: Add more options (https://github.com/kotonone/kotonemu/pull/7#issuecomment-2081303265)
    let options = parseOptions(
        args,
        ["-F", "-A", "-a", "-r", "-1", "-m", "-Q", "-U", "-X", "-e", "-q", "-N", "-S", "-v", "-t", "-p", "-R", "-C", "-l", "-o", "-G", "-g", "-n"],
        [
            "--help", "--version", "--all", "--almost-all", "--classify", "--quote-name", "--reverse", "--escape", "--hide-control-chars", "--show-control-chars", "--literal", "--file-type", "--recursive", "--numeric-uid-gid", "--no-group",
            { "id": "--sort", "usesArgument": true, "needsArgument": true },
            { "id": "--quoting-style", "usesArgument": true, "needsArgument": true },
            { "id": "--indicator-style", "usesArgument": true, "needsArgument": true },
            { "id": "--format", "usesArgument": true, "needsArgument": true }
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
  -C                         複数列で要素を表示する (未実装)
  -F, --classify             要素にインジケータ（*/@のいずれか）を追加する
      --file-type            -Fと同じように追加するが、 '*' は追加しない
      --format=WORD          WORDの形式で表示する:
                               commas (-m), long (-l),
                               single-column (-1), verbose (-l), vertical (-C)
  -g                         -l と同様だがファイル所有者を表示しない
  -G, --no-group             -l と併用したときにグループ情報を表示しない
      --indicator-style=WORD
                             WORDのインジケータを追加する:
                               none, classify (-F),
                               file-type (--file-type), slash (-p)
  -l                         詳細リスト形式で表示する
  -m                         要素のリストをカンマで区切る
  -n, --numeric-uid-gid      -l と同様だがファイル所有者とグループ情報をIDで表示する
  -N, --literal              要素名をそのまま表示する
  -o                         -l と同様だがグループ情報を表示しない
  -p                         ディレクトリにインジケータ '/' を追加する
  -q, --hide-control-chars   表示不可能な文字を ? で表示する
      --show-control-chars   表示不可能な文字をそのまま表示する
  -Q, --quote-name           要素名をダブルクオーテーションで囲む
      --quoting-style=WORD   WORD のスタイルで要素名を表示する:
                               literal, locale, shell, shell-always,
                               shell-escape, shell-escape-always, c, escape
  -r, --reverse              並び順を反転させる
  -R, --recursive            子ディレクトリを再帰的に一覧表示する
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
        const formatType = { type: "vertical", index: -1 }
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


        sortingType: {
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
                        if (options.index["--sort"] >= sortingType.index) {
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
        }

        if (options.index["-q"] !== -1) {
            options.index["--hide-control-chars"] = Math.max(options.index["--hide-control-chars"], options.index["-q"])
            delete options.index["-q"];
        }

        quotingType: {
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
                        if (options.index["--quoting-style"] >= sortingType.index) {
                            quotingType.type = options.optionsArguments["--quoting-style"];
                            quotingType.index = options.index["--quoting-style"]
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
        }

        indicatorType: {
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
                        if (options.index["--indicator-style"] >= indicatorType.index) {
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
        }

        formatType: {
            if (options.index["-C"] !== -1) {
                if (options.index["-C"] >= formatType.index) {
                    formatType.type = "vertical";
                    formatType.index = options.index["-C"];
                }
                delete options.index["-C"];
            }
            if (options.index["-1"] !== -1) {
                if (options.index["-1"] >= formatType.index) {
                    formatType.type = "single-column";
                    formatType.index = options.index["-1"];
                }
                delete options.index["-1"];
            }
            if (options.index["-l"] !== -1) {
                if (options.index["-l"] >= formatType.index) {
                    formatType.type = "long";
                    formatType.index = options.index["-l"];
                }
                delete options.index["-l"];
            }
            if (options.index["-o"] !== -1) {
                if (options.index["-o"] >= formatType.index) {
                    formatType.type = "long";
                    formatType.index = options.index["-o"];
                }
            }
            if (options.index["-g"] !== -1) {
                if (options.index["-g"] >= formatType.index) {
                    formatType.type = "long";
                    formatType.index = options.index["-g"];
                }
            }
            if (options.index["--numeric-uid-gid"] !== -1) {
                options.index["-n"] = Math.max(options.index["--numeric-uid-gid"], options.index["-n"])
                delete options.index["--numeric-uid-gid"];
            }
            if (options.index["-n"] !== -1) {
                if (options.index["-n"] >= formatType.index) {
                    formatType.type = "long";
                    formatType.index = options.index["-n"];
                }
            }
            if (options.index["-m"] !== -1) {
                if (options.index["-m"] >= formatType.index) {
                    formatType.type = "commas";
                    formatType.index = options.index["-m"];
                }
                delete options.index["-m"];
            }
            if (options.index["--format"] !== -1) {
                switch (options.optionsArguments["--format"]) {
                    case "commas":
                    case "long":
                    case "single-column":
                    case 'vertical':
                        if (options.index["--format"] >= formatType.index) {
                            formatType.type = options.optionsArguments["--format"];
                            formatType.index = options.index["--format"]
                        }
                        delete options.index["--format"];
                        break;
                    case 'verbose':
                        if (options.index["--format"] >= formatType.index) {
                            formatType.type = "long";
                            formatType.index = options.index["--format"]
                        }
                        delete options.index["--format"];
                        break;
                    case "":
                    case undefined:
                        lib.io.write(`ls: '--format' は引数が必要です
詳しくは'ls --help'を実行してください
`, 2)
                        return;
                    default:
                        lib.io.write(`ls: '--format' に対する引数 '${options.optionsArguments["--format"]}' が間違っています
有効な引数:
  - 'commas'
  - 'long'
  - 'single-column'
  - 'verbose'
  - 'vertical'
詳しくは'ls --help'を実行してください
`, 2)
                        return;
                }
            }
        }
        if (options.index["--no-group"] !== -1) {
            options.index["-G"] = Math.max(options.index["--no-group"], options.index["-G"])
            delete options.index["--no-group"];
        }


        let directories = options.arguments;
        if (directories.length === 0) {
            directories.push(this.env.PWD!);
        }
        const sortFileList = (fileList: string[]) => {
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
            const stats: { [key: string]: Stat } = {};
            const childrenDirectory = [];
            for (const fileName of files) {
                let fileData = fileName;
                if (options.index["-A"] === -1 && options.index["-a"] === -1) {
                    if (fileName.startsWith(".")) {
                        continue;
                    }
                }
                stats[fileName] = this.lstat(join(dir, fileName));
                if (options.index["-R"] !== -1 && fileName !== "." && fileName !== "..") {
                    if (stats[fileName].mode & StatMode.IFDIR) {
                        childrenDirectory.push(join(dir, fileName));
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
                        "\x00": "\\0",
                        "\x01": "\\001",
                        "\x02": "\\002",
                        "\x03": "\\003",
                        "\x04": "\\004",
                        "\x05": "\\005",
                        "\x06": "\\006",
                        "\x07": "\\a",
                        "\x08": "\\b",
                        "\x09": "\\t",
                        "\x0b": "\\v",
                        "\x0c": "\\f",
                        "\x0d": "\\r",
                        "\x0e": "\\016",
                        "\x0f": "\\017",
                        "\x10": "\\020",
                        "\x11": "\\021",
                        "\x12": "\\022",
                        "\x13": "\\023",
                        "\x14": "\\024",
                        "\x15": "\\025",
                        "\x16": "\\026",
                        "\x17": "\\027",
                        "\x18": "\\030",
                        "\x19": "\\031",
                        "\x1a": "\\032",
                        "\x1b": "\\033",
                        "\x1c": "\\034",
                        "\x1d": "\\035",
                        "\x1e": "\\036",
                        "\x1f": "\\037",
                        "\x7f": "\\177"
                    };
                    fileData = fileData.replace(
                        /[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f]/g,
                        s => caret[s]
                    );
                    if (options.index["-1"] === -1) {
                        fileData = fileData.replaceAll("\x0a", "\\n");
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
                    if (quotingType.type === "shell-escape" || quotingType.type === "shell-escape-always") escapeFileData();
                    const specialCharacters = /[\,\[\\\*\^\$\(\)\+\?\{\|]/g;
                    if (specialCharacters.test(fileData)) {
                        if (fileData.includes("'")) {
                            if (fileData.includes("\"")) {
                                fileData = `'${fileData.replaceAll("'", "\\'")}'`;
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
                if (options.index["--hide-control-chars"] >= options.index["--show-control-chars"]) {
                    fileData = fileData.replace(
                        /[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f]/g,
                        "?"
                    );
                    if (options.index["-1"] === -1) {
                        fileData = fileData.replaceAll("\x0a", "?");
                    }
                }

                if (formatType.type === "long") {
                    let fileDetails = "";
                    if (stats[fileName].mode & StatMode.IFDIR) {
                        fileDetails += "d";
                    } else if (stats[fileName].mode & (StatMode.IFLNK ^ StatMode.IFREG)) {
                        fileDetails += "l";
                    } else/* if (stats[fileName].mode & StatMode.IFREG)*/ {
                        fileDetails += "-";
                    }
                    fileDetails += `${stringifyMode(stats[fileName].mode).join("")} `;

                    if (options.index["-o"] === -1 && options.index["-G"] === -1) {
                        if (options.index["-n"] === -1) {
                            fileDetails += `${groups[stats[fileName].group]} `;
                        } else {
                            fileDetails += `${stats[fileName].group} `;
                        }
                    }

                    if (options.index["-g"] === -1) {
                        if (options.index["-n"] === -1) {
                            fileDetails += `${groups[stats[fileName].owner]} `;
                        } else {
                            fileDetails += `${stats[fileName].owner} `;
                        }
                    }
                    fileData = fileDetails + fileData;
                }

                fileList.push(fileData);
            }

            if (childrenDirectory.length !== 0) {
                sortFileList(childrenDirectory);
                directories.splice(index + 1, 0, ...childrenDirectory)
            }

            if (formatType.type === "vertical") {
                return fileList.join("  ");
            } else if (formatType.type === "commas") {
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
                const directoryPath = directories[i];
                try {
                    list.push(`${directoryPath}:\n${getFileList(directoryPath, i)}`);
                } catch (e) {
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
})
