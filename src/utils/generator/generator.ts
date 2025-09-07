export type BufferGenerator = AsyncGenerator<Buffer, void, void>

export async function *countSheep(): BufferGenerator {
    for(let i = 0; i< 100; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        yield Buffer.from(`${i}\n`)
    }
}