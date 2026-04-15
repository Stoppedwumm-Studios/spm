#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import { download } from "./download.js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { Document } from "flexsearch";
import pkg from "./package.json" with { type: "json" };
import { spawn } from "child_process";
import os from "os";

program
    .name("spm")
    .description("A simple package manager for StoppedWumm Studios projects")
    .version(pkg.version);

/**
 * HELPER: Logic to find the correct version object and download URL
 */
async function getModuleInfo(name) {
    try {
        const response = await fetch("https://stoppedwumm-studios.github.io/st-registry/index.json");
        const modulesData = await response.json();
        const moduleEntry = modulesData.modules.find(m => m.name.toLowerCase() === name.toLowerCase());

        if (!moduleEntry) return null;

        const mjson = await (await fetch(moduleEntry.url)).json();
        return { entry: moduleEntry, details: mjson };
    } catch (e) {
        return null;
    }
}

// --- INSTALL COMMAND ---
program
    .command("install <name> [destination] [version]")
    .description("Downloads package")
    .action(async (name, destination, version) => {
        try {
            const info = await getModuleInfo(name);
            if (!info) {
                console.error(chalk.red(`Module "${name}" not found in registry.`));
                return;
            }

            const { entry, details } = info;
            let selectedVersion;

            if (Array.isArray(details.url)) {
                if (version) {
                    selectedVersion = details.url.find(v => v.versionRule.toLowerCase() === version.toLowerCase());
                } else {
                    selectedVersion = details.url[0];
                }
            } else {
                selectedVersion = details;
            }

            if (!selectedVersion || !selectedVersion.url) {
                console.error(chalk.red("Version or URL not found."));
                return;
            }

            const downloadUrl = selectedVersion.url;
            let extension = "";
            if (downloadUrl.includes("zipball") || downloadUrl.includes("/archive/")) {
                extension = ".zip";
            } else {
                const lastPart = downloadUrl.split('/').pop().split('?')[0];
                if (lastPart.includes(".")) {
                    const ext = lastPart.split('.').pop();
                    if (isNaN(ext)) extension = "." + ext;
                }
            }

            const finalDestination = destination || (entry.name + extension);
            console.log(chalk.blue(`Downloading to ${finalDestination}...`));
            await download(downloadUrl, finalDestination);
            console.log(chalk.green("Download complete!"));
        } catch (error) {
            console.error(chalk.red("An error occurred:"), error.message);
        }
    });

