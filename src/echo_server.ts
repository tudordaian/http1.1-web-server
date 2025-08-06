import * as net from "net"


function newConn(socket: net.Socket): void {
    console.log(`New connection - remote address: ${socket.remoteAddress}, remote port: ${socket.remotePort} `)

    socket.on('data', (data: Buffer) => {
        console.log('Data: ' + data)
        socket.write(data)

        if(data.includes('q')) {
            console.log('Closing connection.')
            socket.end()    // trimite FIN
        }
    });

    socket.on('end', () => {    // cand primeste FIN
        console.log('EOF.')
    });
}


let server = net.createServer()
server.on('connection', newConn)
server.on('error', (err: Error)=> { throw err } )

server.listen({host: '127.0.0.1', port: 1234}, () => {
    console.log('Server listening')
})

