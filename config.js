import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".spm");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
    registryUrl: "https://stoppedwumm-studios.github.io/st-registry/index.json",
    tempDir: null, // Uses system temp if null
    cacheEnabled: true,
    cacheTTL: 3600000, // 1 hour in ms
};

/**
 * Ensures config directory exists
 */
function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

/**
 * Loads config from file or returns defaults
 */
export function loadConfig() {
    ensureConfigDir();
    
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
            return { ...DEFAULT_CONFIG, ...fileConfig };
        } catch (e) {
            console.warn("Failed to parse config file, using defaults");
            return DEFAULT_CONFIG;
        }
    }
    
    return DEFAULT_CONFIG;
}

/**
 * Saves config to file
 */
export function saveConfig(config) {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Gets a specific config value
 */
export function getConfigValue(key) {
    const config = loadConfig();
    return config[key];
}

/**
 * Sets a specific config value
 */
export function setConfigValue(key, value) {
    const config = loadConfig();
    config[key] = value;
    saveConfig(config);
}

/**
 * Gets the config file path
 */
export function getConfigPath() {
    return CONFIG_FILE;
}

/**
 * Gets the default config
 */
export function getDefaultConfig() {
    return DEFAULT_CONFIG;
}
