import { File, IFile, isDirectory, isFilesystemFile, isSymbolicLink } from "./File";
import { EEXIST, EINVAL, ENOENT, ENOTDIR, ENOTEMPTY } from "./Error";
import { PATH_SEPARATOR, basename, dirname, join, resolve } from "./Utils";
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
     * 指定されたエントリのファイルシステム・パス・本体を検索します。
     * @param pathname このファイルシステムにおけるパス名
     */
    private _resolve(pathname: string | string[], resolveSymlink: boolean = false): { session: FilesystemSession; pathname: string; entry: File; } {
        if (typeof pathname === "string") {
            if (pathname[0] !== PATH_SEPARATOR) throw new EINVAL();
            if (pathname.length !== 1 && pathname.at(-1) === PATH_SEPARATOR) throw new EINVAL();
        }

        // NOTE: このセッションのルートを含めたパスを配列にする
        const pathnameArr = [resolve(this._root), typeof pathname === "string" ? resolve(pathname) : pathname].flat();

        for (let i = 0; i < pathnameArr.length; i++) {
            const entryId = PATH_SEPARATOR + join(...pathnameArr.slice(0, i + 1));

            if (entryId in this._fs.entries) {
                const entry = this._fs.entries[entryId];

                if (resolveSymlink && isSymbolicLink(entry)) {
                    return this._resolve([...resolve(entry.target), ...pathnameArr.slice(i + 1)], resolveSymlink);
                } else if (isFilesystemFile(entry)) {
                    return entry.target.getSession(this._process)._resolve(pathnameArr.slice(i + 1), resolveSymlink);
                } else if (i + 1 === pathnameArr.length) {
                    return {
                        session: this,
                        pathname: entryId,
                        entry,
                    };
                }
            } else {
                throw new ENOENT(PATH_SEPARATOR + join(...pathnameArr));
            }
        }

        return {
            session: this,
            pathname: "/",
            entry: this._fs.entries["/"]
        };
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
    public get(pathname: string | string[], resolveSymlink: boolean = false): File {
        return this._resolve(pathname, resolveSymlink).entry;
    }

    /**
     * エントリを作成します。
     * @param pathname 作成するエントリの絶対パス
     * @param entry エントリオブジェクト
     */
    public create<E extends File>(pathname: string, entry: E): this {
        const { session, pathname: p, entry: e } = this._resolve(dirname(pathname), true);

        if (!isDirectory(e)) throw new ENOTDIR(p);
        if (p + PATH_SEPARATOR + basename(pathname) in session._fs.entries) throw new EEXIST(pathname);

        if (session === this) {
            this._fs.entries[pathname] = entry;
        } else {
            session.create(p + PATH_SEPARATOR + basename(pathname), entry);
        }

        return this;
    }

    /**
     * ディレクトリの内容を参照します。
     * @param pathname パス名
     */
    public list(pathname: string): string[] {
        const { session, pathname: p, entry } = this._resolve(pathname);

        if (!isDirectory(entry)) throw new ENOTDIR(pathname);

        if (session === this) {
            return Object.keys(this._fs.entries)
                .filter(k => dirname(k) === pathname && k !== pathname)
                .map(basename);
        } else {
            return session.list(p);
        }
    }

    /**
     * エントリを削除します。
     * @param pathname 削除するエントリの絶対パス
     * @param [recursive=false] エントリがディレクトリの時、再帰的にエントリを削除するかどうか
     */
    public delete(pathname: string, recursive: boolean = false): this {
        const { session, pathname: p, entry } = this._resolve(pathname);

        if (!isDirectory(entry)) throw new ENOTDIR(pathname);

        if (session === this) {
            if (isDirectory(this.get(pathname))) {
                if (!recursive) throw new ENOTEMPTY(pathname);

                for (const entryNames of this.list(pathname)) {
                    this.delete(join(pathname, entryNames));
                }
            }

            delete this._fs.entries[pathname];
        } else {
            session.delete(p);
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
