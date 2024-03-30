export enum OpenFlag {
    READ = 1 << 1,
    WRITE = 1 << 2,
}
export enum UnlinkFlag {
    REMOVE_DIR = 1 << 1,
}

export enum StdReadFlag {
    /** 入力内容をエコーします。 */
    ECHO = 1 << 1,

    /** 改行が入力されるまで読み取ります。 */
    READ_LINE = 1 << 2,
}
