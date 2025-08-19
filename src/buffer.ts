export type DynBuf = {
    data: Buffer,
    length: number,
};

export function cutMessage(buf: DynBuf): null | Buffer {
    // mesajele sunt separate cu '\n'
    const idx = buf.data.subarray(0, buf.length).indexOf('\n')
    if(idx < 0 ) {
        return null     // nu e complet mesajul
    }
    // creare copie mesaj + mutare date ramase in fata
    const msg = Buffer.from(buf.data.subarray(0, idx + 1))
    bufPop(buf, idx + 1)
    return msg
}

export function bufPush(buf: DynBuf, data: Buffer): void {
    const newLen = buf.length + data.length;
    if (buf.data.length < newLen) {
        // dublarea capacitatii
        let cap = Math.max(buf.data.length, 32);
        while (cap < newLen) {
            cap *= 2;
        }
        const grown = Buffer.alloc(cap);
        buf.data.copy(grown, 0, 0);
        buf.data = grown;
    }
    data.copy(buf.data, buf.length, 0);
    buf.length = newLen;
    // console.log(`buf.data.length = ${buf.data.length}`)
}

export function bufPop(buf: DynBuf, len: number): void {
    buf.data.copyWithin(0, len, buf.length)
    // console.log(`######### buf.length before= ${buf.length}`)
    buf.length -= len
    // console.log(`######### buf.data.length after = ${buf.data.length}`)
    // console.log(`######### buf.length after = ${buf.length}`)
}
