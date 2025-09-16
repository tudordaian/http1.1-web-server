import { fieldGet } from "./http_protocol";
import {BodyReader, HTTPReq} from "../types/types";
import { soRead, TCPConn } from "../server";
import {BufferGenerator, readChunks} from "../../utils/generator/generator";
import { bufPush, bufPop, DynBuf } from "../../utils/buffer/buffer_utils";
import { HTTPError } from "../../errors/errors";
import * as fs from "fs/promises";
import stream from "node:stream";

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
        return readerFromGenerator(readChunks(conn, buf))
    } else {
        // read restul conexiunii
        // return readerFromConnEOF(conn, buf) // pt server/1.0
        throw new HTTPError(400, 'Missing Content-Length or Transfer-Encoding');
    }
}

function readerFromConnLength(conn: TCPConn, buf: DynBuf, remain: number): BodyReader {
    return {
        length: remain,
        read: new stream.Readable({
            read() {
                (async () => {
                    try {
                        if (remain === 0) {
                            this.push(null); // EOF signal
                            return;
                        }
                        if (buf.length === 0) {
                            // incercare de a obtine date
                            // TODO: remove soRead()
                            const data = await soRead(conn);
                            bufPush(buf, data);
                            if (data.length === 0) {
                                // se asteapta mai multe date!
                                this.destroy(new Error('Unexpected EOF from HTTP body'));
                                return;
                            }
                        }
                        // consuma date din buffer
                        const consume = Math.min(buf.length, remain);
                        remain -= consume;
                        const data = Buffer.from(buf.data.subarray(0, consume));
                        bufPop(buf, consume);
                        this.push(data);
                    } catch (err) {
                        this.destroy(err instanceof Error ? err : new Error('Read error'));
                    }
                })();
            }
        })
    };
}


export function readerFromGenerator(gen: BufferGenerator): BodyReader {
    return {
        length: -1,
        read: stream.Readable.from(gen),
        close: async(): Promise<void> => {
            // fortare return pt ca blocul finally sa se execute
            await gen.return()
        }
    }
}

export function readerFromMemory(data: Buffer): BodyReader {
    let done = false;
    return {
        length: data.length,
        read: new stream.Readable({
            read() {
                (async () => {
                    if(done) {
                        this.push(null)
                        return
                    } else {
                        done = true
                        this.push(data)
                    }
                })()
            }
        })
    };
}

export function readerFromStaticFile(fp: fs.FileHandle, start: number, end: number): BodyReader {
    const buf = Buffer.allocUnsafe(65536)
    let offset = start            // pozitia curenta in fisier
    const totalSize = end - start // dimensiunea totala de citit
    let got = 0                   // octeti cititi pana acum
    return {
        length: totalSize,
        read: new stream.Readable({
            read() {
                (async() => {
                    try {
                        if (offset >= end) {
                            this.push(null) // EOF - am ajuns la sfarsitul intervalului
                            return
                        }

                        const maxread = Math.min(buf.length, end - offset); // poate fi 0
                        const r: fs.FileReadResult<Buffer> = await fp.read({
                            buffer: buf,
                            position: offset,
                            length: maxread,
                        });

                        got += r.bytesRead
                        offset += r.bytesRead

                        if(got > totalSize || (got < totalSize && r.bytesRead === 0 && offset < end)) {
                            this.destroy(new Error('file size changed or unexpected EOF, abandon it!'))
                        }

                        // bufferul alocat automat poate fi mai mare
                        this.push(r.buffer.subarray(0, r.bytesRead))
                        return
                    } catch(err) {
                        this.destroy(err instanceof Error ? err : new Error('File read error'))
                    }
                })()
            }
        }),
        close: async() => await fp.close()
    }
}