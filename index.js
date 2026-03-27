#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import { download } from "./download.js";

program
    .command("install <name> [destination] [version]")
    .description("Downloads package")
    .action(async function (name, destination, version) {
        try {
            // 1. Fetch the registry
            const response = await fetch("https://stoppedwumm-studios.github.io/st-registry/index.json");
            const modulesData = await response.json();
            const modules = modulesData.modules;

            // 2. Find the module (Case-insensitive)
            const moduleKey = Object.keys(modules).find(key => 
                modules[key].name.toLowerCase() === name.toLowerCase()
            );

            if (!moduleKey) {
                console.error(chalk.red(`Module "${name}" not found in registry.`));
                return;
            }

            const module = modules[moduleKey];
            const mjson = await (await fetch(module["url"])).json();
            console.log("Found module under path:", chalk.bold(module["path"]));

            // 3. Determine which version to use
            let selectedVersion;

            if (Array.isArray(mjson["url"])) {
                if (version) {
                    // Find specific version
                    selectedVersion = mjson["url"].find(v => 
                        v.versionRule.toLowerCase() === version.toLowerCase()
                    );
                } else {
                    // Default to the first one if no version specified
                    selectedVersion = mjson["url"][0];
                }
            } else if (typeof mjson["url"] === "string") {
                // Handle cases where "url" might just be a string instead of an array
                selectedVersion = { url: mjson["url"] };
            }

            // 4. Execute download
            if (selectedVersion) {
                const downloadUrl = selectedVersion.url;
                
                // Determine extension logic
                const extension = downloadUrl.includes("zipball")
                    ? ".zip"
                    : "." + downloadUrl.split(".").at(-1);

                const finalDestination = destination || (module["name"] + extension);

                console.log(chalk.blue(`Downloading to ${finalDestination}...`));
                
                // Note: If download is async, you should probably 'await' it
                await download(downloadUrl, finalDestination);
                console.log(chalk.green("Download complete!"));
            } else {
                console.error(chalk.red(`Version "${version}" not found for this module.`));
            }

        } catch (error) {
            console.error(chalk.red("An error occurred:"), error.message);
        }
    });

program.parse();