import { HTTPRes } from "../types/types";
import { encodeHTTPResp, fieldGet } from "./http_protocol";
import { soWrite, TCPConn } from "../server";

export async function writeHTTPResp(conn: TCPConn, resp: HTTPRes): Promise<void> {
    if (resp.body.length < 0) {
        throw new Error('TODO: Chunked encoding');
    }
    // setare 'Content-Length' field
    console.assert(!fieldGet(resp.headers, 'Content-Length'));
    resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`));
    // write header-ul
    await soWrite(conn, encodeHTTPResp(resp));
    // write body-ul
    while (true) {
        const data = await resp.body.read();
        if (data.length === 0) {
            break;
        }
        await soWrite(conn, data);
    }
}
