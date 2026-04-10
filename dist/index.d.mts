import { type Archiver } from "archiver";
/**
 * Builds a mod package for the game, including creating a mod.txt file with values from package.json, and zipping the contents into a .vmz file.
 * @param builderArgs The arguments for the mod builder, including package info, project root, output directory, and build options.
 * @returns A promise that resolves when the build is complete.
 */
export default function modBuilder(builderArgs: ModBuilderArgs): Promise<void>;
export declare class ModBuildError extends Error {
}
export declare class InvalidBuildOptionsError extends ModBuildError {
}
export declare class InvalidPathError extends ModBuildError {
}
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
    /**
     * This determines the load order of mods, with lower values loading first.
     * If not provided, no priority will be included in mod.txt.
     */
    priority?: number | undefined;
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
export {};
//# sourceMappingURL=index.d.mts.map