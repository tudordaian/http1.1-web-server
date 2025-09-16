import stream from "node:stream";

// interfata de read/write from/to HTTP body
export type BodyReader = {
    // "Content-Length", -1 daca e necunoscut
    length: number,
    // read data, returneaza null ca EOF
    read: stream.Readable,
    // cleanup optional
    close?: () => Promise<void>,
}

export type HTTPReq = {
    method: string,
    uri: Buffer,
    version: string,
    headers: Buffer[],
}

export type HTTPRes = {
    code: number,
    headers: Buffer[]
    body: BodyReader,
}

