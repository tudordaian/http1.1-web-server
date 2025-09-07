import { HTTPReq, HTTPRes, BodyReader } from "../types/types";
import {readerFromGenerator, readerFromMemory} from "./http_readers";
import {countSheep} from "../utils/generator/generator";

export async function handleReq(req: HTTPReq, body: BodyReader): Promise<HTTPRes> {
    let resp: BodyReader;
    switch (req.uri.toString('latin1')) {
        case '/echo':
            // http echo server
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



















