export class HTTPError extends Error {
    code: number

    constructor(code: number, message: string) {
        super(message)
        this.name = 'HTTPError'
        this.code = code
    }
}
