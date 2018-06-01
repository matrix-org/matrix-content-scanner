const decryptData = require('./decrypt.js');
const fs = require('fs');

// Decrypt a file at `filePath` using decryptData and store the result at `encryptedFilePath`
module.exports = function decryptFile(filePath, encryptedFilePath, eventContentFile) {
    const data = fs.readFileSync(filePath);

    const buffer = decryptData(data, eventContentFile);

    fs.writeFileSync(encryptedFilePath, buffer);
}
