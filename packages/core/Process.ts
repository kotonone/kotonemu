import { Emulator, EmulatorInfo } from "./Emulator";
import { EBADFD, ENOENT, ENOTDIR, EISDIR, EIO, ENOTEMPTY, ELIBBAD, EINVAL, EACCES } from "./Error";
import { IFile, Directory, isSymbolicLink, isDirectory, RegularFile, SymbolicLink, isRegularFile, isExecutableFile, isDeviceFile, File } from "./File";
import { OpenFlag, StatMode, StdReadFlag, UnlinkFlag } from "./Flags";
import { dirname, basename, join, generateFakeElfFile, concatArrayBuffer, PATH_SEPARATOR, resolve } from "./Utils";

/** ファイルの状態を示すインタフェース */
export interface Stat {
    /** ファイルのアクセス保護 */
    mode: number;
    /** ファイルの所有者 */
    owner: number;
    /** ファイルの所有グループ */
    group: number;
    /** ファイルサイズ */
    size: number;
}

export type FileDescriptorData = {
    /** ディスクリプタ ID */
    id: number;

    /** ファイルへのパス */
    pathname: string;

    /** ディスクリプタのフラグ */
    flags: OpenFlag;

    /** 読み込み / 書き込みを行うオフセット */
    offset: number;
};

/** プロセス定義インタフェース */
export interface ProcessInit {
    /** プロセス ID */
    id: number;

    /** プロセス名 */
    name: string;

    /** プロセスのカレントTTY */
    tty: string;

    /** ファイルディスクリプタ */
    fd?: FileDescriptorData[];

    /** プロセスに与えられた引数 */
    args?: string[];

    /** プロセスの環境変数 */
    env: Record<string, string>;
}

/** プロセス */
export class Process {

    private emulator: Emulator;

    /** プロセス ID */
    public id: number;

    /** プロセス名 */
    public name: string;

    /** プロセスのカレントTTY */
    public tty: string;

    /** ファイルディスクリプタ */
    public fd: FileDescriptorData[];

    /** 引数 */
    public args: string[];

    /** 環境変数 */
    public env: Record<string, string>;

    /** 子プロセス */
    public children: Process[];

    private newFdId: number = 0;

    public constructor(emulator: Emulator, process: ProcessInit) {
        this.emulator = emulator;
        this.id = process.id;
        this.name = process.name;
        this.tty = process.tty;
        this.fd = process.fd ?? [];
        this.children = [];
        this.args = process.args ?? [];
        this.env = process.env;
    }

