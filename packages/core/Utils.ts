import { PathError } from ".";

export const PATH_SEPARATOR = "/";

/** 偽の ELF ファイルのように見える内容を作成します。 */
export function generateFakeElfFile(): Uint8Array {
    const randomByte = (max: number = 0xff) => Math.floor(Math.random() * (max + 1));
    const data = new Uint8Array(16 + 16 * Math.floor(Math.random() * 100));

    data.set(new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]), 0);

    for (let i = 0; i < (data.length - 16) / 16; i++) data.set(new Uint8Array([randomByte(), randomByte(), randomByte(2), randomByte(1), 0x00, 0x00, 0x00, 0x00, randomByte(), randomByte(), randomByte(2), randomByte(1), 0x00, 0x00, 0x00, 0x00]), 16 + i * 16);

    return data;
}

/** 複数の ArrayBuffer を結合します。 */
export function concatArrayBuffer(...buf: ArrayBuffer[]): ArrayBuffer {
    const result = new Uint8Array(buf.map(a => a.byteLength).reduce((a, b) => a + b, 0));
    let pos = 0;
    for (const b of buf) {
        result.set(new Uint8Array(b), pos);
        pos += b.byteLength;
    }
    return result.buffer;
}

/**
 * パスを絶対パスのエントリ名の配列に変換します。
 * @param pathname パス
 * @param [root="/"] 参照を開始するディレクトリ
 * @param [sanitize=true] `.` や `..` などのパス指定文字を正規化します。
 */
export function resolve(pathname: string, root: string = PATH_SEPARATOR, sanitize: boolean = true): string[] {
    // NOTE: root を /a/b/c の形に正規化
    if (!root.startsWith(PATH_SEPARATOR)) throw new PathError("The root path must be begin with a path separator.");
    if (!root.endsWith(PATH_SEPARATOR)) root += PATH_SEPARATOR;
    // NOTE: pathname が絶対パスであると明示されている時、root はルートになる
    if (pathname.startsWith(PATH_SEPARATOR)) root = PATH_SEPARATOR;
    // NOTE: pathname を a/b/c の形に正規化
    if (pathname.endsWith(PATH_SEPARATOR)) pathname = trimEnd(pathname, PATH_SEPARATOR);

    const entryNames =
        // NOTE: root と pathname を連結する。
        (pathname.startsWith(PATH_SEPARATOR) ? pathname : root + pathname)

        // NOTE: プレースホルダー化
        .replaceAll("$", "$dollar")
        .replaceAll("\\" + PATH_SEPARATOR, "$pathsep")

        // NOTE: 分割
        .split(PATH_SEPARATOR)

        // NOTE: プレースホルダーを復元
        .map(p => p
            .replaceAll("$dollar", "$")
            .replaceAll("$pathsep", PATH_SEPARATOR)
        )

        // NOTE: パス区切りを消去
        .filter(v => v !== "");

    if (sanitize) {
        let sanitizedEntryNames: string[] = [];

        for (const entry of entryNames) {
            if (entry === ".") {
                continue;
                // TODO: ユーザーディレクトリを Process 側で解決
            } else if (entry === "..") {
                sanitizedEntryNames.pop();
            } else {
                sanitizedEntryNames.push(entry);
            }
        }

        return sanitizedEntryNames;
    } else {
        return entryNames;
    }
}
/**
 * 文字列の終端にある指定した文字列の連続を削除します。
 * @param source 検索する文字列
 * @param target 削除対象の文字列
 */
export function trimEnd(source: string, target: string): string {
    if (source.endsWith(target)) {
        return trimEnd(source.slice(0, -target.length), target);
    }
    return source;
}
/** パス名を連結します。 */
export function join(...pathnames: string[]): string {
    if (pathnames.length === 1 && pathnames[0] === "") return PATH_SEPARATOR;
    return pathnames.map(p => trimEnd(p, PATH_SEPARATOR)).join(PATH_SEPARATOR);
}
/** パス名からディレクトリパスを取得します。 */
export function dirname(pathname: string): string {
    return (pathname.startsWith(PATH_SEPARATOR) ? PATH_SEPARATOR : "") + join(...resolve(pathname, PATH_SEPARATOR, false).slice(0, -1));
}
/** パス名からファイル名を取得します。 */
export function basename(pathname: string): string {
    return resolve(pathname).at(-1) ?? PATH_SEPARATOR;
}

