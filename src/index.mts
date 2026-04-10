import * as fs from "fs";
import path from "path";
import archiver, { type Archiver } from "archiver";
import isValidPath from "is-valid-path";

//#region ModBuilder

/**
 * Builds a mod by zipping the contents of the source directory, replacing placeholders in mod.txt with values from packageInfo,
 *  and outputting the final .vmz file to the build directory.
 *
 * The mod.txt file is required in the source directory, and should contain placeholders for {MOD_NAME}, {MOD_ID}, and {MOD_VERSION}.
 * If BuildOptions.includeFiles is provided, those files will be included in the zip at the root level (not inside the "src" folder).
 *
 * See the ./example folder for more info.
 * @param buildOptions
 * @returns
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

    readonly #modTxtPath: string = "";

    readonly #archiverGlobs: Exclude<ModBuilderArgs["globs"], undefined> = [];

    readonly #options: DeepRequired<BuildOptions> = {
      includeVersionInName: true,
      callbacks: {
        onBuildEnd: [],
        onBuildStart: [],
        onError: [],
      },
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
      this.#modTxtPath =
        (builderArgs.modTxtPath ?? "").replace("mod.txt", "") + "mod.txt"; // (yes this is a little lazy)

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
      await fs.promises.mkdir(dir, {
        recursive: true,
      });
    }

    // Replace any placeholders in the mod.txt file with the actual values from package.json,
    //  and write to a temp file that will be included in the zip.
    private async createTempModTxt() {
      const txtFileReplacements = {
        "{MOD_NAME}": this.GetModName(undefined, false), // exclude version
        "{MOD_ID}": this.ModId,
        "{MOD_VERSION}": this.#packageInfo.version,
      } as const;

      let content = await fs.promises.readFile(this.#modTxtPath, "utf-8");

      Object.entries(txtFileReplacements).forEach(([placeholder, value]) => {
        content = content.replaceAll(placeholder, value);
      });

      await this.ensureDir(this.#TempPath);

      await fs.promises.writeFile(
        path.join(this.#TempPath, "mod.txt"),
        content,
        "utf-8",
      );
    }

    private async zipDirectory() {
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
          archive.glob(
            "**/*",
            {
              cwd: this.#projectRoot,
              ignore: excludedGlobs, // ignore build output and temp dir
            },
            //{ prefix: "src" },
          );
        } else {
          // if globs are provided, use those instead of globbing the entire directory
          for (const glob of this.#archiverGlobs) {
            const options = glob.options ?? {};

            options.cwd = this.#projectRoot;

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
            console.warn(
              `Failed to delete temp directory: ${this.#TempPath}. Error:`,
              err,
            );
          });
      });
    }

    public async build() {
      this.#callbacks.onBuildStart?.forEach((callback) => callback());

      try {
        const zipPath = this.GetBuildPath("zip");
        const finalPath = this.GetBuildPath("vmz");

        await this.ensureDir(this.#BuildDir);

        // remove old zip and final files if they exist
        if (fs.existsSync(zipPath)) await fs.promises.unlink(zipPath);
        if (fs.existsSync(finalPath)) await fs.promises.unlink(finalPath);

        await this.createTempModTxt();
        await this.zipDirectory();
        await fs.promises.rename(zipPath, finalPath);

        console.log(`Built mod: ${finalPath}`);
      } catch (error) {
        this.#callbacks.onError?.forEach((callback) =>
          callback(error as Error),
        );
        throw error;
      } finally {
        this.#callbacks.onBuildEnd?.forEach((callback) => callback());
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
   * Should be lowercase, no spaces, and ideally include the author's name or initials to
   *  avoid conflicts with other mods.
   */
  id: string;

  /**
   * The mod's display name. This is what will be shown in the mod manager and in-game.
   * Can include spaces and capitalization.
   */
  name: string;

  /**
   * The mod's version. This is what will be shown in the mod manager, and can optionally be included
   *  in the zip and final file names.
   */
  version: string;
}

export interface BuildOptionsCallbacks {
  onBuildStart?: (() => void)[];
  onBuildEnd?: (() => void)[];
  onError?: ((error: Error) => void)[];
}

export interface BuildOptions {
  /**
   * If true, the version from the packageInfo will be included in the zip and final file names (e.g. "MyMod-1.0.0.zip").
   * Note that if the version is missing, this will insert version "0.0.1" into the name.
   * Defaults to true.
   */
  includeVersionInName?: boolean;

  /**
   * Optional callbacks for build events
   */
  callbacks?: BuildOptionsCallbacks;
}

// sourced from archiver's params since they don't export their glob type
type ArchiverGlob = {
  pattern: string;
  options?: Parameters<Archiver["glob"]>[1];
  data?: Parameters<Archiver["glob"]>[2];
};

export interface ModBuilderArgs {
  /**
   * The mod package information, can be specified here to override the values from package.json.
   * If not specified, will use the values from package.json.
   */
  packageInfo: ModPackageInfo;

  /**
   * The root directory of the project. This is used to resolve relative paths for sourceDir, buildDir, and tempDir.
   */
  projectRoot: string;

  /**
   * The directory where the zip file will be created.
   * Defaults to "./build" in the project root.
   * Will create this directory if it doesn't exist.
   */
  outDir?: string;

  /**
   * Optional path to a mod.txt file to use as a template. If not provided, the builder will look for mod.txt in the project root.
   * This file must contain the placeholders {MOD_NAME}, {MOD_ID}, and {MOD_VERSION} for the builder to replace with values from packageInfo.
   */
  modTxtPath?: string;

  /**
   * Optional array of glob patterns to specify which files to include in the zip.
   * If not provided, all files in the project root will be included (except those ignored by default).
   */
  globs?: ArchiverGlob[];

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
