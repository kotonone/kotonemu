import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Emulator } from "packages/kernel/Emulator";
import ShalfeltOS from "@/os/index";

const term = new Terminal({
    fontFamily: "monospace",
    convertEol: true
});
term.open(document.body);

const { options, storage } = ShalfeltOS(term);
const emulator = new Emulator(options, storage);
emulator.run();
