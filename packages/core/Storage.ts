import { File, extractEntryNames } from ".";

/** ストレージクラス */
export class Storage {

    /** パス区切り文字 */
    public sep: string = "/";

    /** ファイルリスト */
    private _files: File[];

    public constructor(template: File[] = []) {
        this._files = template;
    }

    private _sanitize(pathname: string): string {
        const entryNames = extractEntryNames(pathname).filter((v, i) => !(i !== 0 && v === ""));

        let absolutePathname: string[] = [];

        for (const entry of entryNames) {
            if (entry === "") {
                continue;
            } else if (entry === ".") {
                // TODO: env.PWD を Process 側で解決
                /*
                if (absolutePathname.length === 0) {
                    absolutePathname.push(...extractEntryNames(this.env.PWD).slice(1));
                } else {
                    continue;
                }
                */
                // TODO: ユーザーディレクトリを Process 側で解決
            } else if (entry === "..") {
                absolutePathname.pop();
            } else {
                absolutePathname.push(entry);
            }
        }

        return ["", ...absolutePathname].join(this.sep);
    }

    /**
     * エントリを取得します。
     * @param pathname エントリパス
     */
    public get(pathname: string): Readonly<File> {
        return {};
    }

}