    /**
     * ファイルディスクリプタデータを取得します。
     * @param fd ファイルディスクリプタ ID
     */
    private _requireFileDescriptorData(fd: number): Process["fd"][number] {
        const fdData = this.fd.find(f => f.id === fd);
        if (!fdData) throw new EBADFD();
        return fdData;
    }
    /**
     * ファイルディスクリプタを作成します。
     * @param pathname パス名
     * @param flags アクセスモード
     */
    private _createFileDescriptor(pathname: string, flags: OpenFlag): Process["fd"][number] {
        const fdData = {
            id: this.newFdId,
            pathname,
            offset: 0,
            flags
        };
        this.fd.push(fdData);
        this.newFdId++;
        return fdData;
    }
    /**
     * エントリ名を使用して子エントリを取得します。
     * @param entry 親エントリ
     * @param name 子エントリ名
     */
    private _getEntry(entry: Directory, name: string): IFile | null {
        const e = entry.children.find(e => e.name === name);
        if (e && e.deleted) return null;
        return e ?? null;
    }
    /**
     * パス名を使用してエントリを取得します。
     * @param pathname パス名
     * @param resolveSymlinkAsFile シンボリックリンクが参照された際、リンク先を参照するかどうか
     */
    private _getEntryFromPathname(pathname: string, resolveSymlinkAsFile: boolean = false): IFile {
        let pointer: IFile = this.emulator.storage;

        const entryNames = resolve(pathname, this.env.PWD);

        for (const p of entryNames) {
            if (isSymbolicLink(pointer)) {
                pointer = this._getEntryFromPathname(pointer.target);
            }
            if (!isDirectory(pointer)) {
                throw new ENOENT(pathname);
            }

            const entry: Directory | IFile | null = this._getEntry(pointer ?? this.emulator.storage, p);
            if (entry === null) {
                throw new ENOENT(pathname);
            } else {
                pointer = entry;
            }
        }

        if (resolveSymlinkAsFile && isSymbolicLink(pointer)) {
            pointer = this._getEntryFromPathname(pointer.target, true);
        }

        return pointer;
    }
    /**
     * エントリを作成します。
     * @param parent 作成するエントリの親エントリ
     * @param entry 作成するエントリオブジェクト
     */
    private _createEntry<E extends File>(parent: Directory | string, entry: E): void {
        const parentEntry = typeof parent === "string" ? this._getEntryFromPathname(parent) : parent;

        if (!isDirectory(parentEntry)) {
            throw new ENOTDIR(typeof parent === "string" ? parent : "(unknown path)/" + parent.name);
        }

        parentEntry.children.push(entry);
    }
    /**
     * 指定されたエントリにおいて、指定されたモードの権限が有効になっているか確認します。
     * @param entry エントリ
     * @param mode モード（0 - 7 で指定）
     */
    private _isPermitted(entry: IFile, mode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7): boolean {
        let owner_mode = entry.mode >> 6;
        let group_mode = (entry.mode | 0o700) - 0o700 >> 3;
        let other_mode = (entry.mode | 0o770) - 0o770;

        // TODO: owner/groupの識別ができるようになり次第、owner_modeを `entry.owner is me ? owner_mode : 0` にする
        let current_mode = owner_mode | group_mode | other_mode;

        return !!(current_mode & mode);
    }

    /**
     * ファイルディスクリプタを開きます。
     * @param pathname パス名
     * @param flags アクセスモード
     */
    public open(pathname: string, flags: OpenFlag = 0 as OpenFlag): number {
        let entry;
        try {
            entry = this._getEntryFromPathname(pathname, true);
        } catch (e) {
            if (flags & OpenFlag.WRITE && e instanceof ENOENT) {
                const parentEntry = this._getEntryFromPathname(dirname(pathname));
                if (!this._isPermitted(parentEntry, 0o2)) throw new EACCES();

                this._createEntry(dirname(pathname), <RegularFile>{
                    name: basename(pathname),
                    type: "regular-file",
                    // TODO: permission
                    owner: 0,
                    group: 0,
                    mode: 0o777,
                    deleted: false,
                    data: new ArrayBuffer(0)
                });

                entry = this._getEntryFromPathname(pathname, true);
            } else {
                throw e;
            }
        }

        // TODO: EACCES (flock)
        if (isDirectory(entry)) {
            throw new EISDIR(pathname);
        }

        if (flags & OpenFlag.READ && !this._isPermitted(entry, 0o4)) throw new EACCES();
        if (flags & OpenFlag.WRITE && !this._isPermitted(entry, 0o2)) throw new EACCES();

        const fd = this._createFileDescriptor(pathname, flags);
        this._createEntry(join(this.emulator.PROCESS_DIRECTORY, this.id.toString(), "fd"), <SymbolicLink>{
            name: fd.id.toString(),
            type: "symlink",
            owner: 0,
            group: 0,
            mode: 0o700,
            deleted: false,
            target: pathname
        });
        return fd.id;
    }

    /**
     * ファイルディスクリプタを閉じます。
     * @param fd ファイルディスクリプタ
     */
    public close(fd: number): void {
        this.unlink(join(this.emulator.PROCESS_DIRECTORY, this.id.toString(), "fd", fd.toString()));
        this.fd = this.fd.filter(f => f.id !== fd);

        // TODO: stdio はどうする？
    }

