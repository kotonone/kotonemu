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
