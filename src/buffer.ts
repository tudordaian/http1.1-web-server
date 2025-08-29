import {HTTPReq} from "./types";
import {HTTPError} from "./errors";

export type DynBuf = {
    data: Buffer,
    length: number,
    start: number,
};

const kMaxHeaderLen = 1024 * 8

// parsarea unui HTTP request header
function parseHTTPReq(data: Buffer): HTTPReq {
    // split data in linii
    const lines: Buffer[] = splitLines(data)
    // prima linie e 'METHOD URI VERSION'
    const [method, uri, version] = parseRequestLine(lines[0])
    // urmatoarele sunt header fields in format 'Name: value'
    const headers: Buffer[] = []
    for (let i = 1; i < lines.length - 1; i++) {
        const h = Buffer.from(lines[i])
        if (!validateHeader(h)) {
            throw new HTTPError(400, 'bad field')
        }
        headers.push(h)
    }
    // headerul se termina cu o linie goala
    console.assert(lines[lines.length - 1].length === 0)
    return {
        method: method, uri: uri, version: version, headers: headers
    }
}

// parsare + inlaturarea unui header de la inceputul bufferului daca e posibil
export function cutMessage(buf: DynBuf): null | HTTPReq {
    // header-ul se termina cu '\r\n\r\n'
    const idx = buf.data.subarray(0, buf.length).indexOf('\r\n\r\n')
    if(idx < 0) {
        if(buf.length >= kMaxHeaderLen) {
            throw new HTTPError(413, 'header is too large.')
        }
        return null     // mai trebuie date
    }
    // parsare + inlaturare header
    const msg = parseHTTPReq(buf.data.subarray(0, idx + 4))
    bufPop(buf, idx + 4)
    return msg
}

function bufPush(buf: DynBuf, data: Buffer): void {
    const newLen = buf.length + data.length;
    if (buf.data.length < newLen) {
        // cresterea capacitatii cu putere a lui 2
        let cap = Math.max(buf.data.length, 32);
        while (cap < newLen) {
            cap *= 2;
        }
        const grown = Buffer.alloc(cap);
        buf.data.copy(grown, 0, 0);
        buf.data = grown;
    }
    data.copy(buf.data, buf.length, 0);
    buf.length = newLen;
}

function bufPop(buf: DynBuf, len: number): void {
    buf.data.copyWithin(0, len, buf.length);
    buf.length -= len;
}