/**
 * コマンドの文字列を分割します。
 * @param content 文字列
 * @param variables 変数
 */
export function split(content: string, variables: Record<string, string> = {}) {
    let escapes: string[] = [];
    let quotes: string[] = [];

    return content
        // NOTE: エスケープ文字列を保存する
        .replace(/\\(u[0-9A-Fa-f]{1,4}|\{.*?\}|.)/g, s => {
            if (s.length !== 2 && s[1] === "u") {
                escapes.push(String.fromCharCode(parseInt(s.slice(2), 16)));
            } else if (s.length !== 2 && s[1] === "{") {
                escapes.push(variables[s.slice(2, -1)]);
            } else {
                escapes.push(s.slice(1));
            }
            return "\\e" + (escapes.length - 1).toString();
        })

        // NOTE: クオーテーション文字列を保存する
        .replace(/".*?"/g, s => { quotes.push(s.slice(1, -1)); return "\\q" + (quotes.length - 1).toString(); })

        // NOTE: 文字列を分割
        .split(" ")
        .map(s => s
            // NOTE: クオーテーション文字列を復元する
            .replace(/\\q\d+/g, s => quotes[parseInt(s.slice(2))])

            // NOTE: エスケープ文字列を復元する
            .replace(/\\e\d+/g, s => escapes[parseInt(s.slice(2))])
        );
}

/**
 * サイズを人間が読みやすい単位に変換します。
 * @param size サイズ
 * @param si 1024 の代わりに 1000 を使用するか
 */
export function convertSizeToHumanReadable(size: number, si: boolean = true) {
    /**
     * 単位 {@link unit} における {@link size} をまとめて表示します。
     * @param size サイズ
     * @param unit 単位
     */
    function formatWithUnit(size: number, unit: string): string {
        // NOTE: もし整数部分が1桁であれば、少数1桁までを丸めて表示する
        if (Math.floor(size) < 10) {
            return (Math.round(size * 10) / 10).toString() + unit;
        } else {
            return Math.round(size).toString() + unit;
        }
    }

    const base = si ? 1000 : 1024;
    if (size > base ** 5) {
        return formatWithUnit(size / base ** 5, "P");
    } else if (size > base ** 4) {
        return formatWithUnit(size / base ** 4, "T");
    } else if (size > base ** 3) {
        return formatWithUnit(size / base ** 3, "G");
    } else if (size > base ** 2) {
        return formatWithUnit(size / base ** 2, "M");
    } else if (size > base) {
        return formatWithUnit(size / base, "K");
    } else {
        return formatWithUnit(size, "");
    }
}

type oneHyphenOptionsList = (string | { id: string, needsArgument?: boolean })[];
type twoHyphensOptionsList = (string | { id: string, usesArgument?: boolean, needsArgument?: boolean })[];
type parseConfig = { stopInvalidOption: boolean; };
type optionsData = { index: { [id: string]: number }, optionsArguments: { [id: string]: unknown }, lastOptionIndex: number, invalidOption?: string, arguments: string[] };
/**
 * コマンドの引数からオプションについての情報を引き出します。   
 * 引数を受け付けないのに引数が含まれるオプションが見つかった場合はその時点で戻り値にinvalidOptionを含めてとして停止します。  
 * 
 * @param args オプションから始まる引数の配列
 * @param oneHyphen ハイフンが一つのオプションの配列
 * @param twoHyphens ハイフンが二つのオプションの配列
 * @param config オプションをパースするときのオプション  
 * - stopInvalidOption: 初期値:true  
 * trueの場合、オプションではない引数が見つかった場合もその時点で戻り値にinvalidOptionを含めてとして停止します。  
 * また、oneHyphen/twoHyphensに含まれないオプションがあった場合は戻り値にlastOptionIndexを含めて停止します。  
 * falseの場合は、戻り値にargumentsを含めます。  
 * 
 * @returns オプションに関する情報(Object型)  
 * - index: key:オプション名 value:オプションの順番(一番最初のオプションから重複ありで番号をつけ、一番最後のものを登録しています。)
 * - optionsArguments key:オプション名 value:オプションの引数(引数が用いられるオプションのみ、一番最後の引数を登録します。)
 * - lastOptionIndex: argsのうちオプションである一番最後の引数の添字(オプションが含まれない場合は-1となります。)
 * - invalidOption: 一番最初の不正なオプション
 * - arguments: config.stopInvalidOptionがfalseの時のオプションでない引数
 */
