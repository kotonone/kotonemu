import { ExecutableFile } from "packages/kernel/File";

/**
 * アプリケーションの実行可能ファイルを作成します。
 * @param handler アプリケーションの内容
 */
export function generateApplicationFile(handler: ExecutableFile["onStart"]): ExecutableFile {
    return {
        type: "executable-file",
        owner: 0,
        group: 0,
        mode: 0o755,
        onStart: handler
    };
}
