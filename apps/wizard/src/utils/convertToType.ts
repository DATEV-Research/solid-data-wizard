export function convertToType(value:string){
    if(value.startsWith('"') && value.endsWith('"')){
        const stringValue = value.substring(1,value.length-1);
        const utcDate = new Date(stringValue).toISOString();
        const isDateTime = new Date(stringValue).toString() !== "Invalid Date" && utcDate === stringValue;
        if(isDateTime ){
            return "dateTime";
        }
        return "string";
    }
    if(value.includes('.')){
        return "decimal";
    }
    return "decimal";
}