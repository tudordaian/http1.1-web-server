export type DynBuf = {
    data: Buffer,
    length: number,
};

export type BodyReader = {
    // "Content-Length", -1 daca e necunoscut
    length: number,
    // read data, returneaza un Buffer gol dupa EOF
    read: () => Promise<Buffer>
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

