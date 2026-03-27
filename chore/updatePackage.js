import p from "../package.json" assert { type: "json" };
import fs from "fs";
import { program } from "commander";

let packageData = p;

program.argument("<version>", "New version to set in package.json");

program.parse();

const version = program.args[0];

if (!version) {
    console.error("Please provide a version.");
    process.exit(1);
}

packageData.version = version;

fs.writeFileSync("package.json", JSON.stringify(packageData, null, 2));

console.log(`Updated package.json to version ${version}`);