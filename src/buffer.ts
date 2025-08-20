export type DynBuf = {
    data: Buffer,
    length: number,
    start: number,
};

function bufData(buf: DynBuf): Buffer {
    return buf.data.subarray(buf.start, buf.start + buf.length)
}

export function cutMessage(buf: DynBuf): null | Buffer {
    // mesajele sunt separate cu '\n'
    const validData = bufData(buf)
    const idx = validData.indexOf('\n')
    if(idx < 0 ) {
        return null     // nu e complet mesajul
    }
    // creare copie mesaj + mutare date ramase in fata
    const msg = Buffer.from(validData.subarray(0, idx + 1))
    bufPop(buf, idx + 1)
    return msg
}

export function bufPush(buf: DynBuf, data: Buffer): void {
    const newLen = buf.length + data.length;
    const availableSpace = buf.data.length - (buf.start + buf.length)

    if (availableSpace < newLen) {
        // trebuie mai mult spatiu - compactare sau crestere
        if (buf.start > buf.data.length / 2) {
            // spatiul liber >= 1/2 capacitate, intai compactam
            buf.data.copyWithin(0, buf.start, buf.start + buf.length)
            buf.start = 0
        }
        // verificare daca trebie sa crestem in continuare dupa compactare
        if (buf.data.length < newLen) {
            // dublarea capacitatii
            let cap = Math.max(buf.data.length, 32);
            while (cap < newLen) {
                cap *= 2;
            }
            const grown = Buffer.alloc(cap);
            buf.data.copy(grown, 0, buf.start, buf.start + buf.length);
            buf.data = grown;
            buf.start = 0
        }
    }
    data.copy(buf.data, buf.start + buf.length, 0);
    buf.length = newLen;
    // console.log(`buf.data.length = ${buf.data.length}`)
}

function bufPop(buf: DynBuf, len: number): void {
    buf.start += len
    buf.length -= len

    // compactam daca spatiu irosit >= 1/2 capacitate
    if (buf.start > buf.data.length / 2) {
        buf.data.copyWithin(0, buf.start, buf.start + buf.length)
        buf.start = 0
    }
    // console.log(`######### buf.data.length after = ${buf.data.length}`)
    // console.log(`######### buf.length after = ${buf.length}`)
}
