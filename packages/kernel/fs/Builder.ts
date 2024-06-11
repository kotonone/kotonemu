import { File } from "../File";
import { Filesystem, FilesystemSession } from "./Filesystem";

/** パーティションを作成するビルダークラス */
export class PartitionBuilder {

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
    public create(pathname: string, entry: File): this {
        this.session.create(pathname, entry);
        return this;
    }

}
