export function validateFileName(name: string) {
    const regex = /^[a-zA-Z0-9\s_.\-()]*$/;
    return name.length > 0 && regex.test(name);
}