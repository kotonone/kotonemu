import { Directory } from "./File";
import { UnlinkFlag } from "./Flags";
import { Process } from "./Process";
import { join } from "./Utils";

/*
NOTE: 実装されている機能における Linux との相違点

* mkdir に recursive オプションが存在します。
* fork システムコールは存在しません。代わりに spawn システムコールを使用してください。
    このシステムコールは疑似的なものであり、プロセスを生成するためもしくは微小なタスクを別プロセスで行う必要があるときのみに使用するべきです。
* Linux での EBADF は EBADFD に名前が変更されています。
* readdir システムコールは独自のものに変更されています。
* uname で取得できる utsname 構造体は独自のものに変更されています。
    Linux におけるリリース番号を Kotonemu ではカーネルバージョンと呼称します。
* exec システムコールにおいて、　argv と envp の引数名と内容が変更されています。
*/

export interface EmulatorInit {
    info?: EmulatorInfo;
}

/** エミュレーター情報インタフェース */
export interface EmulatorInfo {
    /** マシン名 */
    nodename: string;

    /** OS名 */
    os_name: string;

    /** OS バージョン */
    os_version: string;
}

/** 端末エミュレーター */
export class Emulator {

    public readonly PROCESS_DIRECTORY: string = "/proc";
    public readonly SYSTEM_BIN_DIRECTORY: string = "/sbin";
    public readonly DEFAULT_TTY: string = "/dev/tty1";

    public storage: Directory = {
        name: "root",
        type: "directory",
        children: [],
        owner: 0,
        group: 0,
        mode: 0o644,
        deleted: false
    };

    public rootProcess = new Process(this, {
        id: 0,
        name: "kernel",
        tty: this.DEFAULT_TTY,
        env: {
            PWD: "/"
        }
    });
    public newPid: number = 1;

    /** エミュレーター情報 */
    public info: EmulatorInfo;

    public constructor(config: EmulatorInit, storage: Directory["children"]) {
        this.info = config.info ?? <EmulatorInfo>{
            nodename: "kotonemu",
            os_name: "Kotonemu",
            os_version: "1.0.0"
        };
        this.storage.children = storage;
    }

    /** エミュレーターの動作を開始します。 */
    public run() {
        try {
            this.rootProcess.unlink(this.PROCESS_DIRECTORY, UnlinkFlag.REMOVE_DIR);
        } catch {}
        this.rootProcess.mkdir(this.PROCESS_DIRECTORY, 0o555, true);

        const emulatorThis = this;
        this.rootProcess.spawn(async function () {
            this.exec(join(emulatorThis.SYSTEM_BIN_DIRECTORY, "init"));
        })
    }
}
