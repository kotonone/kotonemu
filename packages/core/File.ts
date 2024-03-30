import { Process } from "./Process";

export interface File {
    name: string;
    owner: number;
    group: number;
    mode: number;
    deleted: boolean;
}

export interface RegularFile extends File {
    type: "regular-file";
    data: ArrayBuffer;
}

export interface ExecutableFile extends File {
    type: "executable-file";
    data?: ArrayBuffer;
    protected: boolean;

    onStart(this: Process, lib: {
        io: {
            read: (fd?: number, flag?: number) => Promise<string>;
            write: (val: string | Uint8Array, fd?: number) => void;
        },
        path: {
            absolute: (pathname: string) => string;
        }
    }): Promise<void>;
}

export interface DeviceFile extends File {
    type: "device";

    read(): ArrayBuffer | Promise<ArrayBuffer>;
    write(data: ArrayBuffer): void;
}

export interface SymbolicLink extends File {
    type: "symlink";

    target: string;
}

export interface Directory extends File {
    type: "directory";
    children: (RegularFile | ExecutableFile | DeviceFile | SymbolicLink | Directory)[];
}

export function getFileType(value: File): string {
    return "type" in value ? <string>value.type : "unknown";
}
export function isRegularFile(value: File): value is RegularFile {
    return getFileType(value) === "regular-file";
}
export function isExecutableFile(value: File): value is ExecutableFile {
    return getFileType(value) === "executable-file";
}
export function isDeviceFile(value: File): value is DeviceFile {
    return getFileType(value) === "device";
}
export function isSymbolicLink(value: File): value is SymbolicLink {
    return getFileType(value) === "symlink";
}
export function isDirectory(value: File): value is Directory {
    return getFileType(value) === "directory";
}
