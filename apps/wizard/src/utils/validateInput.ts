export function validateInput(name: string) {
    const regex = /^[a-zA-Z0-9_]+$/;
    return name.length > 0 && regex.test(name);
}
