import { encodeHTTPResp } from "./http_protocol";
import { soWrite, TCPConn } from "../server";
import {HTTPRes, BodyReader} from "../types/types";

export async function writeHTTPHeader(conn: TCPConn, resp: HTTPRes): Promise<void> {
    if (resp.body.length < 0) {
        resp.headers.push(Buffer.from('Transfer-Encoding: chunked'))
    } else {
        resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`))
    }
    // write header
    await soWrite(conn, encodeHTTPResp(resp));
}

export async function writeHTTPBody(conn: TCPConn, body: BodyReader): Promise<void> {
    // write body
    const crlf = Buffer.from('\r\n')
    for(let last = false; !last;) {
        let data = await body.read()
        last = (data.length === 0) // eof?
        if(body.length < 0) { // chunked encoding
            data = Buffer.concat([
                Buffer.from(data.length.toString(16)), crlf,
                data, crlf,
            ])
        }
        if(data.length) {
            await soWrite(conn, data)
        }
    }
}

export async function writeHTTPResp(conn: TCPConn, resp: HTTPRes): Promise<void> {
    await writeHTTPHeader(conn, resp);
    await writeHTTPBody(conn, resp.body);
}
