import {BodyReader} from "../../server/types/types";
import stream from "node:stream";
import * as zlib from "node:zlib";
import {pipeline} from "node:stream/promises";

function body2stream(reader: BodyReader): stream.Readable {
    let self: stream.Readable | null = null
    self = new stream.Readable({
        read: async() => {
            try {
                const data: Buffer = await reader.read()
                self!.push(data.length > 0 ? data : null)
            } catch(err) {
                self!.destroy(err instanceof Error ? err : new Error('IO error'))
            }
        }
    })
    return self
}

export function gzipFilter(reader: BodyReader): BodyReader {
    /* constanta Z_SYNC_FLUSH permite sa se dea flush imediat buffer-ului intern functiei
    createGzip(). Efectul se poate observa apeland endpoint-ul /sheep
    Flushing-ul frecvent reduce eficacitatea compresarii! */
    const gz: stream.Duplex = zlib.createGzip({flush: zlib.constants.Z_SYNC_FLUSH})
    const input: stream.Readable = body2stream(reader)

    // pipeline(producer, consumer)
    pipeline(input, gz).catch((err: Error) => gz.destroy(err));   // fara await

    const iter: AsyncIterator<Buffer> = gz.iterator()
    return {
        length: -1,  // Content-Length nu e cunoscut dupa compresie
        read: async(): Promise<Buffer> => {
            const r: IteratorResult<Buffer, void> = await iter.next()
            return r.done ? Buffer.from('') : r.value
        },
        close: reader.close
    }
}