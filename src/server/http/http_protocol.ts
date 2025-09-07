import {HTTPRes} from "../types";

export const getReasonPhrase = (code: number): string => {
    const reasonPhrases: { [key: number]: string } = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        413: 'Payload Too Large',
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
