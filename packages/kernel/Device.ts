import { Filesystem } from "./Filesystem";

export class Device {

}

export class Storage extends Device {
    /** ストレージに存在するパーティション */
    public partitions: Filesystem[];

    public constructor(partitions: Filesystem[]) {
        super();

        this.partitions = partitions;
    }
}
