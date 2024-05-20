export enum OpenFlag {
    READ = 1 << 1,
    WRITE = 1 << 2,
}
export enum UnlinkFlag {
    REMOVE_DIR = 1 << 1,
}

// https://jp.xlsoft.com/documents/intel/cvf/vf-html/az/az11_89.htm
/** {@link Stat} の mode アクセス保護フィールドに付与される追加情報 */
export enum StatMode {
    /** ディレクトリである */
    IFDIR = 0o040000,
    /** キャラクタデバイスである */
    IFCHR = 0o020000,
    /** 通常ファイルである */
    IFREG = 0o100000,
    /** シンボリックリンクである */
    IFLNK = 0o120000
}

export enum StdReadFlag {
    /** 入力内容をエコーします。 */
    ECHO = 1 << 1,

    /** 改行が入力されるまで読み取ります。 */
    READ_LINE = 1 << 2,
}
