<div align="center">
<h1>Kotonemu</h1>
A Linux Emulator for JavaScript
</div>

## How to use
```ts
import { Emulator } from "kotonemu";
import ShalfeltOS from "kotonemu/os";

const { options, storage } = ShalfeltOS(xterm_terminal_object);
const emulator = new Emulator(options, storage);
emulator.run();
```

```
ShalfeltOS 0.1.0
Copyright (C) 2024 Kotonone and ShalfeltOS contributors

kotonepc login: a
Password: b
Last login: Wed Dec  9 04:09:57 on tty1
[kotone@kotonepc /]$
```

## Purpose
When you want to implement a Linux-like PC that can actually be operated by the user in software written in JavaScript.

For example, ... games that put a little too much emphasis on technology?

## Implemented system calls
* open
* close
* seek
* read
* write
* stat, fstat, lstat
* unlink
* mkdir
* readdir
* rmdir
* symlink
* readlink
* uname
* chown, fchown, lchown
* spawn
* exec

## For contributors
You can start the development server with the following command:
```
pnpm run dev
```
