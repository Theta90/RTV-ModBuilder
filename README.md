# RTV ModBuilder

A Node.js-based "mod zipper" for quickly packaging Road to Vostok mods.
It automates the process of generating a `mod.txt` manifest file, and zipping all mod contents into a `.vmz` file.
This is a very early version, and I am new to public package development, so expect some rough edges and missing features.
If you have any suggestions or want to contribute, please open an issue or a pull request!

## Setup

Install the RTV-ModBuilder as a dev dependency via:

```sh

npm i -D "github:Theta90/RTV-ModBuilder#main"

```

## Usage

For an actual example, see [the example project](https://github.com/Theta90/RTV-ModBuilder-Example).

In your mod project, create an entry file (e.g. `index.js`) and call the `modBuilder`
function imported from this tool. Run this script to generate the bundle.
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
  - `modworkshopID` — An optional numeric ID for the mod, used for RTV's mod workshop.
  - `priority` — Determines the load order of mods.

- **`options`** — Additional builder options:
  - `includeVersionInName` — Whether to append the version number to the output
    mod's name.
  - `callbacks` — An object of callback functions[] that can be used to hook into the build process.
    - `onBuildStart` — Each of these are called when the build starts.
    - `onBuildEnd` — Each of these are called when the build finishes successfully.
    - `onBuildError` — Each of these are called if an error occurs during the build.
  - `verbose` — Whether to enable verbose logging during the build.

## Minimal Example

```js
import { modBuilder } from "rtv-modbuilder";
import packageInfoJson from "./package.json" assert { type: "json" };

await modBuilder({
  projectRoot: "",
  outDir: "build",

  packageInfo: {
    id: packageInfoJson.name,
    name: packageInfoJson.displayName,
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

## Misc

It can be annoying to move the zip from the output dir to the mods folder, but you can use symlinks
to direct the mods folder directly to the mod itself. This link is a direct pointer towards the link target.
I've written how to do it in Windows below, but there is certainly a way to do it on Linux/MacOS too I'm sure.

```sh
mklink "C:\SteamLibrary\steamapps\common\Road to Vostok\mods\MyMod.vmz" "C\path\to\MyMod.vmz"
```

This command needs to be run in CMD, but it's doable in Powershell too (using a different method).
See [MSDocs](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/mklink)
for a detailed explanation on mklink.