// --- CLONE COMMAND ---
program
    .command("clone")
    .description("Clones the entire registry using defined paths and all versions")
    .action(async function () {
        try {
            const response = await fetch("https://stoppedwumm-studios.github.io/st-registry/index.json");
            const modulesData = await response.json();
            const modules = modulesData.modules;

            for (const module of modules) {
                console.log(chalk.yellow(`\nProcessing module: ${module.name}`));
                const mjson = await (await fetch(module.url)).json();

                const targetDir = module.path;
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const versions = Array.isArray(mjson.url)
                    ? mjson.url
                    : [{ versionRule: "latest", url: mjson.url }];

                for (const v of versions) {
                    const downloadUrl = v.url;
                    const versionName = v.versionRule || "default";

                    let extension = "";
                    if (downloadUrl.includes("zipball") || downloadUrl.includes("/archive/")) {
                        extension = ".zip";
                    } else {
                        try {
                            const urlPath = new URL(downloadUrl).pathname;
                            const lastSegment = urlPath.split('/').pop();
                            if (lastSegment.includes(".")) {
                                const potentialExt = lastSegment.split('.').pop();
                                if (isNaN(potentialExt)) extension = "." + potentialExt;
                            }
                        } catch (e) {}
                    }

                    const safeVersionName = versionName.replace(/[/\\?%*:|"<>]/g, '-');
                    const fileName = `${module.name}-${safeVersionName}${extension}`;
                    const finalDestination = path.join(targetDir, fileName);

                    console.log(chalk.blue(`  -> Downloading [${versionName}] to ${finalDestination}...`));
                    try {
                        await download(downloadUrl, finalDestination);
                        if (extension === "" && process.platform !== "win32") {
                            fs.chmodSync(finalDestination, 0o755);
                        }
                    } catch (dlErr) {
                        console.error(chalk.red(`  Failed to download ${versionName}:`), dlErr.message);
                    }
                }
            }
            console.log(chalk.bold.green("\nRegistry cloning complete!"));
        } catch (error) {
            console.error(chalk.red("An error occurred:"), error.message);
        }
    });

// --- LS COMMAND ---
program
    .command("ls")
    .description("Lists all repositories in the registry")
    .option("-f, --filter <keyword>", "Filter modules by name or path")
    .action(async function ({ filter }) {
        try {
            const response = await fetch("https://stoppedwumm-studios.github.io/st-registry/index.json");
            const modulesData = await response.json();
            const modules = modulesData.modules;

            if (filter) {
                const index = new Document({
                    tokenize: "forward",
                    document: { id: "path", index: ["name", "path"] }
                });
                modules.forEach(m => index.add(m));
                const results = index.search(filter);
                const matchedPaths = new Set();
                results.forEach(res => res.result.forEach(id => matchedPaths.add(id)));
                const filteredModules = modules.filter(m => matchedPaths.has(m.path));

                if (filteredModules.length === 0) {
                    console.log(chalk.yellow(`No modules found matching "${filter}"`));
                    return;
                }
                console.log(chalk.bold.blue(`Modules matching filter "${filter}":`));
                filteredModules.forEach(m => console.log(chalk.green(`- ${m.path}: ${m.name}`)));
                return;
            }

            console.log(chalk.bold.blue("Available Modules in Registry:"));
            modules.forEach(m => console.log(chalk.green(`- ${m.path}: ${m.name}`)));
        } catch (error) {
            console.error(chalk.red("An error occurred:"), error.message);
        }
    });

// --- EXEC COMMAND ---
program
    .command("exec <module-name> [version] [args...]")
    .description("Execute a module from the registry with optional version and arguments")
    .action(async function (moduleName, version, args) {
        try {
            const info = await getModuleInfo(moduleName);
            if (!info) {
                console.error(chalk.red(`Module "${moduleName}" not found.`));
                return;
            }

            const { details } = info;
            let selectedVersion;
            let finalArgs = args || [];

            // --- Version Resolution Logic ---
            if (Array.isArray(details.url)) {
                // Check if the provided 'version' matches a versionRule in the JSON
                const foundVersion = version ? details.url.find(v => v.versionRule.toLowerCase() === version.toLowerCase()) : null;
                
                if (foundVersion) {
                    selectedVersion = foundVersion;
                } else {
                    // If the version provided isn't a valid version name, it's likely actually the first argument.
                    // Push it to the front of the args array and use the latest (index 0) version.
                    if (version) finalArgs.unshift(version);
                    selectedVersion = details.url[0];
                }
            } else {
                // If it's not an array, details is the version object
                if (version) finalArgs.unshift(version);
                selectedVersion = details;
            }

            if (!selectedVersion || !selectedVersion.url) {
                console.error(chalk.red("Could not resolve a download URL for this module."));
                return;
            }

            if (!selectedVersion.executable) {
                console.error(chalk.red("This module is not marked as executable."));
                return;
            }

            // --- Download ---
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spm-'));
            const tempFile = path.join(tempDir, path.basename(selectedVersion.url));
            
            console.log(chalk.blue(`Downloading [${selectedVersion.versionRule || 'latest'}] to: ${tempFile}`));
            await download(selectedVersion.url, tempFile);

            // --- Execute ---
            let child;
            if (selectedVersion.execType === "java") {
                console.log(chalk.yellow(`Launching Java with args: ${finalArgs.join(' ')}`));
                child = spawn("java", ["-jar", tempFile, ...finalArgs], { stdio: "inherit" });
            } else if (selectedVersion.execType === "osx" || selectedVersion.execType === "bin") {
                console.log(chalk.yellow(`Launching Binary with args: ${finalArgs.join(' ')}`));
                fs.chmodSync(tempFile, 0o755);
                child = spawn(tempFile, finalArgs, { stdio: "inherit" });
            } else {
                console.error(chalk.red(`Unsupported execType: ${selectedVersion.execType}`));
                fs.rmSync(tempDir, { recursive: true, force: true });
                return;
            }

            // --- Cleanup ---
            child.on("close", (code) => {
                console.log(chalk.blue(`\nModule execution finished with code ${code}`));
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch (e) {}
            });

            child.on("error", (err) => {
                console.error(chalk.red("Process Error:"), err.message);
                fs.rmSync(tempDir, { recursive: true, force: true });
            });

        } catch (error) {
            console.error(chalk.red("An error occurred:"), error.message);
        }
    });

program.parse();