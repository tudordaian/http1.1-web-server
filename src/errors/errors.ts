import {HTTPRes} from "../server/types/types";
import {readerFromMemory} from "../server/http/http_readers";

export class HTTPError extends Error {
    code: number

    constructor(code: number, message: string) {
        super(message)
        this.name = 'HTTPError'
        this.code = code
    }
}

export function resp404(): HTTPRes {
    return {
        code: 404,
        headers: [
            Buffer.from('Content-Type: text/plain')
        ],
        body: readerFromMemory(Buffer.from('404 Not Found\n'))
    };
}