    /**
     * ファイルの読み込みオフセット位置を変更します。
     * @param fd ファイルディスクリプタ
     * @param offset オフセット位置
     */
    public seek(fd: number, offset: number): void {
        const fdd = this._requireFileDescriptorData(fd);
        // TODO: offset < 0 || offset > file.length
        fdd.offset = offset;
    }

    /**
     * ファイルディスクリプタから読み込みます。
     * @param fd ファイルディスクリプタ
     * @param count 読み込む最大サイズ
     */
    public async read(fd: number, count: number = Infinity): Promise<ArrayBuffer> {
        const fdd = this._requireFileDescriptorData(fd);

        if (!(fdd.flags & OpenFlag.READ)) {
            throw new EBADFD();
        }

        const entry = this._getEntryFromPathname(fdd.pathname, true);
        if (isDirectory(entry)) {
            throw new EISDIR(fdd.pathname);
        }

        if (isRegularFile(entry) || isExecutableFile(entry)) {
            if (!entry.data) entry.data = generateFakeElfFile();
            const data = entry.data.slice(fdd.offset, fdd.offset + count);
            this.seek(fd, fdd.offset + data.byteLength);
            return data;
        } else if (isDeviceFile(entry)) {
            return await entry.read();
        } else {
            throw new EIO();
        }
    }
    /**
     * ファイルディスクリプタに書き込みます。
     * @param fd ファイルディスクリプタ
     * @param buf 書き込むバッファ
     * @param count 書き込む最大サイズ
     */
    public write(fd: number, buf: ArrayBuffer, count: number = Infinity): void {
        const fdd = this._requireFileDescriptorData(fd);

        if (!(fdd.flags & OpenFlag.WRITE)) {
            throw new EBADFD();
        }

        const entry = this._getEntryFromPathname(fdd.pathname, true);
        if (isDirectory(entry)) {
            throw new EISDIR(fdd.pathname);
        }

        if (isRegularFile(entry)) {
            const data = buf.slice(0, count);
            entry.data = concatArrayBuffer(entry.data.slice(0, fdd.offset), data, entry.data.slice(fdd.offset));
            this.seek(fd, fdd.offset + data.byteLength);
        } else if (isDeviceFile(entry)) {
            entry.write(buf);
        } else {
            throw new EIO();
        }
    }

    private _stat(entry: IFile): Stat {
        let mode: number =
            (isDirectory(entry) ? StatMode.IFDIR : 0) |
            (isRegularFile(entry) ? StatMode.IFREG : 0) |
            (isDeviceFile(entry) ? StatMode.IFCHR : 0) |
            (isSymbolicLink(entry) ? StatMode.IFLNK : 0);

        return {
            mode: entry.mode | mode,
            owner: entry.owner,
            group: entry.group,
            size: 0, // TODO: size
            // TODO: ctime, atime, mtime
        };
    }
    /**
     * ファイルの状態を取得します。
     * @param pathname パス名
     */
    public stat(pathname: string): Stat {
        return this._stat(this._getEntryFromPathname(pathname, true));
    }
    /**
     * ファイルディスクリプタからファイルの状態を取得します。
     * @param fd ファイルディスクリプタ
     */
    public fstat(fd: number): Stat {
        const fdd = this._requireFileDescriptorData(fd);
        const entry = this._getEntryFromPathname(fdd.pathname);
        return this._stat(entry);
    }
    /**
     * ファイルの状態を取得します。シンボリックリンクの場合でも、リンクを解決しません。
     * @param pathname パス名
     */
    public lstat(pathname: string): Stat {
        return this._stat(this._getEntryFromPathname(pathname));
    }

