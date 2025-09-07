import {BodyReader, HTTPRes} from "../server/types/types";
import * as fs from "fs/promises";
import {resp404} from "../errors/errors";
import {readerFromStaticFile} from "../server/http/http_readers";


export async function serveStaticFile(path: string): Promise<HTTPRes> {
    let fp: null|fs.FileHandle = null;
    try {
        fp = await fs.open(path, 'r');
        const stat = await fp.stat();
        if (!stat.isFile()) {
            return resp404();
        }
        const size = stat.size;
        try {
            const reader: BodyReader = readerFromStaticFile(fp, size);
            return {
                code: 200,
                headers: [],
                body: reader
            };
        } finally {
            fp = null;  // ownershipul e transferat prin readerFromStaticFile()
        }
    } catch (exc) {
        console.info('error serving file:', exc);
        return resp404();
    } finally {
        await fp?.close();
    }
}


