module.exports = class ClientError extends Error {
    constructor(status, message) {
        super(`Client error: ${message}`);
        this.status = status;
    }
}
