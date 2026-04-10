import * as fs from "fs";
import path from "path";
import archiver, {} from "archiver";
import isValidPath from "is-valid-path";
//#region ModBuilder
/**
 * Builds a mod package for the game, including creating a mod.txt file with values from package.json, and zipping the contents into a .vmz file.
 * @param builderArgs The arguments for the mod builder, including package info, project root, output directory, and build options.
 * @returns A promise that resolves when the build is complete.
 */
export default async function modBuilder(builderArgs) {
    class ModBuilder {
        #TEMP_SUB_DIR = "__temp_mod_build";
        #packageInfo = {
            id: "unnamed-mod",
            name: "unnamed-mod",
            version: "0.0.1",
        };
        #callbacks = {};
        #projectRoot = "";
        #outDir = "";
        #archiverGlobs = [];
        #modTxtOptions = {
            path: "mod.txt",
            autoloads: {},
            modworkshopID: undefined,
        };
        #options = {
            includeVersionInName: true,
            callbacks: {
                onBuildEnd: [],
                onBuildStart: [],
                onError: [],
            },
        };
        get #TempPath() {
            return path.join(this.#projectRoot, this.#TEMP_SUB_DIR);
        }
        get #BuildDir() {
            return path.join(this.#projectRoot, this.#outDir);
        }
        get ModId() {
            return this.#packageInfo.id;
        }
        constructor() {
            if (builderArgs.packageInfo?.id == "")
                throw new InvalidBuildOptionsError("packageInfo.id cannot be an empty string");
            if (builderArgs.packageInfo?.name == "")
                throw new InvalidBuildOptionsError("packageInfo.name cannot be an empty string");
            this.#projectRoot = builderArgs.projectRoot;
            this.#outDir = builderArgs.outDir ?? "build";
            this.#modTxtOptions = {
                path: builderArgs.modTxtOptions?.path ?? "mod.txt",
                autoloads: builderArgs.modTxtOptions?.autoloads ?? this.#modTxtOptions.autoloads,
                modworkshopID: builderArgs.modTxtOptions?.modworkshopID ??
                    this.#modTxtOptions.modworkshopID,
            };
            this.#archiverGlobs = builderArgs.globs ?? [];
            if (!isValidPath(this.#projectRoot)) {
                throw new InvalidPathError("projectRoot is not a valid path");
            }
            if (!isValidPath(this.#outDir)) {
                throw new InvalidPathError("outDir is not a valid path");
            }
            this.#packageInfo = {
                ...this.#packageInfo,
                ...builderArgs.packageInfo,
            };
            this.#options = {
                ...this.#options,
                ...builderArgs.options,
                callbacks: {
                    ...this.#options.callbacks,
                    ...builderArgs.options?.callbacks,
                },
            };
        }
        GetModName(extension = undefined, includeVersion = this.#options.includeVersionInName) {
            const versionSuffix = includeVersion
                ? `_v${this.#packageInfo.version}`
                : "";
            const extensionSuffix = extension ? `.${extension}` : "";
            return `${this.#packageInfo.name}${versionSuffix}${extensionSuffix}`;
        }
        GetBuildPath(extension, includeVersion = this.#options.includeVersionInName) {
            return path.join(this.#BuildDir, this.GetModName(extension, includeVersion));
        }
        // Creates a directory if it doesn't exist.
        async ensureDir(dir) {
            await fs.promises.mkdir(dir, {
                recursive: true,
            });
        }
        // Replace any placeholders in the mod.txt file with the actual values from package.json,
        //  and write to a temp file that will be included in the zip.
        async createTempModTxt() {
            let txtFile = "[mod]";
            txtFile += `\nname="${this.GetModName(undefined, false)}"`;
            txtFile += `\nid="${this.ModId}"`;
            txtFile += `\nversion="${this.#packageInfo.version}"`;
            // add in the autoloads section if there are any autoloads specified in the options
            if (Object.keys(this.#modTxtOptions.autoloads).length > 0) {
                let autoloadEntries = "\n\n[autoloads]";
                Object.entries(this.#modTxtOptions.autoloads).forEach(([autoloadName, autoloadPath]) => {
                    let fixedPath = `res://`;
                    if (!autoloadPath.startsWith(fixedPath))
                        fixedPath += autoloadPath;
                    else
                        fixedPath = autoloadPath;
                    if (!fixedPath.endsWith(".gd"))
                        fixedPath += ".gd";
                    autoloadEntries += `\n${autoloadName}=\"${fixedPath}\"`;
                });
                txtFile += autoloadEntries;
            }
            if (this.#modTxtOptions.modworkshopID) {
                txtFile += `\n\n[updates]`;
                txtFile += `\nmodworkshop=${this.#modTxtOptions.modworkshopID}`;
            }
            await this.ensureDir(this.#TempPath);
            await fs.promises.writeFile(path.join(this.#TempPath, "mod.txt"), txtFile, "utf-8");
        }
        async zipDirectory() {
            return await new Promise(async (resolve, reject) => {
                const zipPath = this.GetBuildPath("zip");
                const output = fs.createWriteStream(zipPath);
                const archive = archiver("zip", { zlib: { level: 9 } });
                output.on("close", () => resolve(void 0));
                output.on("error", reject);
                archive.on("error", reject);
                archive.pipe(output);
                archive.file(path.join(this.#TempPath, "mod.txt"), {
                    name: "mod.txt",
                    prefix: "",
                });
                const excludedGlobs = [
                    "**/mod.txt",
                    `${this.#outDir}/**`,
                    `${this.#TEMP_SUB_DIR}/**`,
                ];
                if (this.#archiverGlobs.length === 0) {
                    archive.glob("**/*", {
                        cwd: this.#projectRoot,
                        ignore: excludedGlobs, // ignore build output and temp dir
                    });
                }
                else {
                    // if globs are provided, use those instead of globbing the entire directory
                    for (const glob of this.#archiverGlobs) {
                        const options = glob.options ?? {};
                        options.cwd ??= this.#projectRoot;
                        // todo: move this out of the loop
                        options.ignore ??= [];
                        if (typeof options.ignore === "string")
                            options.ignore = [options.ignore];
                        options.ignore.push(...excludedGlobs); // ignore build output and temp dir
                        archive.glob(glob.pattern, options, glob.data);
                    }
                }
                await archive.finalize();
                // remove temp dir
                await fs.promises
                    .rm(this.#TempPath, {
                    force: true,
                    recursive: true,
                    maxRetries: 3,
                    retryDelay: 50,
                })
                    .catch((err) => {
                    console.warn(`Failed to delete temp directory: ${this.#TempPath}. Error:`, err);
                });
            });
        }
        async build() {
            for (const callback of this.#options.callbacks.onBuildStart ?? []) {
                try {
                    callback();
                }
                catch (error) {
                    this.#callbacks.onError?.forEach((cb) => cb(error));
                }
            }
            try {
                const zipPath = this.GetBuildPath("zip");
                const finalPath = this.GetBuildPath("vmz");
                await this.ensureDir(this.#BuildDir);
                // remove old zip and final files if they exist
                if (fs.existsSync(zipPath))
                    await fs.promises.unlink(zipPath);
                if (fs.existsSync(finalPath))
                    await fs.promises.unlink(finalPath);
                await this.createTempModTxt();
                await this.zipDirectory();
                await fs.promises.rename(zipPath, finalPath);
                console.log(`Built mod: ${finalPath}`);
            }
            catch (error) {
                for (const callback of this.#options.callbacks.onError ?? []) {
                    try {
                        callback(error);
                    }
                    catch (cbError) {
                        console.error("Error in onError callback:", cbError);
                    }
                }
                throw error;
            }
            finally {
                for (const callback of this.#options.callbacks.onBuildEnd ?? []) {
                    try {
                        callback();
                    }
                    catch (error) {
                        console.error("Error in onBuildEnd callback:", error);
                    }
                }
            }
        }
    }
    return await new ModBuilder().build();
}
//#endregion ModBuilder
//#region Errors
export class ModBuildError extends Error {
}
export class InvalidBuildOptionsError extends ModBuildError {
}
export class InvalidPathError extends ModBuildError {
}
//#endregion Types
//# sourceMappingURL=index.mjs.map