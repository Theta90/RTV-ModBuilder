# RTV ModBuilder

A tool for quickly packaging Road to Vostok mods.

---

## Overview

A Node.js-based "mod zipper" for quickly packaging Road to Vostok mods.
It automates the process of generating a `mod.txt` manifest file, and zipping all mod contents into a `.vmz` file.

---

## Usage

See [The example project](https://github.com/Theta90/RTV-ModBuilder-Example).
Most of the detailing is there... it'll be here eventually too :)

In your mod project, create an entry file (e.g. `index.js`) and call the `modBuilder` function imported from this tool:

```js
import { modBuilder } from "rtv-modbuilder";

await modBuilder({
  projectRoot: "",
  outDir: "build",

  packageInfo: {
    id: packageInfoJson.name,
    name: modName,
    version: packageInfoJson.version,
  },

  modTxtOptions: {
    autoload: { [`${modName}Main`]: "Main.gd" },
  },
});
```

---

## Requirements

- [Node.js](https://nodejs.org/) v18+
