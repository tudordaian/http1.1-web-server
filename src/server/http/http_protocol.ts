import {HTTPReq, HTTPRes} from "../types/types";
import {gzipFilter} from "../../utils/compression/compression";

export const getReasonPhrase = (code: number): string => {
    const reasonPhrases: { [key: number]: string } = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        206: 'Partial Content',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        413: 'Payload Too Large',
        416: 'Range Not Satisfiable',
        500: 'Internal Server Error',
        501: 'Not Implemented',
        502: 'Bad Gateway',
        503: 'Service Unavailable'
    };
    return reasonPhrases[code] || 'Unknown';
};

export function encodeHTTPResp(resp: HTTPRes): Buffer {
    // status line = HTTP-version SP status-code SP reason-phrase CRLF
    const statusLine = `HTTP/1.1 ${resp.code} ${getReasonPhrase(resp.code)}\r\n`;

    // encoding pentru headere
    let headerLines = '';
    for (const header of resp.headers) {
        headerLines += header.toString() + '\r\n';
    }
    headerLines += '\r\n';
    const responseHeader = statusLine + headerLines;

    return Buffer.from(responseHeader);
}

export function fieldGet(headers: Buffer[], key: string): null | Buffer {
    const lowerKey = key.toLowerCase()
    for(const header of headers) {
        const headerStr = header.toString('latin1')
        const colonIdx = headerStr.indexOf(':')

        if(colonIdx <= 0) continue

        const fieldName = headerStr.substring(0, colonIdx).trim().toLowerCase()
        if(fieldName === lowerKey) {
            const fieldValue = headerStr.substring(colonIdx + 1).trim()
            return Buffer.from(fieldValue, 'latin1')
        }

    }
    return null
}

// functia nu e compatibila daca header-ul din key apare de mai multe ori
// functia nu e compatibila cu liste de valori separate de ';' (de ex weight)
function fieldGetList(headers: Buffer[], key: string): string[] {
    const lowerKey = key.toLowerCase()
    for(const header of headers) {
        const headerStr = header.toString('latin1')
        const colonIdx = headerStr.indexOf(':')

        if(colonIdx <= 0) continue

        const fieldName = headerStr.substring(0, colonIdx).trim().toLowerCase()
        if(fieldName === lowerKey) {
            return headerStr.substring(colonIdx + 1).trim().split(', ')
        }
    }
    return []
}

// (doar gzip)
export function enableCompression(req: HTTPReq, res: HTTPRes): void {
    // informarea proxy-urilor ca response-ul e variabil

    res.headers.push(Buffer.from('Vary: Content-Encoding'))
    if(fieldGet(req.headers, 'Range')) {
        return  // incompatibil!
    }
    const codecs: string[] = fieldGetList(req.headers, 'Accept-Encoding')
    if(!codecs.includes('gzip')) {
        return
    }
    // transformare response cu gzip
    res.headers.push(Buffer.from('Content-Encoding: gzip'))
    res.body = gzipFilter(res.body)

}