    /**
     * ファイルに削除フラグを立てます。参照しているファイルディスクリプタが存在しない場合、エントリを削除します。
     * @param pathname パス名
     * @param flags フラグ
     */
    public unlink(pathname: string, flags: UnlinkFlag = 0 as UnlinkFlag): void {
        const entry = this._getEntryFromPathname(pathname);
        if (flags & UnlinkFlag.REMOVE_DIR) {
            if (!isDirectory(entry)) {
                throw new ENOTDIR(pathname);
            }

            entry.children.forEach(c => {
                c.deleted = true;
                // TODO: 子エントリに fd がある場合でも親だけ削除し参照が途切れてしまう、これでも fd がある場合維持ということになっているからよいか？
            });
        } else {
            if (isDirectory(entry)) {
                throw new EISDIR(pathname);
            }
        }

        entry.deleted = true;
    }

    /**
     * ディレクトリを作成します。
     * @param pathname パス名
     * @param mode アクセス権限
     * @param recursive 再帰的に作成するかどうか
     */
    public mkdir(pathname: string, mode: number, recursive: boolean = false): void {
        try {
            this._createEntry(dirname(pathname), <Directory>{
                name: basename(pathname),
                type: "directory",
                owner: 0,
                group: 0,
                mode,
                deleted: false,
                children: []
            });
        } catch (e) {
            if (recursive && e instanceof ENOENT) {
                this.mkdir(dirname(pathname), mode, recursive);
                this.mkdir(pathname, mode, recursive);
            } else {
                throw e;
            }
        }
    }
    /**
     * ディレクトリの中に存在するファイル名の一覧を取得します。
     * @param pathname パス名
     */
    public readdir(pathname: string): string[] {
        const entry = this._getEntryFromPathname(pathname, true);
        if (!isDirectory(entry)) {
            throw new ENOTDIR(pathname);
        }

        return entry.children.filter(c => !c.deleted).map(c => c.name);
    }
    /**
     * ディレクトリを削除します。
     * @param pathname パス名
     */
    public rmdir(pathname: string): void {
        const entry = this._getEntryFromPathname(pathname);
        if (!isDirectory(entry)) {
            throw new ENOTDIR(pathname);
        }

        if (entry.children.length > 0) {
            throw new ENOTEMPTY(pathname);
        }

        entry.deleted = true;
    }

    /**
     * ファイル名 linkpath で target へのシンボリックリンクを作成します。
     * @param target リンク先
     * @param linkpath シンボリックリンクの名前
     */
    public symlink(target: string, linkpath: string): void {
        this._createEntry(this.env.PWD, <SymbolicLink>{
            name: linkpath,
            type: "symlink",
            owner: 0,
            group: 0,
            mode: 0o777,
            deleted: false,
            target
        });
    }
    /**
     * シンボリックリンク pathname のリンク先を参照します。
     * @param pathname パス名
     */
    public readlink(pathname: string): string {
        const entry = this._getEntryFromPathname(pathname);
        if (isSymbolicLink(entry)) {
            return entry.target;
        } else {
            throw new EINVAL();
        }
    }

    /**
     * 稼働中のエミュレーターについての名前と情報を取得します。
     */
    public uname(): EmulatorInfo {
        return this.emulator.info;
    }

    private _chown(entry: IFile, owner: number, group: number): void {
        entry.owner = owner;
        entry.group = group;
    }
    /**
     * ファイルの所有権を変更します。
     * @param pathname パス名
     * @param owner ユーザー ID (UID)
     * @param group グループ ID (GID)
     */
    public chown(pathname: string, owner: number, group: number): void {
        return this._chown(this._getEntryFromPathname(pathname, true), owner, group);
    }
    /**
     * ファイルディスクリプタからファイルの所有権を変更します。
     * @param fd ファイルディスクリプタ
     * @param owner ユーザー ID (UID)
     * @param group グループ ID (GID)
     */
    public fchown(fd: number, owner: number, group: number): void {
        const fdd = this._requireFileDescriptorData(fd);
        const entry = this._getEntryFromPathname(fdd.pathname);
        return this._chown(entry, owner, group);
    }
    /**
     * ファイルの所有権を変更します。シンボリックリンクの場合でも、リンクを解決しません。
     * @param pathname パス名
     * @param owner ユーザー ID (UID)
     * @param group グループ ID (GID)
     */
    public lchown(pathname: string, owner: number, group: number): void {
        return this._chown(this._getEntryFromPathname(pathname), owner, group);
    }

