import * as net from "net"
import {DynBuf, bufPush, cutMessage} from "./buffer"


// API Promise-based pentru socket-uri TCP
type TCPConn = {
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

function soRead(conn: TCPConn): Promise<Buffer> {
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

function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
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

async function serveClient(socket: net.Socket): Promise<void> {
    const conn: TCPConn = soInit(socket)
    const buf: DynBuf = { data: Buffer.alloc(0), length: 0, start: 0 }
    while(true) {
        // incercare de a lua 1 msg din buffer
        const msg = cutMessage(buf)
        if(!msg) {
            // mai trebuie date
            const data: Buffer = await soRead(conn)
            bufPush(buf, data)
            // EOF?
            if(data.length === 0) {
                return
            }
            continue
        }

        // procesare mesaj si trimitere response
        if(msg.equals(Buffer.from('quit\n'))) {
          await soWrite(conn, Buffer.from('Bye.\n'))
          socket.destroy()
          return
        } else {
            const reply = Buffer.concat([Buffer.from('Echo: '), msg])
            await soWrite(conn, reply)
            console.log('buffer data:', reply)
            console.log('data as string:', JSON.stringify(reply.toString('utf-8')))
        }
    }
}

async function newConn(socket: net.Socket): Promise<void> {
    console.log(`New connection - remote address: ${socket.remoteAddress}, remote port: ${socket.remotePort} `)
    try {
        await serveClient(socket)
    } catch(exc) {
        console.error('exception: ', exc)
    } finally {
        socket.destroy()
    }
}


let server = net.createServer({
    pauseOnConnect: true    // previne 'data' loss
})
server.on('connection', newConn)
server.on('error', (err: Error)=> { throw err } )

server.listen({host: '127.0.0.1', port: 1234}, () => {
    console.log('Server listening')
})

