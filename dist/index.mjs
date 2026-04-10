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
            verbose: false,
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
            if (this.#options.verbose) {
                console.log("ModBuilder initialized with the following configuration:");
                console.log("-> Package Info:", this.#packageInfo);
                console.log("-> Project Root:", this.#projectRoot);
                console.log("-> Output Directory:", this.#outDir);
                console.log("-> Archiver Globs:", this.#archiverGlobs);
                console.log("-> mod.txt Options:", this.#modTxtOptions);
                console.log("-> Build Options:", this.#options);
            }
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
            if (this.#options.verbose) {
                console.log(`Ensuring directory exists: ${dir}`);
            }
            await fs.promises.mkdir(dir, {
                recursive: true,
            });
        }
        // Replace any placeholders in the mod.txt file with the actual values from package.json,
        //  and write to a temp file that will be included in the zip.
        async createTempModTxt() {
            if (this.#options.verbose) {
                console.log("Initializing mod.txt");
            }
            let txtFile = "[mod]";
            txtFile += `\nname="${this.GetModName(undefined, false)}"`;
            txtFile += `\nid="${this.ModId}"`;
            txtFile += `\nversion="${this.#packageInfo.version}"`;
            // add in the autoloads section if there are any autoloads specified in the options
            if (Object.keys(this.#modTxtOptions.autoloads).length > 0) {
                let autoloadEntries = "\n\n[autoloads]";
                Object.entries(this.#modTxtOptions.autoloads).forEach(([autoloadName, autoloadPath]) => {
                    let fixedPath = `res://${this.GetModName()}/`;
                    if (!autoloadPath.startsWith(fixedPath))
                        fixedPath += autoloadPath;
                    else
                        fixedPath = autoloadPath;
                    if (!fixedPath.endsWith(".gd"))
                        fixedPath += ".gd";
                    autoloadEntries += `\n${autoloadName}=\"${fixedPath}\"`;
                });
                if (this.#options.verbose) {
                    console.log("Adding autoloads to mod.txt:");
                    console.log(autoloadEntries);
                }
                txtFile += autoloadEntries;
            }
            if (this.#modTxtOptions.modworkshopID) {
                let updatesSection = `\n\n[updates]`;
                updatesSection += `\nmodworkshop=${this.#modTxtOptions.modworkshopID}`;
                if (this.#options.verbose) {
                    console.log("Adding updates section to mod.txt:");
                    console.log(updatesSection);
                }
                txtFile += updatesSection;
            }
            await this.ensureDir(this.#TempPath);
            if (this.#options.verbose) {
                console.log(`Writing mod.txt to temporary path: ${this.#TempPath}`);
            }
            await fs.promises.writeFile(path.join(this.#TempPath, "mod.txt"), txtFile, "utf-8");
        }
        async zipDirectory() {
            return await new Promise(async (resolve, reject) => {
                const zipPath = this.GetBuildPath("zip");
                const pathPrefix = `${this.GetModName()}/`;
                const output = fs.createWriteStream(zipPath);
                const archive = archiver("zip", { zlib: { level: 9 } });
                if (this.#options.verbose) {
                    console.log(`Creating zip archive: ${zipPath}`);
                    console.log("Parsing glob patterns and adding files to archive...");
                }
                output.on("close", () => resolve(void 0));
                output.on("error", reject);
                archive.on("error", reject);
                archive.pipe(output);
                archive.file(path.join(this.#TempPath, "mod.txt"), {
                    name: "mod.txt",
                });
                const excludedGlobs = [
                    "**/mod.txt",
                    `${this.#outDir}/**`,
                    `${this.#TEMP_SUB_DIR}/**`,
                ];
                if (this.#archiverGlobs.length === 0) {
                    if (this.#options.verbose) {
                        console.log("-> No custom globs provided, including all files in project root except excluded globs:");
                        console.log(excludedGlobs);
                    }
                    archive.glob("**/*", {
                        cwd: this.#projectRoot,
                        ignore: excludedGlobs, // ignore build output and temp dir
                    }, { prefix: pathPrefix });
                }
                else {
                    if (this.#options.verbose) {
                        console.log(`-> Using ${this.#archiverGlobs.length} custom globs:`);
                        console.log(this.#archiverGlobs);
                    }
                    // if globs are provided, use those instead of globbing the entire directory
                    for (const glob of this.#archiverGlobs) {
                        const options = glob.options ?? {};
                        options.cwd ??= this.#projectRoot;
                        // todo: move this out of the loop
                        options.ignore ??= [];
                        if (typeof options.ignore === "string")
                            options.ignore = [options.ignore];
                        options.ignore.push(...excludedGlobs); // ignore build output and temp dir
                        if (this.#options.verbose) {
                            console.log(`-> Adding glob pattern: ${glob.pattern} with options:`, options);
                        }
                        archive.glob(glob.pattern, options, {
                            ...glob.data,
                            prefix: pathPrefix + (glob.data?.prefix ?? ""), // ensure the prefix is always added
                        });
                    }
                }
                if (this.#options.verbose) {
                    console.log("Finalizing archive...");
                }
                await archive.finalize();
                if (this.#options.verbose) {
                    console.log("Archive finalized, zip file created.");
                    console.log(`Removing temporary dir: "${this.#TempPath}" ...`);
                }
                // remove temp dir
                await fs.promises
                    .rm(this.#TempPath, {
                    force: true,
                    recursive: true,
                    maxRetries: 3,
                    retryDelay: 50,
                })
                    .catch((err) => {
                    console.warn(`Failed to delete temp directory: "${this.#TempPath}". Error:`, err);
                });
            });
        }
        async build() {
            if (this.#options.verbose) {
                console.log("Starting mod build process...");
                console.log("Calling onBuildStart callbacks...");
            }
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
                if (this.#options.verbose) {
                    console.log(`Build paths:`);
                    console.log(`-> Zip Path: ${zipPath}`);
                    console.log(`-> Final Path: ${finalPath}`);
                }
                await this.ensureDir(this.#BuildDir);
                if (this.#options.verbose) {
                    console.log("Removing all old build files...");
                }
                // remove old zip and final files if they exist
                if (fs.existsSync(zipPath))
                    await fs.promises.unlink(zipPath);
                if (fs.existsSync(finalPath))
                    await fs.promises.unlink(finalPath);
                if (this.#options.verbose) {
                    console.log("Creating mod.txt and zipping directory...");
                }
                await this.createTempModTxt();
                await this.zipDirectory();
                await fs.promises.rename(zipPath, finalPath);
                if (this.#options.verbose) {
                    console.log(`Built mod: ${finalPath}`);
                }
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
            if (this.#options.verbose) {
                console.log("Calling onBuildEnd callbacks...");
            }
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