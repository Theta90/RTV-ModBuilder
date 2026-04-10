# RTV ModBuilder

A Node.js-based "mod zipper" for quickly packaging Road to Vostok mods.
It automates the process of generating a `mod.txt` manifest file, and zipping all mod contents into a `.vmz` file.

## Setup

Install the RTV-ModBuilder as a dev dependency via:

```sh

npm i -D "github:Theta90/RTV-ModBuilder#main"

```

## Usage

See [The example project](https://github.com/Theta90/RTV-ModBuilder-Example).
Most of the detailing is there... it'll be here eventually too :)

In your mod project, create an entry file (e.g. `index.js`) and call the `modBuilder` 
function imported from this tool.
The index.js file must be tailored to each specific project. The following options should
be adjusted per project:

- **`projectRoot`** — The root directory of the mod, relative to this file.
  This is where the builder will look for files to include in the mod.
  It can be the same as the project root, or a subdirectory if you want to
  keep your source files separate from other project files.

- **`outDir`** — The directory where the built mod will be output (e.g., `"build"`).
  If the projectRoot is in a subdirectory, this will output in a subdir of that.
  
- **`packageInfo`** — Suggested to use the values from `package.json`:
  - `id` — The package `name` field, used as the mod's unique identifier.
  - `name` — The package `displayName` field, used as the human-readable mod name.
  - `version` — The package `version` field.

- **`globs`** — A list of glob patterns describing which source files to include.
  Each entry accepts an `options` object supporting `ignore` patterns and a `cwd`
  (working directory) to resolve files from. Adjust these to match your project's
  source structure. For more details, see [Archiver's docs](https://www.archiverjs.com/).

- **`modTxtOptions`** — Configuration for generating the mod's `mod.txt` file:
  - `autoload` — A map of autoload names to their corresponding script paths.
  - `author` — A custom field that can be populated if desired (probably want to!)

- **`options`** — Additional builder options:
  - `includeVersionInName` — Whether to append the version number to the output
  mod's name.
  - `verbose` — Whether to enable verbose logging during the build.

## Example

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
