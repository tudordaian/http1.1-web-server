import {BodyReader} from "../../server/http/types";
import stream from "node:stream";
import * as zlib from "node:zlib";
import {pipeline} from "node:stream/promises";


export function gzipFilter(reader: BodyReader): BodyReader {
    /* constanta Z_SYNC_FLUSH permite sa se dea flush imediat buffer-ului intern functiei
    createGzip(). Efectul se poate observa apeland endpoint-ul /sheep
    Flushing-ul frecvent reduce eficacitatea compresarii! */
    const gz: stream.Duplex = zlib.createGzip({flush: zlib.constants.Z_SYNC_FLUSH})

    // pipeline(producer, consumer)
    pipeline(reader.read, gz).catch((err: Error) => gz.destroy(err));   // fara await

    const iter = gz.iterator()
    return {
        length: -1,  // Content-Length nu e cunoscut dupa compresie
        read: stream.Readable.from(iter),
        close: reader.close
    }
}