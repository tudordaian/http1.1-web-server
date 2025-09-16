import {DynBuf} from "./types";
import {soRead, TCPConn} from "../../server/server";

export {DynBuf} from "./types";

export function bufPush(buf: DynBuf, data: Buffer): void {
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

export function bufPop(buf: DynBuf, len: number): void {
    buf.data.copyWithin(0, len, buf.length);
    buf.length -= len;
}

export async function bufExpectMore(conn: TCPConn, buf: DynBuf, context: string): Promise<void> {
    // TODO: remove soRead()
    const data = await soRead(conn);
    bufPush(buf, data);
    if (data.length === 0) {
        throw new Error(`Unexpected EOF while reading ${context}`);
    }
}
