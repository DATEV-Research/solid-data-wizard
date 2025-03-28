export function renameFile(originalFile:File, newName:string) {
    return new File([originalFile], newName, {
        type: originalFile.type,
        lastModified: originalFile.lastModified
    });
}