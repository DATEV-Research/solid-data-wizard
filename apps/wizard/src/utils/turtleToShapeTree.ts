import {convertToType} from "@/utils/convertToType";

export function turtleToShapeTree(content:string): {shape:string, name:string}{
    const lines = content.split('\n');
    const prefixPattern = /@prefix\s+(\w+):\s+<([^>]+)>/;
    const linePattern =  /([a-zA-Z0-9]+):([a-zA-Z0-9]+)\s+([\d.]+|".*?")/;
    const typePattern = /a\s+([a-zA-Z0-9]+):([a-zA-Z0-9]+)/;
    let shapeName = 'unknown';
    const shapedContent =  lines.map(line => {
        const prefixMatch = line.match(prefixPattern);
        const lineMatch = line.match(linePattern);
        const typeMatch = line.match(typePattern);
        if (prefixMatch) {
            return `PREFIX ${prefixMatch[1]}: <${prefixMatch[2]}>`;
        }
        if( lineMatch){
            const type = convertToType(lineMatch[3].trim());
            return `\t ${lineMatch[1].trim()}:${lineMatch[2].trim()} xsd:${type} ;`
        }
        if(typeMatch){
            shapeName = typeMatch[2];
            return `<#${typeMatch[2]}Shape> {\n\ta [${typeMatch[1]}:${typeMatch[2]}] ;`
        }
        return '';
    });
    const semiColonPattern = /;$/;
    let lastLine = shapedContent[shapedContent.length-1];
    let counter = 1;
    if(shapeName === 'unknown'){
        throw new Error('Error: No shape name found');
    }
    while(!lastLine.match(semiColonPattern)){
        counter++;
        lastLine = shapedContent[shapedContent.length- counter];
        if(counter > shapedContent.length){
            throw new Error('Error: No closing semi colon found');
        }
    }
    shapedContent[shapedContent.length- counter] = lastLine.replace(semiColonPattern,'');
    return { 'shape': shapedContent.join('\n').concat('\n}'), "name": shapeName};
}