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
 * パス名をエントリ名の配列に変換します。
 * 二重のパス区切り文字・末尾のパス区切り文字は削除されます。
 * 先頭のパス区切り文字は削除されません。空の文字列が入ります。
 */
export function extractEntryNames(pathname: string): string[] {
    return pathname

        // NOTE: プレースホルダー化
        .replaceAll("$", "$dollar")
        .replaceAll("\\" + PATH_SEPARATOR, "$pathsep")

        // NOTE: プレースホルダーを復元
        .split(PATH_SEPARATOR).map(p => p
            .replaceAll("$dollar", "$")
            .replaceAll("$pathsep", PATH_SEPARATOR)
        )

        // NOTE: 二重パス区切り・末尾パス区切りを消去
        .filter((v, i) => !(i !== 0 && v === ""));
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
    return join(...extractEntryNames(pathname).slice(0, -1));
}
/** パス名からファイル名を取得します。 */
export function basename(pathname: string): string {
    return extractEntryNames(pathname).at(-1)!;
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

type oneHyphenOptionsList = (string | { id: string, needsArgument?: boolean })[];
type twoHyphensOptionsList = (string | { id: string, usesArgument?: boolean, needsArgument?: boolean })[];
type optionsData = { index: { [id: string]: number }, arguments: { [id: string]: unknown }, lastOptionIndex: number, invalidOption?: string };
/**
 * コマンドの引数からオプションについての情報を引き出します。  
 * オプションではない引数が見つかった時点で停止します。  
 * oneHyphen/twoHyphensに含まれないオプション・引数を受け付けないのに引数が含まれるオプションが見つかった場合はその時点で戻り値にinvalidOptionを含めてとして停止します。  
 * 
 * @param args オプションから始まる引数の配列
 * @param oneHyphen ハイフンが一つのオプションの配列
 * @param twoHyphens ハイフンが二つのオプションの配列
 * @returns オプションに関する情報(Object型)  
 * index: key:オプション名 value:オプションの順番(一番最初のオプションから重複ありで番号をつけ、一番最後のものを登録しています。)
 * arguments key:オプション名 value:オプションの引数(引数が用いられるオプションのみ、一番最後の引数を登録します。)
 * lastOptionIndex: argsのうちオプションである一番最後の引数の添字(オプションが含まれない場合は-1となります。)
 * invalidOption: 一番最初の不正なオプション
 */
export function parseOptions(args: string[], oneHyphen: oneHyphenOptionsList = [], twoHyphens: twoHyphensOptionsList = []) {
    const oneHyphenOptionsName = oneHyphen.map(e => (typeof e === "string") ? e : e.id);
    const twoHyphensOptionsName = twoHyphens.map(e => (typeof e === "string") ? e : e.id);
    const optionInfomation: { [key:string]: {usesArgument?: boolean, needsArgument?: boolean}} = {};
    for (const elem of twoHyphens.concat(oneHyphen)) {
        if (typeof elem === "string"){
            continue;
        } else {
            optionInfomation[elem.id] = {}
            if ("needsArgument" in elem) {
                optionInfomation[elem.id].needsArgument = elem.needsArgument
            }
            if ("usesArgument" in elem) {
                optionInfomation[elem.id].usesArgument = elem.usesArgument
            }
        }
    }

    const returnOptionsData: optionsData = { index:{}, arguments:{}, lastOptionIndex: -1};
    let optionsCount = 0;
    let needContinue = false
    for (const arg of args) {
        if (returnOptionsData.invalidOption) {
            break;
        } else if (needContinue) {
            needContinue = false;
            continue;
        } else if (!arg.startsWith("-") || arg === "--") {
            break;
        } else if (arg.startsWith("--")) {
            if (arg.includes("=")) {
                const optionName = arg.slice(0, arg.indexOf('='));
                if (twoHyphensOptionsName.includes(optionName) && optionName in optionInfomation && optionInfomation[optionName].usesArgument) {
                    returnOptionsData.index[optionName] = optionsCount++;
                    returnOptionsData.lastOptionIndex++;
                    returnOptionsData.arguments[optionName] = arg.replace(optionName + "=", "")
                } else {
                    returnOptionsData.invalidOption = optionName;
                }
            } else {
                const optionName = arg;
                if (twoHyphensOptionsName.includes(optionName)) {
                    returnOptionsData.index[optionName] = optionsCount++;
                    returnOptionsData.lastOptionIndex++;
                    if (optionName in optionInfomation && optionInfomation[optionName].usesArgument && optionInfomation[optionName].needsArgument) {
                        returnOptionsData.arguments[optionName] = args[++returnOptionsData.lastOptionIndex]
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
                                returnOptionsData.arguments[optionName] = args[++returnOptionsData.lastOptionIndex]
                                needContinue = true
                            } else {
                                returnOptionsData.arguments[optionName] = arg.slice(i + 1);
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