import { dirname, parseMode, parseOptions } from "packages/kernel/Utils";
import { ENOENT } from "packages/kernel/Error";
import { generateApplicationFile } from "../Utils";

export default generateApplicationFile(async function (lib) {
    const args = this.args;
    let options = parseOptions(
        args,
        ["-p", "-v", { "id": "-m", "needsArgument": true }],
        [
            "--parents", "--verbose", "--help", "--version",
            { "id": "--mode", "usesArgument": true, "needsArgument": true },
        ],
        { stopInvalidOption: false }
    );

    if (options.index["--help"] !== -1) {
        lib.io.write(
            `使用法: mkdir [オプション]... ディレクトリ...
ディレクトリがまだない場合に作成します。

ロングオプションで必須なオプションは、ショートオプションでも必須です。
  -m, --mode=MODE   chmodのようにファイルモードを変更する
  -p, --parents     親ディレクトリが存在しない場合は作成する
  -v, --verbose     ディレクトリが作成される事にメッセージを表示する
      --help     この使い方を表示して終了する
      --version  バージョン情報を表示して終了する

`, 1);
    } else if (options.index["--version"] !== -1) {
        lib.io.write(
            `mkdir (ShalfeltOS Coreutils) 1.0.0
Copyright (c) 2024 Kotonone and ShalfeltOS contributors
MIT License: https://opensource.org/license/mit.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

作者 Kotonone and ShalfeltOS contributors
`, 1);
    } else {
        if (options.index["--parents"] !== -1) {
            options.index["-p"] = Math.max(options.index["--parents"], options.index["-p"]);
            delete options.index["--parents"];
        }
        if (options.index["--verbose"] !== -1) {
            options.index["-v"] = Math.max(options.index["--verbose"], options.index["-v"]);
            delete options.index["--verbose"];
        }
        let changeModeArg = "--mode";
        if (options.index["-m"] !== -1) {
            if (options.index["-m"] > options.index["--mode"]) {
                options.optionsArguments["--mode"] = options.optionsArguments["-m"];
                changeModeArg = "m";
            } else {
                changeModeArg = "mode";
            }
            options.index["--mode"] = Math.max(options.index["--mode"], options.index["-m"]);
            delete options.index["-m"];
        }
        let mode = parseMode("", true);
        if (options.index["--mode"] !== -1) {
            if (options.optionsArguments["--mode"]) {
                mode = parseMode(options.optionsArguments["--mode"], true);
                if (mode === -1) {
                    lib.io.write(
                        `mkdir: 無効なモード: ${options.optionsArguments["--mode"]}
`, 2);
                    return;
                }
            } else {
                lib.io.write(
                    `mkdir: オプションには引数が必要です -- '${changeModeArg}'
詳しくは'mkdir --help'を実行してください
`, 2);
                return;
            }
        }
        const directoryPaths = options.arguments;
        const makeDirectory = (path: string) => {
            try {
                this.mkdir(path, mode);
                if (options.index["-v"] !== -1) lib.io.write(`mkdir: ディレクトリ '${path}' を作成しました\n`, 1);
            } catch (e) {
                if (e instanceof ENOENT) {
                    if (options.index["-p"] === -1) {
                        lib.io.write(`mkdir: ディレクトリ '${path}' を作成できません: そのようなファイルやディレクトリはありません\n`, 2);
                    } else {
                        makeDirectory(dirname(path));

                        // NOTE: -pがない場合はこっちに入らないので、throw以外で止まることを考慮する必要はない
                        this.mkdir(path, mode);
                        if (options.index["-v"] !== -1) lib.io.write(`mkdir: ディレクトリ '${path}' を作成しました\n`, 1);
                    }
                } else {
                    throw e;
                }
            }
        };
        for (const path of directoryPaths) {
            try {
                this.stat(path);

                // NOTE: ENOENTが来なければ実行される
                lib.io.write(`mkdir: ディレクトリ '${path}' を作成できません: ファイルが存在します\n`, 1);
            } catch (e) {
                if (e instanceof ENOENT) {
                    makeDirectory(path);
                } else {
                    throw e;
                }
            }
        }
    }
});
