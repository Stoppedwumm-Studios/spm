import { writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'

export async function download(url, path) {
    const response = await fetch(url)
    await writeFile(path, Readable.fromWeb(response.body))
}