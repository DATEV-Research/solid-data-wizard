// Parse the shape file
import N3, {DataFactory, Quad} from "n3";

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
            queryStore(store);
            resolve( queryStore(store));
        }
    });
    });
}

// Query the store to get the shape value
function queryStore(store:any) {
    const shapePredicate = namedNode('http://www.w3.org/ns/shapetrees#shape');
    const quads = store.getQuads(null, shapePredicate, null, null);
    const shapes: string[] =[];

    quads.forEach((quad:Quad) => {
        const shapeValue = (quad.object.value).split('#')[0];
        shapes.push(shapeValue);
    });

    return shapes;
}