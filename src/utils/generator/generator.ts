import {bufExpectMore, bufPop, DynBuf} from "../buffer/buffer_utils";
import {TCPConn} from "../../server/server";


export type BufferGenerator = AsyncGenerator<Buffer, void, void>

export async function *countSheep(): BufferGenerator {
    try {
        for(let i = 0; i< 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000))
            yield Buffer.from(`${i}\n`)
        }
    } finally {     // e posibil doar daca se implementeaza .return() a primitivei generator
        console.log('cleanup!')
    }
}

// decodificarea chunked encodingului si yield la date
export async function* readChunks(conn: TCPConn, buf: DynBuf): BufferGenerator {
    for(let last = false; !last;) {
        // read la linia cu chunk-size
        const idx = buf.data.subarray(0, buf.length).indexOf('\r\n');
        if(idx < 0) {
            // mai trebuie date
            await bufExpectMore(conn, buf, 'chunk size');
            continue;
        }

        // parsare chunk-size si inlaturare linie
        const chunkSizeLine = buf.data.subarray(0, idx).toString('latin1');
        let remain = parseInt(chunkSizeLine, 16);
        if (isNaN(remain)) {
            throw new Error('Invalid chunk size');
        }
        bufPop(buf, idx + 2); // remove chunk size line including CRLF

        // e ultimul?
        last = (remain === 0);

        // read si yield la chunk data
        while(remain > 0) {
            if(buf.length === 0) {
                await bufExpectMore(conn, buf, 'chunk data');
            }

            const consume = Math.min(remain, buf.length);
            const data = Buffer.from(buf.data.subarray(0, consume));
            bufPop(buf, consume);
            remain -= consume;
            yield data;
        }

        // chunk data e urmat de CRLF
        while(buf.length < 2) {
            await bufExpectMore(conn, buf, 'chunk trailer CRLF');
        }
        bufPop(buf, 2); // remove trailing CRLF
    } // pt fiecare chunk
}
