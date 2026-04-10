import { type Archiver } from "archiver";
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
export {};
//# sourceMappingURL=index.d.mts.map