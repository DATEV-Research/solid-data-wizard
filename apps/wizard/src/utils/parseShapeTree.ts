// Parse the shape file
import N3, {DataFactory, Quad} from "n3";
import {getFileExtension} from "@/utils/fileExtension";

const { namedNode } = DataFactory;

export function parseShapeFile(data:string): Promise<string[]> {
    return new Promise((resolve, reject) => {
    const parser = new N3.Parser();
    const store = new N3.Store();

    parser.parse(data, (error, quad, prefixes) => {
        if (quad) {
            store.addQuad(quad);
        } else {
            // Parsing complete
            console.log('Parsing complete');
            queryStore(store);
            resolve( queryStore(store));
        }
    });
    });
}

// Query the store to get the shape value
function queryStore(store:any) {
    const shapeTree = namedNode('http://www.w3.org/ns/shapetrees#ShapeTree');
    const shapePredicate = namedNode('http://www.w3.org/ns/shapetrees#shape');

    const quads = store.getQuads(null, shapePredicate, null, null);
    const shapes: string[] =[];
    quads.forEach((quad:Quad) => {
        //Todo remove unnecessary code
        const shapeValue = (quad.object.value).split('#')[0];
        console.log('Shape Value:',shapeValue);
        if(getFileExtension(shapeValue) === 'shape' && !shapes.includes(shapeValue)){
            shapes.push(shapeValue);
        }
    });
    return shapes;
}