export function parseOptions(args: string[], oneHyphen: oneHyphenOptionsList = [], twoHyphens: twoHyphensOptionsList = [], config: parseConfig = { stopInvalidOption: true }) {
    const oneHyphenOptionsName = oneHyphen.map(e => (typeof e === "string") ? e : e.id);
    const twoHyphensOptionsName = twoHyphens.map(e => (typeof e === "string") ? e : e.id);
    const optionInfomation: { [key:string]: {usesArgument?: boolean, needsArgument?: boolean}} = {};
    for (const elem of twoHyphens.concat(oneHyphen)) {
        if (typeof elem === "string"){
            continue;
        } else {
            optionInfomation[elem.id] = {};
            if ("needsArgument" in elem) {
                optionInfomation[elem.id].needsArgument = elem.needsArgument;
            }
            if ("usesArgument" in elem) {
                optionInfomation[elem.id].usesArgument = elem.usesArgument;
            }
        }
    }

    const returnOptionsData: optionsData = { index:{}, optionsArguments:{}, lastOptionIndex: -1, arguments: []};
    let optionsCount = 0;
    let needContinue = false
    let notConfigSince = false;
    for (const arg of args) {
        if (returnOptionsData.invalidOption) {
            break;
        } else if (needContinue) {
            needContinue = false;
            continue;
        } else if (!arg.startsWith("-") || notConfigSince) {
            returnOptionsData.arguments.push(arg);
        } else if (arg === "--") {
            if (config.stopInvalidOption) {
                break;
            } else {
                notConfigSince = true;
            }
        } else if (arg.startsWith("--")) {
            if (arg.includes("=")) {
                const optionName = arg.slice(0, arg.indexOf('='));
                if (twoHyphensOptionsName.includes(optionName) && optionName in optionInfomation && optionInfomation[optionName].usesArgument) {
                    returnOptionsData.index[optionName] = optionsCount++;
                    returnOptionsData.lastOptionIndex++;
                    returnOptionsData.optionsArguments[optionName] = arg.replace(optionName + "=", "")
                } else {
                    returnOptionsData.invalidOption = optionName;
                }
            } else {
                const optionName = arg;
                if (twoHyphensOptionsName.includes(optionName)) {
                    returnOptionsData.index[optionName] = optionsCount++;
                    returnOptionsData.lastOptionIndex++;
                    if (optionName in optionInfomation && optionInfomation[optionName].usesArgument && optionInfomation[optionName].needsArgument) {
                        returnOptionsData.optionsArguments[optionName] = args[++returnOptionsData.lastOptionIndex]
                        needContinue = true
                    }
                } else {
                    returnOptionsData.invalidOption = optionName;
                }
            }
        } else if (arg.startsWith("-")) {
            returnOptionsData.lastOptionIndex++;
            for (let i = 1; i < arg.length; i++) {
                const optionName = `-${arg[i]}`;
                if (oneHyphenOptionsName.includes(optionName)) {
                    returnOptionsData.index[optionName] = optionsCount++;
                    if (optionName in optionInfomation && optionInfomation[optionName].needsArgument) {
                            if (i == arg.length - 1) {
                                returnOptionsData.optionsArguments[optionName] = args[++returnOptionsData.lastOptionIndex]
                                needContinue = true
                            } else {
                                returnOptionsData.optionsArguments[optionName] = arg.slice(i + 1);
                                break;
                            }
                    }
                } else {
                    returnOptionsData.invalidOption = optionName;
                    break;
                }
            }            
        }
    }
    for (const elem of [...twoHyphensOptionsName, ...oneHyphenOptionsName]) {
        if (returnOptionsData.index[elem] === undefined) {
            returnOptionsData.index[elem] = -1;
        }
    };
    return returnOptionsData;
}