    /**
     * プロセスを新しく生成します。
     * @param callback 実行するマイクロプロセス
     */
    public async spawn(callback: (this: Process) => Promise<unknown>): Promise<void> {
        const process = new Process(this.emulator, {
            id: this.emulator.newPid,
            name: "New Process",
            tty: this.tty,
            env: this.env
        });
        this.emulator.newPid++;
        this.children.push(process);

        const processDir = join(this.emulator.PROCESS_DIRECTORY, process.id.toString());

        process.mkdir(join(processDir, "fd"), 0o555, true);
        // TODO: /proc/self
        // TODO: /proc 配下を動的に生成
        // TODO: /proc/self/fdinfo
        process.open(process.tty, OpenFlag.READ);
        process.open(process.tty, OpenFlag.WRITE);
        process.open(process.tty, OpenFlag.WRITE);

        await callback.bind(process)();
        this.children = this.children.filter(p => p.id !== process.id);

        this.unlink(processDir, UnlinkFlag.REMOVE_DIR);
    }

    /**
     * 現在のプロセスで実行可能ファイルを実行します。
     * @param pathname パス名
     * @param args 引数
     * @param env 環境変数
     */
    public async exec(pathname: string, args: string[] = [], env: Record<string, string> = {}): Promise<any> {
        const entry = this._getEntryFromPathname(pathname, true);

        this.name = pathname;
        // TODO: deep copy
        this.args = args;
        this.env = { ...this.env, ...env };

        if (isExecutableFile(entry)) {
            // TODO: permission check

            const p = this;
            await entry.onStart.bind(this)({
                io: {
                    async read(fd = 0, flag = StdReadFlag.ECHO | StdReadFlag.READ_LINE) {
                        const instance = new ReadInstance();
                        while (true) {
                            const rawVal = new Uint8Array(await p.read(fd));
                            let strVal = new TextDecoder("utf-8").decode(rawVal);

                            if (flag & StdReadFlag.READ_LINE) {
                                const response = instance.process(rawVal);

                                if (flag & StdReadFlag.ECHO) {
                                    this.write(response);
                                }

                                if (instance.hasEnded) {
                                    if (!(flag & StdReadFlag.ECHO)) {
                                        this.write("\n");
                                    }
                                    return instance.line;
                                }
                            } else {
                                if (flag & StdReadFlag.ECHO) {
                                    this.write(strVal);
                                }

                                return strVal;
                            }
                        }
                    },
                    write(val, fd = 1) {
                        p.write(fd, typeof val === "string" ? new TextEncoder().encode(val) : val);
                    },
                },
                path: {
                    absolute: (pathname: string) => PATH_SEPARATOR + join(...resolve(pathname, this.env.PWD))
                }
            });
        } else if (isRegularFile(entry)) {
            // TODO: interpreter script
        } else {
            throw new ELIBBAD(pathname);
        }
    }

}

/** 行読み込みインスタンス */
export class ReadInstance {
    /** バッファ */
    public buffer: { forward: string; backward: string; };
    /** 読み込みが完了したかどうか */
    public hasEnded: boolean;

    public constructor() {
        this.buffer = {
            forward: "",
            backward: ""
        };
        this.hasEnded = false;
    }

