import { join } from "./Utils";
import { Device, Storage } from "./Device";
import { EACCES, ENOENT } from "./Error";
import { Directory, File, IFile } from "./File";
import { Filesystem, FilesystemSession } from "./Filesystem";
import { Process } from "./Process";

/*
NOTE: 実装されている機能における Linux との相違点

* ブートローダーは存在しません。
    Kotonemu は、 init が実行された時点からの挙動をエミュレーションするように作成されています。
* カーネルパラメータが大幅に変更されています。
    カーネルが読み込む init コマンドのパスなどを変更できます。
    これは、既存の Linux の形式に沿わない OS を作成する際に有用です。
* パーティションタイプは1つのみです。

* mkdir に recursive オプションが存在します。
* fork システムコールは存在しません。代わりに spawn システムコールを使用してください。
    このシステムコールは疑似的なものであり、プロセスを生成するためもしくは微小なタスクを別プロセスで行う必要があるときのみに使用するべきです。
* Linux での EBADF は EBADFD に名前が変更されています。
* readdir システムコールは独自のものに変更されています。
* uname で取得できる utsname 構造体は独自のものに変更されています。
    Linux におけるリリース番号を Kotonemu ではカーネルバージョンと呼称します。
* exec システムコールにおいて、　argv と envp の引数名と内容が変更されています。
*/

export interface BootOptions {
    kernel: {
        parameters: {
            /** カーネルに指定するホスト名 */
            "kernel.hostname": string;
            /** 動作しているOS */
            "kernel.ostype": string;
            /** 動作しているOSのバージョン */
            "kernel.osrelease": string;
            /** カーネルの起動後に実行される実行可能ファイル */
            "kernel.init": string;
            /** 疑似ブートローダーがブートフラグとして使用するファイルもしくはディレクトリのパス */
            "boot.flagentry": string;
            /** procfs がマウントされるディレクトリ */
            "fs.specialdir.proc": string;
            /** devfs がマウントされるディレクトリ */
            "fs.specialdir.dev": string;
            /** tmpfs がマウントされるディレクトリ */
            "fs.specialdir.tmp": string;
            /** sysfs がマウントされるディレクトリ */
            "fs.specialdir.sys": string;
        };
    };
}

/** 端末エミュレーター */
export class Emulator {

    public readonly PROCESS_DIRECTORY: string = "/proc";

    public storage: Directory = {
        type: "directory",
        owner: 0,
        group: 0,
        mode: 0o644
    };
    public devices: Device[] = [];

    public rootProcess = new Process(this, {
        id: 0,
        name: "kernel",
        tty: "",
        filesystem: new Filesystem({}).getSession(),
        env: {},
        uid: 0,
        gid: 0
    });
    public newPid: number = 1;

    public parameters: BootOptions["kernel"]["parameters"];

    public constructor(options: BootOptions, storage: Storage) {
        this.parameters = options.kernel.parameters;
        this.devices.push(storage);
    }

    /**
     * 起動可能なパーティションを検索します。
     */
    private _findBootablePartition(): Filesystem | null {
        // TODO: 起動順序
        for (const storage of this.devices.filter((d): d is Storage => d instanceof Storage)) {
            for (const partition of storage.partitions) {
                if (partition.getSession(this.rootProcess).get(this.parameters["boot.flagentry"])) return partition;
            }
        }
        return null;
    }

    /** エミュレーターの動作を開始します。 */
    public run() {
        // NOTE: ブート可能なパーティションを検索
        const partition = this._findBootablePartition();
        if (!partition) {
        // TODO: output to screen
            throw new Error("No bootable medium found!");
        }

        this.rootProcess.filesystem = partition.getSession(this.rootProcess);

        // NOTE: procfs を構築
        this.rootProcess.filesystem.create(this.parameters["fs.specialdir.proc"], {
            type: "filesystem",
            target: new class ProcFilesystem extends Filesystem {
                public override getSession(process?: Process | undefined, root?: string | undefined): FilesystemSession {
                    return new class ProcFilesystemSession extends FilesystemSession {
                        public override get(pathname: string | string[], resolveSymlink?: boolean): IFile {
                            throw new ENOENT(typeof pathname === "string" ? pathname : join(...pathname));
                        }
                        public override create<E extends File>(pathname: string, entry: E): this {
                            return this;
                        }
                        public override list(pathname: string): string[] {
                            return [];
                        }
                        public override delete(pathname: string, recursive?: boolean): this {
                            throw new EACCES();
                        }
                    }(this, process, root);
                }
            },
            owner: 0,
            group: 0,
            mode: 0o555
        });

        // NOTE: devfs を構築
        // NOTE: tmpfs を構築
        // NOTE: sysfs を構築

        this.rootProcess.spawn(async () => {
            await this.rootProcess.exec(this.parameters["kernel.init"]);
        });
    }
}
