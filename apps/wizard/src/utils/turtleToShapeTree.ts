import N3, {Prefixes} from "n3";

export function getPrefiex(prefixes:Prefixes){
   return Object.keys(prefixes).map(prefix => `PREFIX ${prefix}: <${prefixes[prefix]}>`).join('\n');
}

export function getQuads(quad:any){
        try {
            const propertyName = quad.predicate.value.split('#')[1];
            const propertyType = quad.object.datatypeString.split('#')[1];
            return `\t${propertyName} xsd:${propertyType} ;\n`;
        } catch (err) {
            const object = quad.object.value;
            const objectName = object.split('#')[1];
            const objectValue = object.substring(object.lastIndexOf('/') + 1);
            return `}\n\n<#${objectName}> {\n\ta \t[${objectValue}] ;\n`;
        }
}

export async function turtleToShape(turtleContent: string ): Promise<string>{
    return new Promise((resolve, reject) => {
        const turtleData = turtleContent;
        const parser = new N3.Parser();
        let quads = "";
        let prefixContent = '';
        parser.parse(turtleData, (error, quad, prefixes) => {
            if (prefixes) {
                prefixContent = getPrefiex(prefixes);
            }
            if (quad) {
                quads += getQuads(quad);
            }
            else {
                const quadValue = `${quads.substring(1)}\n}`
                const content = `${prefixContent}\n${quadValue}`;
                resolve(content);
            }
        });
    });
}