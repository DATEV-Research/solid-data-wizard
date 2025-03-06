const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export function fileSizeExceeded(fileSize: number ){
    return MAX_FILE_SIZE > fileSize;
}