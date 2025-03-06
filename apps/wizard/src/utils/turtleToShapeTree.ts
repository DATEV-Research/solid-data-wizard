import N3, {Parser, Prefixes, Quad} from "n3";

export function getPrefiex(prefixes:Prefixes){
   return Object.keys(prefixes).map(prefix => `PREFIX ${prefix}: <${prefixes[prefix]}>`).join('\n');
}

export function getQuads(quad:any){
    const predicate = quad.predicate.value;
    const propertyValue = predicate.substring(predicate.lastIndexOf('/') + 1).replace('#',':');
    try {
            const propertyType = quad.object.datatypeString.split('#')[1];
            return `\t${propertyValue} xsd:${propertyType} ;\n`;
        } catch (err) {
            if(!isContainRDFSyntax(predicate))
            {
                return `\t${propertyValue} IRI;\n`;
            }
            const object = quad.object.value;
            const objectName = object.split('#')[1];
            const objectValue = object.substring(object.lastIndexOf('/') + 1).replace('#',':');
            return `}\n\n<#${objectName}Shape> {\n\ta \t[${objectValue}] ;\n`;
        }
}

function isContainRDFSyntax(content:string){
    return content.includes("rdf-syntax-ns#type");
}

export function isValidTurtle(turtleContent:string){
    try {
        const parser = new Parser();
        parser.parse(turtleContent);
        return true;
    } catch (e) {
        return false;
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
                console.log(quad);
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