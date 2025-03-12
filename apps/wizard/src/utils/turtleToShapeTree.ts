import N3, {Parser, Prefixes, Quad} from "n3";

export function getQuads(quad:any,prefixs:[{key:string,value:string}]){
    const predicate = quad.predicate.value;
    const propertyValue = predicate.substring(predicate.lastIndexOf('/') + 1).replace('#',':');
    try {
        const propertyType = quad.object.datatypeString.split('#')[1];
        const predicateValue = getPrefixName(predicate.split('#')[0], prefixs) +":"+predicate.split('#')[1];

        return `\t${predicateValue} xsd:${propertyType};\n`;
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
        return { success: true, message: '' };
    } catch (e) {
        console.log('Error',e);
        return { success: false, message: e };
    }
}
function getPrefixName(predicate:string,prefixes:[{key:string,value:string}]){
    // Get prefix name for the shape file
    const foundObject = prefixes.find(prefix => prefix.value === predicate+'#');
    return foundObject ? foundObject.key : undefined;
}
function getPrefixArray(prefix:Prefixes){
    // convert shape object to array
    return Object.entries(prefix).map(([key, value]) => ({ key, value }));
}

function getShapePrefix(prefixes:[{key:string,value:string}]){
    // create the Prefix content for the shape file
    return prefixes.map(prefix => `PREFIX ${prefix.key}: <${prefix.value}>`).join('\n');
}
function getShapeQuads(quads:[], prefixes:[{key:string,value:string}]){
    // create the quads content for the shape file
    return quads.map(quad => getQuads(quad,prefixes)).join('').substring(1)+"\n}";
}
export async function turtleToShape(turtleContent: string ){
    const {prefix,quads} = await getQuadsAndShapes(turtleContent);
    const shapePrefix = getShapePrefix(prefix);
    const shapeQuads = getShapeQuads(quads,prefix);
    return shapePrefix + shapeQuads;
}

export async function getQuadsAndShapes(turtleContent: string ): Promise<{prefix:[{key:string,value:string}],quads:[]}>{
    // prepare data for prefix and quads of the shape file
    return new Promise((resolve, reject) => {
        const turtleData = turtleContent;
        const parser = new N3.Parser();

        let prefixContent:any = [];
        const quadsContent: any =[];
        parser.parse(turtleData, (error, quad, prefixes) => {
            if (prefixes) {
                prefixContent = getPrefixArray(prefixes);
            }
            if (quad) {
                quadsContent.push(quad);
            }
            else {
                resolve({prefix:prefixContent, quads:quadsContent});
            }
        });
    });
}