import {readerFromGenerator, readerFromMemory} from "./http_readers";
import {countSheep} from "../../utils/generator/generator";
import {BodyReader, HTTPReq, HTTPRes} from "./types";
import {HTTPError} from "../../errors/errors";
import {getReasonPhrase} from "./http_protocol";
import {serveStaticFile} from "../../io/file_io";
import path from "node:path";

export async function handleReq(req: HTTPReq, body: BodyReader): Promise<HTTPRes> {
    let resp: BodyReader;
    const uri = req.uri.toString('utf8');

    if (uri.startsWith('/files/')) {
        // serveste fisiere din directorul curent
        const filePath = path.normalize(uri.slice('/files/'.length))
        if(filePath.startsWith('../') || filePath.includes('/../')) {
            throw new HTTPError(403, getReasonPhrase(403))
        }
        
        return await serveStaticFile(uri.slice('/files/'.length), req);
    }

    switch (uri) {
        case '/echo':
            // server echo server
            resp = body;
            break;
        case '/sheep':
            resp = readerFromGenerator(countSheep())
            break
        default:
            resp = readerFromMemory(Buffer.from('hello world.\n'));
            break;
    }

    return {
        code: 200,
        headers: [Buffer.from('Server: my_http_server')],
        body: resp
    };
}
