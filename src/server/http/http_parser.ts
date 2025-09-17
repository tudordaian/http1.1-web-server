import { HTTPError } from "../../errors/errors";
import { bufPop, DynBuf } from "../../utils/buffer/buffer_utils";
import {HTTPReq} from "../types/types";

const kMaxHeaderLen = 1024 * 8;

function splitLines(data: Buffer): Buffer[] {
    const lines = data.toString().split('\r\n');
    // se genereaza o linie goala din cauza ca headerele se termina cu \r\n\r\n
    if (lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines.map(line => Buffer.from(line));
}

function parseRequestLine(line: Buffer): [string, Buffer, string] {
    const parts = line.toString().split(' ');
    if (parts.length !== 3) {
        throw new HTTPError(400, 'Invalid request line');
    }
    const method = parts[0];
    const uri = Buffer.from(parts[1]);
    const version = parts[2];
    return [method, uri, version];
}

function validateHeader(header: Buffer): boolean {
    const headerStr = header.toString().trim();
    const colonIdx = headerStr.indexOf(':');

    if (colonIdx < 0) {
        return false;
    }
    const name = headerStr.substring(0, colonIdx).trim();
    const value = headerStr.substring(colonIdx + 1).trim();

    return name.length > 0 &&
        !name.includes(' ') &&
        !name.includes('\t') &&
        value.length > 0;
}

function parseHTTPReq(data: Buffer): HTTPReq {
    // split data in linii
    const lines: Buffer[] = splitLines(data);
    // prima linie e 'METHOD URI VERSION'
    const [method, uri, version] = parseRequestLine(lines[0]);
    // urmatoarele sunt header fields in format 'Name: value'
    const headers: Buffer[] = [];
    for (let i = 1; i < lines.length - 1; i++) {
        const h = Buffer.from(lines[i]);
        if (!validateHeader(h)) {
            throw new HTTPError(400, 'bad field');
        }
        headers.push(h);
    }
    // headerul se termina cu o linie goala
    console.assert(lines[lines.length - 1].length === 0);
    return {
        method: method, uri: uri, version: version, headers: headers
    };
}

// parsare + inlaturarea unui header de la inceputul bufferului daca e posibil
export function cutMessage(buf: DynBuf): null | HTTPReq {
    // header-ul se termina cu '\r\n\r\n'
    const idx = buf.data.subarray(0, buf.length).indexOf('\r\n\r\n');
    if (idx < 0) {
        if (buf.length >= kMaxHeaderLen) {
            throw new HTTPError(413, 'header is too large.');
        }
        return null;     // mai trebuie date
    }
    // parsare + inlaturare header
    const msg = parseHTTPReq(buf.data.subarray(0, idx + 4));
    bufPop(buf, idx + 4);
    return msg;
}

// range-spec   = int-range
//              / suffix-range
//              / other-range
// int-range    = first-pos "-" [ last-pos ]
// suffix-range = "-" suffix-length
type HTTPRange = [number, number|null] | number;

export function parseBytesRanges(r: null | Buffer): HTTPRange[] {
    if (!r) {
        return [];
    }

    const rangeHeader = r.toString('latin1').trim();

    // verificare daca incepe cu "bytes="
    if (!rangeHeader.startsWith('bytes=')) {
        throw new HTTPError(400, 'Invalid Range header format');
    }

    const rangeSet = rangeHeader.slice(6); // Remove "bytes="
    const trimmedSpec = rangeSet.trim();

    if (trimmedSpec === '') {
        return [];
    }

    // verificare pentru suffix-range: "-suffix-length"
    if (trimmedSpec.startsWith('-')) {
        const suffixLength = parseInt(trimmedSpec.slice(1), 10);
        if (isNaN(suffixLength) || suffixLength < 0) {
            throw new HTTPError(400, 'Invalid suffix-range format');
        }
        return [suffixLength];
    }

    // int-range: "first-pos-[last-pos]"
    const dashIndex = trimmedSpec.indexOf('-');
    if (dashIndex === -1) {
        throw new HTTPError(400, 'Invalid range-spec format');
    }

    const firstPosStr = trimmedSpec.slice(0, dashIndex);
    const lastPosStr = trimmedSpec.slice(dashIndex + 1);

    const firstPos = parseInt(firstPosStr, 10);
    if (isNaN(firstPos) || firstPos < 0) {
        throw new HTTPError(400, 'Invalid first-pos in range');
    }

    let lastPos: number | null = null;
    if (lastPosStr !== '') {
        lastPos = parseInt(lastPosStr, 10);
        if (isNaN(lastPos) || lastPos < 0) {
            throw new HTTPError(400, 'Invalid last-pos in range');
        }
    }

    return [[firstPos, lastPos]];
}