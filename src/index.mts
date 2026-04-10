import * as fs from "fs";
import path from "path";
import archiver, { type Archiver } from "archiver";
import isValidPath from "is-valid-path";

//#region ModBuilder

/**
 * Builds a mod package for the game, including creating a mod.txt file with values from package.json, and zipping the contents into a .vmz file.
 * @param builderArgs The arguments for the mod builder, including package info, project root, output directory, and build options.
 * @returns A promise that resolves when the build is complete.
 */
export default async function modBuilder(builderArgs: ModBuilderArgs) {
  class ModBuilder {
    readonly #TEMP_SUB_DIR: string = "__temp_mod_build";

    readonly #packageInfo: ModPackageInfo = {
      id: "unnamed-mod",
      name: "unnamed-mod",
      version: "0.0.1",
    };

    readonly #callbacks: BuildOptionsCallbacks = {};

    readonly #projectRoot: string = "";

    readonly #outDir: string = "";

    readonly #archiverGlobs: ArchiverGlob[] = [];

    readonly #modTxtOptions: DeepRequired<ModTxtOptions> = {
      autoload: {},
      author: undefined,
      modworkshopID: undefined,
    };

    readonly #options: DeepRequired<BuildOptions> = {
      includeVersionInName: true,
      callbacks: {
        onBuildEnd: [],
        onBuildStart: [],
        onError: [],
      },
      verbose: false,
    };

    get #TempPath(): string {
      return path.join(this.#projectRoot, this.#TEMP_SUB_DIR);
    }

    get #BuildDir() {
      return path.join(this.#projectRoot, this.#outDir);
    }

    private get ModId() {
      return this.#packageInfo.id;
    }

    public constructor() {
      if (builderArgs.packageInfo?.id == "")
        throw new InvalidBuildOptionsError(
          "packageInfo.id cannot be an empty string",
        );
      if (builderArgs.packageInfo?.name == "")
        throw new InvalidBuildOptionsError(
          "packageInfo.name cannot be an empty string",
        );

      this.#projectRoot = builderArgs.projectRoot;
      this.#outDir = builderArgs.outDir ?? "build";

      this.#modTxtOptions = {
        autoload:
          builderArgs.modTxtOptions?.autoload ?? this.#modTxtOptions.autoload,
        modworkshopID:
          builderArgs.modTxtOptions?.modworkshopID ??
          this.#modTxtOptions.modworkshopID,
        author: builderArgs.modTxtOptions?.author ?? this.#modTxtOptions.author,
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

    private GetModName(
      extension: "zip" | "vmz" | undefined = undefined,
      includeVersion: boolean | undefined = this.#options.includeVersionInName,
    ) {
      const versionSuffix = includeVersion
        ? `_v${this.#packageInfo.version}`
        : "";
      const extensionSuffix = extension ? `.${extension}` : "";
      return `${this.#packageInfo.name}${versionSuffix}${extensionSuffix}`;
    }

    private GetBuildPath(
      extension: "zip" | "vmz",
      includeVersion: boolean | undefined = this.#options.includeVersionInName,
    ) {
      return path.join(
        this.#BuildDir,
        this.GetModName(extension, includeVersion),
      );
    }

    // Creates a directory if it doesn't exist.
    private async ensureDir(dir: string) {
      if (this.#options.verbose) {
        console.log(`Ensuring directory exists: ${dir}`);
      }
      await fs.promises.mkdir(dir, {
        recursive: true,
      });
    }

    // Replace any placeholders in the mod.txt file with the actual values from package.json,
    //  and write to a temp file that will be included in the zip.
    private async createTempModTxt() {
      if (this.#options.verbose) {
        console.log("Initializing mod.txt");
      }

      let txtFile = "[mod]";
      txtFile += `\nname="${this.GetModName(undefined, false)}"`;
      txtFile += `\nid="${this.ModId}"`;
      txtFile += `\nversion="${this.#packageInfo.version}"`;

      if (this.#modTxtOptions.author)
        txtFile += `\nauthor="${this.#modTxtOptions.author}"`;

      // add in the autoloads section if there are any autoloads specified in the options
      if (Object.keys(this.#modTxtOptions.autoload).length > 0) {
        let autoloadEntries = "\n\n[autoload]";

        Object.entries(this.#modTxtOptions.autoload).forEach(
          ([autoloadName, autoloadPath]) => {
            let fixedPath = `res://mods/${this.GetModName(undefined, false)}/`;

            if (!autoloadPath.startsWith(fixedPath)) fixedPath += autoloadPath;
            else fixedPath = autoloadPath;

            if (!fixedPath.endsWith(".gd")) fixedPath += ".gd";

            autoloadEntries += `\n${autoloadName}=\"${fixedPath}\"`;
          },
        );

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

      await fs.promises.writeFile(
        path.join(this.#TempPath, "mod.txt"),
        txtFile,
        "utf-8",
      );
    }

    private async zipDirectory() {
      return await new Promise(async (resolve, reject) => {
        const zipPath = this.GetBuildPath("zip", false);
        const pathPrefix = `mods/${this.GetModName(undefined, false)}/`;
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
            console.log(
              "-> No custom globs provided, including all files in project root except excluded globs:",
            );
            console.log(excludedGlobs);
          }

          archive.glob(
            "**/*",
            {
              cwd: this.#projectRoot,
              ignore: excludedGlobs, // ignore build output and temp dir
            },
            { prefix: pathPrefix },
          );
        } else {
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
              console.log(
                `-> Adding glob pattern: ${glob.pattern} with options:`,
                options,
              );
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
            console.warn(
              `Failed to delete temp directory: "${this.#TempPath}". Error:`,
              err,
            );
          });
      });
    }

    public async build() {
      if (this.#options.verbose) {
        console.log("Starting mod build process...");
        console.log("Calling onBuildStart callbacks...");
      }

      for (const callback of this.#options.callbacks.onBuildStart ?? []) {
        try {
          callback();
        } catch (error) {
          this.#callbacks.onError?.forEach((cb) => cb(error as Error));
        }
      }

      try {
        const zipPath = this.GetBuildPath("zip", false);
        const finalPath = this.GetBuildPath("vmz", false);

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
        if (fs.existsSync(zipPath)) await fs.promises.unlink(zipPath);
        if (fs.existsSync(finalPath)) await fs.promises.unlink(finalPath);

        if (this.#options.verbose) {
          console.log("Creating mod.txt and zipping directory...");
        }

        await this.createTempModTxt();
        await this.zipDirectory();
        await fs.promises.rename(zipPath, finalPath);

        if (this.#options.verbose) {
          console.log(`Built mod: ${finalPath}`);
        }
      } catch (error) {
        for (const callback of this.#options.callbacks.onError ?? []) {
          try {
            callback(error as Error);
          } catch (cbError) {
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
        } catch (error) {
          console.error("Error in onBuildEnd callback:", error);
        }
      }
    }
  }

  return await new ModBuilder().build();
}

//#endregion ModBuilder

//#region Errors

export class ModBuildError extends Error {}

export class InvalidBuildOptionsError extends ModBuildError {}

export class InvalidPathError extends ModBuildError {}

//#endregion Errors

//#region Types

export interface ModPackageInfo {
  /**
   * The mod's unique identifier.
   * Recommended to only use a-z, - and _ chars, preferably also prefixing with your name
   * or initials to avoid conflicts with other mods.
   */
  id: string;

  /**
   * The mod's display name. This is what will be shown in the mod manager and in-game.
   * Can include spaces and capitalization.
   */
  name: string;

  /**
   * The mod's version. This is what will be shown in the mod manager, and can optionally be included
   * in the output file names (e.g. "MyMod_v1.0.0.vmz").
   */
  version: string;
}

export interface BuildOptionsCallbacks {
  /** Called before the build process starts. */
  onBuildStart?: (() => void)[];

  /** Called after the build process completes successfully. */
  onBuildEnd?: (() => void)[];

  /** Called when an error occurs during the build process. */
  onError?: ((error: Error) => void)[];
}

export interface BuildOptions {
  /**
   * If true, the version from the packageInfo will be included in the output file names (e.g. "MyMod_v1.0.0.vmz").
   * Note that if the version is missing, this will insert version "0.0.1" into the name.
   * Defaults to true.
   */
  includeVersionInName?: boolean;

  /**
   * Optional callbacks for build events. See {@linkcode BuildOptionsCallbacks}.
   */
  callbacks?: BuildOptionsCallbacks;

  /**
   * If true, the builder will log additional information about the build process to the console. Defaults to false.
   */
  verbose?: boolean;
}

// sourced from archiver's params since they don't export their glob type
type ArchiverGlob = {
  pattern: string;
  options?: Parameters<Archiver["glob"]>[1];
  data?: Parameters<Archiver["glob"]>[2];
};

export interface ModTxtOptions {
  /**
   * Optional autoload entries to include in the mod.txt file.
   * Each entry should be an object with the name of the autoload as the key, and the path to the
   * script as the value (relative to the mod folder) -- i.e. { "MyMod": "relative/path/to/Main" }.
   * This maps to `MyMod="res://mods/ModName/relative/path/to/Main.gd"` in the [autoload] section of mod.txt.
   * The ".gd" extension will be added automatically if not included in the path.
   */
  autoload?: Record<string, string>;

  /**
   * The ID of the mod on ModWorkshop, used for the [updates] section of mod.txt.
   * If not provided, no [updates] section will be included in mod.txt.
   * It is included in the URL of the mod page, e.g. 49779 for modworkshop.net/mod/49779.
   */
  modworkshopID?: string | undefined;

  /**
   * Optional author name to include in the mod.txt file.
   */
  author?: string | undefined;
}

export interface ModBuilderArgs {
  /**
   * The mod package information, including id, name, and version.
   * See {@linkcode ModPackageInfo}.
   */
  packageInfo: ModPackageInfo;

  /**
   * The root directory of the project. This is used as the base for resolving relative paths
   * and as the source directory when globbing files to include in the zip.
   */
  projectRoot: string;

  /**
   * The directory where the final .vmz file will be created, relative to the project root.
   * Defaults to "build".
   * Will create this directory if it doesn't exist.
   */
  outDir?: string;

  /**
   * Optional array of glob patterns to specify which files to include in the zip.
   * If not provided, all files in the project root will be included (except build output, temp dir, and mod.txt).
   */
  globs?: ArchiverGlob[];

  /**
   * Options for generating the mod.txt file. See {@linkcode ModTxtOptions}.
   * If not provided, a minimal mod.txt will be generated using values from packageInfo.
   */
  modTxtOptions?: ModTxtOptions;

  /**
   * Additional build options. See {@linkcode BuildOptions}.
   */
  options?: BuildOptions;
}

// util type
type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : Required<T[P]>;
};

//#endregion Types
