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
type ArchiverGlob = {
    pattern: string;
    options?: Parameters<Archiver["glob"]>[1];
    data?: Parameters<Archiver["glob"]>[2];
};
export interface ModTxtOptions {
    /**
     * Optional path to a mod.txt file to use as a template. If not provided, the builder will look for mod.txt in the project root.
     * This file must contain the placeholders {MOD_NAME}, {MOD_ID}, and {MOD_VERSION} for the builder to replace with values from packageInfo.
     */
    path?: string;
    /**
     * Optional array of autoload entries to include in the mod.txt file.
     * Each entry should be an obj with the name of the autoload as the key, and the path to the
     *  script as the value (relative to the project root) -- i.e. { "MyMod": "relative/path/to/Main" }.
     * This maps to "MyMod="res://relative/path/to/Main.gd"" in the [autoloads] section of mod.txt.
     * The ".gd" extension will be added automatically if not included in the path.
     */
    autoloads?: Record<string, string>;
}
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
     * Optional array of glob patterns to specify which files to include in the zip.
     * If not provided, all files in the project root will be included (except those ignored by default).
     */
    globs?: ArchiverGlob[];
    /**
     * Optional path to a mod.txt file to use as a template. If not provided, the builder will look for mod.txt in the project root.
     * This file must contain the placeholders {MOD_NAME}, {MOD_ID}, and {MOD_VERSION} for the builder to replace with values from packageInfo.
     */
    modTxtOptions?: ModTxtOptions;
    /**
     * Additional build options. See {@linkcode BuildOptions}.
     */
    options?: BuildOptions;
}
export {};
//# sourceMappingURL=index.d.mts.map