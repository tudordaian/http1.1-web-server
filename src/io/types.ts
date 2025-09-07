interface FileReadResult {
    bytesRead: number
    buffer: Buffer
}

interface FileReadOptions {
    buffer?: Buffer
    offset?: number | null
    length?: number | null
    position?: number | null
}

interface Stats {
    isFile(): boolean
    isDirectory(): boolean
    // ...
    size: number
}

interface FileHandle {
    read(options?: FileReadOptions): Promise<FileReadResult>
    close(): Promise<void>
    stat(): Promise<Stats>
}