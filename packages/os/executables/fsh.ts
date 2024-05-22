import { basename, split, StatMode, parseOptions, join, ENOENT, EISDIR, ELIBBAD } from "../../kernel";
import { generateApplicationFile } from "../Utils";

export default generateApplicationFile(async function(lib) {
    const info = this.uname();

    while (true) {
        lib.io.write(`[kotone@${info.nodename} ${basename(this.env.PWD!)}]$ `);

        const text = (await lib.io.read()).trimEnd();
        if (text.trim() === "") continue;

        const command = split(text).filter(a => a !== "");
        if (command.length < 1) continue;

        // TODO: cd.sh: builtin cd "$@"
        if (command[0] === "cd") {
            if (command.length === 1) {
                this.env.PWD = this.env.HOME;
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
                let options = parseOptions(command.slice(1), ["-P", "-L"])

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
                            const pwdPath = this.env.PWD!.split("/");
                            let isSymbolic = false;
                            for (let i = 0; i < pwdPath.length - 1; i++) {
                                isSymbolic = !!(this.lstat(pwdPath.slice(0, -i ? -i : pwdPath.length).join("/")).mode & StatMode.IFLNK);
                                if (isSymbolic) {
                                    if (i === 0) {
                                        lib.io.write(this.readlink(this.env.PWD!) + "\n", 1);
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
})
