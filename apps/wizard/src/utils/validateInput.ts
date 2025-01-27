export function validateInput(name: string) {
    const regex = /^[a-zA-Z0-9_]+$/;
    return regex.test(name);
}