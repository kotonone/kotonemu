<div align="center">
<h1>Kotonemu</h1>
A Linux Emulator for JavaScript
</div>

> [!IMPORTANT]
> Kotonemu is currently undergoing a major rewrite outside of GitHub.
> 
> The following features will be added in 0.3.0:
> * Full WebAssembly (WASI/WASIX) support
> * Various device support
>
> All existing applications will be replaced with WebAssembly. For testing purposes, uutils/coreutils will be used.
> In addition, the existing ShalfeltOS code will be deprecated. Other disruptive changes to the API are also planned.

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
* chmod, fchmod
* getuid, setuid
* getgid, setgid
* spawn
* exec

## For contributors
You can start the development server with the following command:
```
pnpm run dev
```
