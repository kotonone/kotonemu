/** エミュレーターのエラー */
export class EmulatorError extends Error {
    constructor() {
        super();
        this.name = this.constructor.name;
        this.message = "General emulator error";
    }
}

/** パスに関するエラー */
export class PathError extends EmulatorError {
    constructor(message?: string) {
        super();
        this.message = message ?? "Path error";
    }
}

/** エミュレーターのシステムエラー */
export class OSError extends EmulatorError {
    constructor() {
        super();
        this.message = "Emulator system error";
    }
}

/** I/O エラー */
export class EIO extends OSError {
    constructor() {
        super();
        this.message = "IO error";
    }
}

/** 不正な実行ファイルフォーマットエラー */
export class ELIBBAD extends OSError {
    constructor(entryName: string) {
        super();
        this.message = "Invalid format: " + entryName;
    }
}

/** ファイルもしくはディレクトリが見つからなかったエラー */
export class ENOENT extends OSError {
    constructor(entryName: string) {
        super();
        this.message = "Entry not found: " + entryName;
    }
}

/** ディレクトリではないエラー */
export class ENOTDIR extends OSError {
    constructor(entryName: string) {
        super();
        this.message = "Not a directory: " + entryName;
    }
}

/** ディレクトリであるエラー */
export class EISDIR extends OSError {
    constructor(entryName: string) {
        super();
        this.message = "Is a directory: " + entryName;
    }
}

/** ディレクトリが空ではないエラー */
export class ENOTEMPTY extends OSError {
    constructor(entryName: string) {
        super();
        this.message = "Directory not empty: " + entryName;
    }
}

/** 有効でないファイルディスクリプタのエラー */
export class EBADFD extends OSError {
    constructor() {
        super();
        this.message = "Invalid file descriptor";
    }
}

/** 引数が異常であるエラー */
export class EINVAL extends OSError {
    constructor() {
        super();
        this.message = "Invalid argument";
    }
}

/** 権限が不足しているエラー */
export class EACCES extends OSError {
    constructor() {
        super();
        this.message = "Permission denied";
    }
}
