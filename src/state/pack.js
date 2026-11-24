// Squashing saves so they take up far less room in the browser. Packed saves start
// with "LZ1:"; anything else is an old, unpacked save and is read as it is.
import LZ from 'lz-string';
const TAG = 'LZ1:';
export const packSave = json => TAG + LZ.compressToUTF16(json);
export const unpackSave = s => typeof s === 'string' && s.startsWith(TAG) ? LZ.decompressFromUTF16(s.slice(TAG.length)) : s;