    process(value: ArrayBuffer): string {
        const binValue = new Uint8Array(value);
        const chars = [
            ...new TextDecoder("utf-8").decode(binValue)

                // NOTE: 改行コードの吸収
                .replaceAll("\r\n", "\n")
                .replaceAll("\r", "\n")
        ];

        /** エコー文字列 */
        let response = "";
        /** 文字列が消去された等の理由で、右端を空白で埋める必要がある文字数（半角を単位とする） */
        let shiftCount = 0;

        const write = (char: string): void => {
            response += char;
        };
        const bell = (char: string = "\x07"): void => {
            if (!response.includes(char)) response += char;
        };
        const getLength = (str: string): number => {
            // TODO: 2バイト文字対応
            return str.length;
        }

        while (chars.length !== 0) {
            const read = (push: boolean = true): string | undefined => {
                const char = chars.shift();
                if (char === "\x7F" || char === "\x08") {
                    if (this.buffer.backward.length === 0) {
                        bell();
                    } else {
                        // NOTE: サロゲートペアを正しく処理できないので、Unicode オプションを使用した正規表現を用いてバッファの処理を行う
                        const removingChar = this.buffer.backward.match(/(.)$/u)![0];
                        this.buffer.backward = this.buffer.backward.replace(/.$/u, "");

                        const length = getLength(removingChar);
                        shiftCount += length;
                        write(`\x1B[${length}D`);
                    }
                } else if (char === "\x1B") {
                    if (read(false) === "[") {
                        // NOTE: エスケープシーケンスの処理
                        let args: string = "";
                        let command: string | undefined = undefined;
                        while (!command) {
                            const sequenceChar = read(false);
                            if (!sequenceChar) break;

                            const sequenceCharCode = sequenceChar.charCodeAt(0);
                            if (sequenceChar === ";" || 48 <= sequenceCharCode && sequenceCharCode <= 57) {
                                args += sequenceChar;
                            } else {
                                command = sequenceChar;
                            }
                        }

                        if (command === "A" || command === "B") {
                            // TODO: A: Up, B: Down
                        } else if (command === "C") {
                            // NOTE: Right
                            if (this.buffer.forward.length === 0) {
                                bell();
                            } else {
                                const movingChar = this.buffer.forward.match(/^(.)/u)![0];
                                this.buffer.backward += movingChar;
                                this.buffer.forward = this.buffer.forward.replace(/^./u, "");
                                write("\x1B[" + getLength(movingChar) + command);
                            }
                        } else if (command === "D") {
                            // NOTE: Left
                            if (this.buffer.backward.length === 0) {
                                bell();
                            } else {
                                const movingChar = this.buffer.backward.match(/(.)$/u)![0];
                                this.buffer.forward = movingChar + this.buffer.forward;
                                this.buffer.backward = this.buffer.backward.replace(/.$/u, "");
                                write("\x1B[" + getLength(movingChar) + command);
                            }
                        } else if (command === "H") {
                            // NOTE: Home
                            if (this.buffer.backward.length === 0) {
                                bell();
                            } else {
                                const length = getLength(this.buffer.backward);
                                this.buffer.forward = this.buffer.backward + this.buffer.forward;
                                this.buffer.backward = "";
                                write(`\x1B[${length}D`);
                            }
                        } else if (command === "F") {
                            // NOTE: End
                            if (this.buffer.forward.length === 0) {
                                bell();
                            } else {
                                const length = getLength(this.buffer.forward);
                                this.buffer.backward = this.buffer.backward + this.buffer.forward;
                                this.buffer.forward = "";
                                write(`\x1B[${length}C`);
                            }
                        } else {
                            console.log(command, args);
                        }
                    }
                } else if (char === "\n") {
                    // TODO: [改行][バックスペースキー] のパターンも存在する
                    this.hasEnded = true;
                    write(char);
                } else {
                    if (push) this.buffer.backward += char;
                    if (char && push) write(char);
                }
                return char;
            };
            read();
            // console.log(this.buffer.backward + "|" + this.buffer.forward);
            if (this.hasEnded) break;
        }

        return response + (this.buffer.forward.length + shiftCount > 0 ? this.buffer.forward + " ".repeat(shiftCount) + `\x1B[${this.buffer.forward.length + shiftCount}D` : "");
    }

    public get line(): string {
        return this.buffer.backward + this.buffer.forward;
    }
}
