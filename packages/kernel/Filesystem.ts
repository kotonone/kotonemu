import { File, IFile, isDirectory, isFilesystemFile, isSymbolicLink } from "./File";
import { EEXIST, EINVAL, ENOENT, ENOTDIR, ENOTEMPTY } from "./Error";
import { PATH_SEPARATOR, dirname, join, resolve } from "./Utils";
import { Process } from "./Process";

/** ファイルシステムクラス */
export class Filesystem {

    /** エントリ */
    public entries: Record<string, File>;

    public constructor(entries: Record<string, File> = {}) {
        this.entries = entries;

        this.entries[PATH_SEPARATOR] = {
            type: "directory",
            owner: 0,
            group: 0,
            mode: 0o555
        };
    }

    /**
     * 新しい {@link FilesystemSession} を取得します。
     */
    public getSession(process?: Process, root?: string): FilesystemSession {
        return new FilesystemSession(this, process, root);
    }

}

/** プロセスが参照するファイルシステムクラス */
export class FilesystemSession {

    private _fs: Filesystem;
    private _process?: Process;
    private _root: string;

    public constructor(fs: Filesystem, process?: Process, root?: string) {
        this._root = root ?? PATH_SEPARATOR;

        this._fs = fs;
        this._process = process;
    }

    /**
     * パス名が絶対パスであるかどうかを確認します。
     * @param pathname パス名
     */
    private _validate(pathname: string): void {
        if (pathname[0] !== PATH_SEPARATOR) throw new EINVAL();
        if (pathname.length !== 1 && pathname.at(-1) === PATH_SEPARATOR) throw new EINVAL();
    }

    /**
     * 新しい {@link FilesystemSession} を取得します。
     */
    public getSession(process: Process, root?: string): FilesystemSession {
        return new FilesystemSession(this._fs, process, root);
    }

    /**
     * エントリオブジェクトを取得します。
     * @param pathname エントリの絶対パス
     * @param [resolveSymlink=false] シンボリックリンクを解決するかどうか
     */
    public get(pathname: string | string[], resolveSymlink: boolean = false): IFile {
        const pathnameStr = typeof pathname === "string" ? pathname : PATH_SEPARATOR + join(...pathname);
        this._validate(pathnameStr);

        if (pathnameStr === PATH_SEPARATOR) return this._fs.entries[PATH_SEPARATOR];

        let pointer: string[] = resolve(this._root);
        for (const entryName of typeof pathname === "string" ? resolve(pathname) : pathname) {
            pointer.push(entryName);

            /** 処理中のエントリの内部ID */
            const entryAbsolutePath = PATH_SEPARATOR + pointer.join(PATH_SEPARATOR);
            /** まだループ内で処理していないパス */
            const pathLeft = pathnameStr.slice(entryAbsolutePath.length);

            if (entryAbsolutePath in this._fs.entries) {
                const entry = this._fs.entries[entryAbsolutePath];

                // NOTE: シンボリックリンクを解決
                if (resolveSymlink && isSymbolicLink(entry)) return this.get(entry.target + pathLeft);

                // NOTE: ファイルシステムの場合、そのファイルシステムを呼び出し
                if (isFilesystemFile(entry)) return entry.target.getSession(this._process).get(pathLeft.length === 0 ? PATH_SEPARATOR : pathLeft);

                if (pathLeft.length !== 0) {
                    if (isDirectory(entry)) {
                        // NOTE: まだ処理するパスが残っていて、現在参照中のエントリがディレクトリである場合、次へ
                        continue;
                    } else {
                        // NOTE: まだ処理するパスが残っているが、現在参照中のエントリがディレクトリでない場合、ENOTDIR エラーを出力
                        throw new ENOTDIR(entryAbsolutePath);
                    }
                }

                return entry;
            } else {
                break;
            }
        }
        throw new ENOENT(pathnameStr);
    }

    /**
     * エントリを作成します。
     * @param pathname 作成するエントリの絶対パス
     * @param entry エントリオブジェクト
     */
    public create<E extends File>(pathname: string, entry: E): this {
        this._validate(pathname);
        if (!isDirectory(this.get(dirname(pathname)))) throw new ENOTDIR(dirname(pathname));
        if (pathname in this._fs.entries) throw new EEXIST(pathname);

        this._fs.entries[pathname] = entry;

        return this;
    }

    /**
     * ディレクトリの内容を参照します。
     * @param pathname パス名
     */
    public list(pathname: string): string[] {
        this._validate(pathname);
        if (!isDirectory(this.get(pathname))) throw new ENOTDIR(pathname);

        const parentPath = pathname + PATH_SEPARATOR;

        return Object.keys(this._fs.entries)
            .filter(k => k.startsWith(parentPath))
            .map(k => k.slice(parentPath.length));
    }

    /**
     * エントリを削除します。
     * @param pathname 削除するエントリの絶対パス
     * @param [recursive=false] エントリがディレクトリの時、再帰的にエントリを削除するかどうか
     */
    public delete(pathname: string, recursive: boolean = false): this {
        this._validate(pathname);

        delete this._fs.entries[pathname];
        if (isDirectory(this.get(pathname))) {
            if (!recursive) throw new ENOTEMPTY(pathname);
            for (const entryNames of this.list(pathname)) {
                this.delete(pathname + PATH_SEPARATOR + entryNames);
            }
        }

        return this;
    }

}

/** ファイルシステムを作成するビルダークラス */
export class FilesystemBuilder {

    /** ファイルシステム */
    public filesystem: Filesystem;

    /** ファイルシステムセッション */
    public session: FilesystemSession;

    public constructor() {
        this.filesystem = new Filesystem();
        this.session = this.filesystem.getSession();
    }

    /**
     * エントリを作成します。
     * @param pathname 作成するエントリの絶対パス
     * @param entry エントリオブジェクト
     */
    public create<E extends File>(pathname: string, entry: E): this {
        this.session.create(pathname, entry);
        return this;
    }

}
