#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import { download } from "./download.js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// --- INSTALL COMMAND (For individual downloads) ---
program
    .command("install <name> [destination] [version]")
    .description("Downloads package")
    .action(async function (name, destination, version) {
        try {
            const response = await fetch("https://stoppedwumm-studios.github.io/st-registry/index.json");
            const modulesData = await response.json();
            const modules = modulesData.modules;

            const module = modules.find(m => 
                m.name.toLowerCase() === name.toLowerCase()
            );

            if (!module) {
                console.error(chalk.red(`Module "${name}" not found in registry.`));
                return;
            }

            const mjson = await (await fetch(module["url"])).json();
            console.log("Found module under path:", chalk.bold(module["path"]));

            let selectedVersion;
            if (Array.isArray(mjson["url"])) {
                if (version) {
                    selectedVersion = mjson["url"].find(v => 
                        v.versionRule.toLowerCase() === version.toLowerCase()
                    );
                } else {
                    selectedVersion = mjson["url"][0];
                }
            } else if (typeof mjson["url"] === "string") {
                selectedVersion = { url: mjson["url"] };
            }

            if (selectedVersion) {
                const downloadUrl = selectedVersion.url;
                const extension = downloadUrl.includes("zipball")
                    ? ".zip"
                    : "." + downloadUrl.split(".").at(-1).split('?')[0];

                const finalDestination = destination || (module["name"] + extension);

                console.log(chalk.blue(`Downloading to ${finalDestination}...`));
                await download(downloadUrl, finalDestination);
                console.log(chalk.green("Download complete!"));
            } else {
                console.error(chalk.red(`Version "${version}" not found for this module.`));
            }

        } catch (error) {
            console.error(chalk.red("An error occurred:"), error.message);
        }
    });

// --- CLONE COMMAND (Downloads everything using registry paths) ---
program
    .command("clone")
    .description("Clones the entire registry using defined paths and all versions")
    .action(async function () {
        try {
            console.log(chalk.cyan("Fetching registry..."));
            const response = await fetch("https://stoppedwumm-studios.github.io/st-registry/index.json");
            const modulesData = await response.json();
            const modules = modulesData.modules;

            for (const module of modules) {
                console.log(chalk.yellow(`\nProcessing module: ${module.name}`));
                
                const mjson = await (await fetch(module.url)).json();
                
                // Create the directory based on the "path" key (e.g., "m/minecraft")
                const targetDir = module.path;
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Handle modules that have multiple versions
                const versions = Array.isArray(mjson.url) 
                    ? mjson.url 
                    : [{ versionRule: "latest", url: mjson.url }];

                for (const v of versions) {
                    const downloadUrl = v.url;
                    const versionName = v.versionRule || "default";
                    
                    // --- SMART EXTENSION DETECTION ---
                    const urlObj = new URL(downloadUrl);
                    const lastSegment = urlObj.pathname.split('/').pop();
                    
                    let extension = "";
                    const commonExts = ['zip', 'jar', 'exe', 'msi', 'dmg', 'json', 'apk', 'tar', 'gz', '7z'];

                    if (downloadUrl.includes("zipball") || downloadUrl.includes("/zip/")) {
                        extension = ".zip";
                    } else if (lastSegment.includes(".")) {
                        const parts = lastSegment.split('.');
                        const potentialExt = parts.pop().toLowerCase();
                        
                        // Check if it's a real extension or just a version number (like .1)
                        if (commonExts.includes(potentialExt) || isNaN(potentialExt)) {
                            extension = "." + potentialExt;
                        }
                    }

                    // --- FALLBACK GUESSING ---
                    // If no extension found, check for keywords in the URL
                    if (!extension) {
                        if (downloadUrl.toLowerCase().includes("installer")) extension = ".exe";
                        else if (downloadUrl.toLowerCase().includes("mac") || downloadUrl.toLowerCase().includes("osx")) extension = ".dmg";
                        else if (downloadUrl.toLowerCase().includes("json")) extension = ".json";
                    }

                    // Sanitize version name (remove slashes) to keep files inside the module folder
                    const safeVersionName = versionName.replace(/[/\\?%*:|"<>]/g, '-');
                    const fileName = `${module.name}-${safeVersionName}${extension}`;
                    
                    const finalDestination = path.join(targetDir, fileName);

                    console.log(chalk.blue(`  -> Downloading version [${versionName}] to ${finalDestination}...`));
                    
                    try {
                        await download(downloadUrl, finalDestination);
                    } catch (dlErr) {
                        console.error(chalk.red(`  Failed to download ${versionName}:`), dlErr.message);
                    }
                }
                console.log(chalk.green(`Successfully processed all versions for ${module.name}`));
            }
            console.log(chalk.bold.green("\nRegistry cloning complete!"));
        } catch (error) {
            console.error(chalk.red("An error occurred during cloning:"), error.message);
        }
    });

program.parse();