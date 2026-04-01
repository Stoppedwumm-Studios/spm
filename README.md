# st-registry-cli (spm)

A lightweight command-line interface for the Stoppedwumm Studios Registry. Easily list, download, and clone packages directly from the command line.

## Installation

Since this is a CLI tool, it is recommended to install it globally via npm:

```bash
npm install -g st-registry-cli
```

Once installed, you can access the CLI using the `spm` command.

## Usage

### 1. Install a Package
Download a specific package from the registry. You can optionally specify a destination folder and a target version.

**Syntax:**
```bash
spm install <name> [destination] [version]
```

**Examples:**
```bash
# Download latest version to current directory
spm install my-package

# Download to a specific folder
spm install my-package ./downloads/

# Download a specific version
spm install my-package ./downloads/ v1.2.0
```
*Note: The CLI automatically handles file extensions (like `.zip`) based on the URL or GitHub API responses.*

### 2. Clone the Entire Registry
Downloads **all** modules and **all** available versions from the registry. It automatically organizes them into their defined folder paths and applies executable permissions (`chmod 755`) to raw binaries on Mac/Linux systems.

**Syntax:**
```bash
spm clone
```

### 3. List Available Packages
View a list of all currently available modules inside the Stoppedwumm Studios Registry.

**Syntax:**
```bash
spm ls
```

## Links
* **NPM:** [st-registry-cli](https://www.npmjs.com/package/st-registry-cli)
* **Repository:** [Stoppedwumm-Studios/spm](https://github.com/Stoppedwumm-Studios/spm)
* **Registry:** [st-registry](https://stoppedwumm-studios.github.io/st-registry/)

## License
ISC
