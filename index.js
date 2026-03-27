#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import { download } from "./download.js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// --- INSTALL COMMAND ---
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
                let extension = "";
                
                // 1. Check if it's a GitHub API zipball
                if (downloadUrl.includes("zipball") || downloadUrl.includes("/archive/")) {
                    extension = ".zip";
                } else {
                    // 2. Extract extension from filename if it exists
                    const lastPart = downloadUrl.split('/').pop().split('?')[0];
                    if (lastPart.includes(".")) {
                        const ext = lastPart.split('.').pop();
                        if (isNaN(ext)) extension = "." + ext;
                    }
                }

                const finalDestination = destination || (module["name"] + extension);
                console.log(chalk.blue(`Downloading to ${finalDestination}...`));
                await download(downloadUrl, finalDestination);
                console.log(chalk.green("Download complete!"));
            }
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
                    
                    // --- REFINED EXTENSION LOGIC (No guessing) ---

                    // 1. If it's a GitHub API Zipball, it's a .zip
                    if (downloadUrl.includes("zipball") || downloadUrl.includes("/archive/")) {
                        extension = ".zip";
                    } 
                    // 2. If the URL filename has an extension (like .jar or .zip), use it
                    else {
                        try {
                            const urlPath = new URL(downloadUrl).pathname;
                            const lastSegment = urlPath.split('/').pop();
                            
                            if (lastSegment.includes(".")) {
                                const potentialExt = lastSegment.split('.').pop();
                                // Ensure it's not a version number (like v1.2.1 ending in .1)
                                if (isNaN(potentialExt)) {
                                    extension = "." + potentialExt;
                                }
                            }
                        } catch (e) {
                            // Fallback if URL is malformed
                        }
                    }

                    // 3. Build filename
                    // Result: "hyperPatchClient-v1.2.1" (No .dmg added!)
                    const safeVersionName = versionName.replace(/[/\\?%*:|"<>]/g, '-');
                    const fileName = `${module.name}-${safeVersionName}${extension}`;
                    const finalDestination = path.join(targetDir, fileName);

                    console.log(chalk.blue(`  -> Downloading [${versionName}] to ${finalDestination}...`));
                    
                    try {
                        await download(downloadUrl, finalDestination);
                        
                        // Set execution permissions for raw binaries on Mac/Linux
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

program.parse();