import { ExecutableFile } from "@/core/File";

/**
 * アプリケーションの実行可能ファイルを作成します。
 * @param name 名前
 * @param handler アプリケーションの内容
 */
export function generateApplicationFile(name: string, handler: ExecutableFile["onStart"]): ExecutableFile {
    return {
        name,
        type: "executable-file",
        owner: 0,
        group: 0,
        mode: 0o755,
        deleted: false,
        protected: false,
        onStart: handler
    };
}
