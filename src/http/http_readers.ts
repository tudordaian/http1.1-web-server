import { DynBuf, BodyReader, HTTPReq } from "../types/types";
import { HTTPError } from "../errors/errors";
import { bufPush, bufPop } from "../utils/buffer/buffer_utils";
import { fieldGet } from "./http_protocol";
import { soRead, TCPConn } from "../server";
import {BufferGenerator} from "../utils/generator/generator";

function parseDec(fieldValue: string): number {
    return parseInt(fieldValue, 10);
}

export function readerFromReq(conn: TCPConn, buf: DynBuf, req: HTTPReq): BodyReader {
    let bodyLen = -1;
    const contentLen = fieldGet(req.headers, 'Content-Length');
    if (contentLen) {
        bodyLen = parseDec(contentLen.toString('latin1'));
        if (isNaN(bodyLen)) {
            throw new HTTPError(400, 'bad Content-Length.');
        }
    }
    const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD');
    const chunked = fieldGet(req.headers, 'Transfer-Encoding')
        ?.equals(Buffer.from('chunked')) || false;
    if (!bodyAllowed && (bodyLen > 0 || chunked)) {
        throw new HTTPError(400, 'HTTP body not allowed');
    }
    if (!bodyAllowed) {
        bodyLen = 0;
    }
    if (bodyLen >= 0) {
        // 'Content-Length' e prezent
        return readerFromConnLength(conn, buf, bodyLen);
    } else if (chunked) {
        // chunked encoding
        throw new HTTPError(501, 'TODO');
    } else {
        // read restul conexiunii
        throw new HTTPError(501, 'TODO');
    }
}

function readerFromConnLength(conn: TCPConn, buf: DynBuf, remain: number): BodyReader {
    return {
        length: remain,
        read: async (): Promise<Buffer> => {
            if (remain === 0) {
                return Buffer.from(''); // done
            }
            if (buf.length === 0) {
                // incercare de a obtine date
                const data = await soRead(conn);
                bufPush(buf, data);
                if (data.length === 0) {
                    // se asteapta mai multe date!
                    throw new Error('Unexpected EOF from HTTP body');
                }
            }
            // consuma date din buffer
            const consume = Math.min(buf.length, remain);
            remain -= consume;
            const data = Buffer.from(buf.data.subarray(0, consume));
            bufPop(buf, consume);
            return data;
        }
    };
}

export function readerFromMemory(data: Buffer): BodyReader {
    let done = false;
    return {
        length: data.length,
        read: async (): Promise<Buffer> => {
            if (done) {
                return Buffer.from('');
            } else {
                done = true;
                return data;
            }
        }
    };
}

export function readerFromGenerator(gen: BufferGenerator): BodyReader {
    return {
        length: -1,
        read: async(): Promise<Buffer> => {
            const r = await gen.next()
            if(r.done) {
                return Buffer.from('')  // EOF
            } else {
                console.assert(r.value.length > 0)
                return r.value
            }
        }
    }
}
