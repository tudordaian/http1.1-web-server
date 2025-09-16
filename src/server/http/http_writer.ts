import { encodeHTTPResp } from "./http_protocol";
import { soWrite, TCPConn } from "../server";
import {HTTPRes, BodyReader} from "../types/types";
import stream from "node:stream";
import {pipeline} from "node:stream/promises";

export async function writeHTTPHeader(conn: TCPConn, resp: HTTPRes): Promise<void> {
    if (resp.body.length < 0) {
        resp.headers.push(Buffer.from('Transfer-Encoding: chunked'))
    } else {
        resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`))
    }
    // write header
    await soWrite(conn, encodeHTTPResp(resp));
}

export async function writeHTTPBody(conn: TCPConn, resp_body: BodyReader): Promise<void> {
    if (resp_body.length < 0) {
        // chunked encoding
        const chunkedEncoder = new stream.Transform({
            transform(chunk, encoding, callback) {
                const size = chunk.length.toString(16);
                const encoded = Buffer.concat([
                    Buffer.from(size + '\r\n'),
                    chunk,
                    Buffer.from('\r\n')
                ]);
                callback(null, encoded);
            },
            flush(callback) {
                callback(null, Buffer.from('0\r\n\r\n'));
            }
        });
        await pipeline(resp_body.read, chunkedEncoder, conn.socket);
    } else {
        await pipeline(resp_body.read, conn.socket);
    }
}

export async function writeHTTPResp(conn: TCPConn, resp: HTTPRes): Promise<void> {
    await writeHTTPHeader(conn, resp);
    await writeHTTPBody(conn, resp.body);
}
