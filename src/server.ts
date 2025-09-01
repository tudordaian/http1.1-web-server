import * as net from "net"
import {bufPush} from "./buffer/buffer_utils"
import {DynBuf, BodyReader, HTTPReq, HTTPRes} from "./types/types";
import {HTTPError} from "./errors/errors";
import {cutMessage} from "./http/http_parser";
import {handleReq} from "./http/http_handlers";
import {readerFromMemory, readerFromReq} from "./http/http_readers";
import {writeHTTPResp} from "./http/http_writer";


// API Promise-based pentru socket-uri TCP
export type TCPConn = {
    socket: net.Socket
    err: null | Error   // 'error' event
    ended: boolean      // 'end' event
    reader: null | {    // callback-urile promise-ului read-ului curent
        resolve: (value: Buffer) => void
        reject: (reason: Error) => void
    }
}

function soInit(socket: net.Socket): TCPConn {
    const conn: TCPConn = {
        socket: socket, err: null, ended: false, reader: null
    };
    socket.on('data', (data: Buffer) => {
        console.assert(conn.reader)
        // pauza la eventul 'data' pana la urmatorul read
        conn.socket.pause()
        // incheie promise-ul read-ului curent
        conn.reader!.resolve(data)
        conn.reader = null
    });
    socket.on('end', () => {
        // incheie promise-ul read-ului curent
        conn.ended = true
        if(conn.reader) {
            conn.reader.resolve(Buffer.from(''))
            conn.reader = null
        }
    });
    socket.on('error', (err: Error) => {
        conn.err = err
        if(conn.reader) {
            conn.reader.reject(err)
            conn.reader = null
        }
    });

    return conn
}

export function soRead(conn: TCPConn): Promise<Buffer> {
    console.assert(!conn.reader)    // fara call-uri concurente
    return new Promise((resolve, reject) => {
        // daca conexiunea nu e readable, finalizeaza promise-ul acum
        if(conn.err) {
            reject(conn.err)
            return
        }
        if(conn.ended) {
            resolve(Buffer.from(''))    // EOF
            return
        }

        // creare pending Promise si salvare callback-uri
        conn.reader = { resolve: resolve, reject: reject }
        // resume la 'data' pentru a se finaliza promise-ul la socket.on('data', () => {...})
        conn.socket.resume()
    })
}

export function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
    console.assert(data.length > 0)
    return new Promise((resolve, reject) => {
        if(conn.err) {
            reject(conn.err)
            return
        }

        conn.socket.write(data, (err?: Error | null) => {
            if(err) {
                reject(err)
            } else {
                resolve()
            }
        })
    })
}



async function serveClient(conn: TCPConn): Promise<void> {
    const buf: DynBuf = { data: Buffer.alloc(0), length: 0}
    while(true) {
        // incercare de a lua 1 request header din buffer
        const msg: null | HTTPReq = cutMessage(buf)
        if(!msg) {
            // mai trebuie date
            const data: Buffer = await soRead(conn)
            bufPush(buf, data)
            // EOF?
            if(data.length === 0 && buf.length === 0) {
                return  // nu mai sunt request-uri
            }
            if(data.length === 0) {
                throw new HTTPError(400, 'Unexpected EOF.')
            }
            continue
        }

        // procesare mesaj si trimitere response
        const reqBody: BodyReader = readerFromReq(conn, buf, msg)
        const res: HTTPRes = await handleReq(msg, reqBody)
        await writeHTTPResp(conn, res)
        // inchide conexiunea pt HTTP 1.0
        if (msg.version === '1.0') {
            return
        }
        // asigurarea ca req body e consumat complet
        while ((await reqBody.read()).length > 0) { /* nimic */ }

    }
}

async function newConn(socket: net.Socket): Promise<void> {
    const conn: TCPConn = soInit(socket)
    console.log(`New connection - remote address: ${socket.remoteAddress}, remote port: ${socket.remotePort} `)
    try {
        await serveClient(conn)
    } catch(exc) {
        console.error('exception: ', exc)
        if (exc instanceof HTTPError) {
            // error response
            const response: HTTPRes = {
                code: exc.code,
                headers: [],
                body: readerFromMemory(Buffer.from(exc.message + '\n')),
            }
            try {
                await writeHTTPResp(conn, response)
            } catch(exc) { /* nimic */ }
        }
    } finally {
        socket.destroy()
    }
}


let server = net.createServer({
    pauseOnConnect: true,    // previne 'data' loss
    noDelay: true
})
server.on('connection', newConn)
server.on('error', (err: Error)=> { throw err } )

server.listen({host: '127.0.0.1', port: 1234}, () => {
    console.log('Server listening')
})
