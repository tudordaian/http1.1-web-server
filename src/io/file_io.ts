import {BodyReader, HTTPRes, HTTPReq} from "../server/http/types";
import * as fs from "fs/promises";
import {HTTPError, respError} from "../errors/errors";
import {readerFromStaticFile} from "../server/http/http_readers";
import {fieldGet} from "../server/http/http_protocol";
import {parseBytesRanges} from "../server/http/http_parser";


export async function serveStaticFile(path: string, req?: HTTPReq): Promise<HTTPRes> {
    let fp: null|fs.FileHandle = null;
    try {
        fp = await fs.open(path, 'r');
        const stat = await fp.stat();
        if (!stat.isFile()) {
            return respError(404, "Not Found");
        }
        const size = stat.size;

        const result = staticFileResp(req, fp, size);
        fp = null;  // ownership transferat la BodyReader
        return result;
    } catch (exc) {
        console.info('error serving file:', exc);
        if (exc instanceof HTTPError) {
            return respError(exc.code, exc.message);
        }
        return respError(404, "Not Found");
    } finally {
        await fp?.close();
    }
}

function staticFileResp(req: HTTPReq | undefined, fp: fs.FileHandle, size: number): HTTPRes {
    // Verificare daca exista Range header
    const rangeHeader = req ? fieldGet(req.headers, 'Range') : null;

    if (!rangeHeader) {
        // Nu exista Range header - returneaza fisierul complet
        const reader: BodyReader = readerFromStaticFile(fp, 0, size);
        return {
            code: 200,
            headers: [
                Buffer.from(`Content-Length: ${size}`),
                Buffer.from('Accept-Ranges: bytes')
            ],
            body: reader
        };
    }

    // Parsare Range header
    let ranges;
    try {
        ranges = parseBytesRanges(rangeHeader);
    } catch (err) {
        // Range header invalid - returneaza 400 Bad Request
        throw new HTTPError(400, 'Bad Request');
    }

    if (ranges.length === 0) {
        // Nu exista range-uri valide - returneaza fisierul complet
        const reader: BodyReader = readerFromStaticFile(fp, 0, size);
        return {
            code: 200,
            headers: [
                Buffer.from(`Content-Length: ${size}`),
                Buffer.from('Accept-Ranges: bytes')
            ],
            body: reader
        };
    }

    // Proceseaza primul (si singurul) range
    const range = ranges[0];
    let start: number;
    let end: number;

    if (typeof range === 'number') {
        // Suffix-range: ultimele N bytes
        const suffixLength = range;
        if (suffixLength >= size) {
            // Range-ul cere mai mult decat dimensiunea fisierului
            start = 0;
            end = size;
        } else {
            start = size - suffixLength;
            end = size;
        }
    } else {
        // Int-range: [start, end]
        const [rangeStart, rangeEnd] = range;
        start = rangeStart;
        end = rangeEnd !== null ? rangeEnd + 1 : size; // end e exclusiv in readerFromStaticFile

        if (rangeEnd !== null && rangeStart > rangeEnd) {
            throw new HTTPError(416, 'Range Not Satisfiable');
        }

        // Validare range
        if (start >= size) {
            // Range-ul e complet in afara fisierului - 416 Range Not Satisfiable
            throw new HTTPError(416, 'Range Not Satisfiable');
        }

        // Ajustare end la dimensiunea fisierului
        if (end > size) {
            end = size;
        }
    }

    // Verificare finala ca range-ul e valid
    if (start >= end || start < 0) {
        throw new HTTPError(416, 'Range Not Satisfiable');
    }

    // Creeare BodyReader pentru range
    const reader: BodyReader = readerFromStaticFile(fp, start, end);
    const contentLength = end - start;

    // Content-Range header: bytes start-end/total
    const contentRange = `bytes ${start}-${end - 1}/${size}`;

    return {
        code: 206, // Partial Content
        headers: [
            Buffer.from(`Content-Length: ${contentLength}`),
            Buffer.from(`Content-Range: ${contentRange}`),
            Buffer.from('Accept-Ranges: bytes')
        ],
        body: reader
    };
}
