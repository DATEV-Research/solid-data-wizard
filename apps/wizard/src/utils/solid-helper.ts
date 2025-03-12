import {Session} from '@datev-research/mandat-shared-solid-oidc';
import {
  DCT,
  getResource,
  INTEROP,
  LDP,
  ParsedN3,
  parseToN3,
  putResource,
  RDF,
  XSD
} from "@datev-research/mandat-shared-solid-requests";
import axios from 'axios';
import {DataFactory, Writer} from "n3";
import {Schema, ShapeDecl} from "shexj";

const { quad, blankNode, namedNode, literal, variable, defaultGraph } = DataFactory;
const ShExParser = require('@shexjs/parser');


/**
   * requests and returns a store if found. Otherwise it returns `null`.
   * @param uri the identifier URL like "https://sme.solid.aifb.kit.edu/shapetrees/d34a5437-fb1c-42dc-9338-79ab9f9ac849"
   * @returns Store object if URI is valid, otherwise null.
   */
  export const requestStore = async (uri: string, session: Session): Promise<ParsedN3 | null> => {
    try {
      const rawRdf = await __getResource(uri, session);
      console.debug(
        "useOrganisationStore [DEBUG]: Parsing raw RDF",
        uri,
        rawRdf
      );
      return await parseToN3(rawRdf, uri);
    } catch (error: unknown) {
      console.error(
        "useOrganisationStore [ERR]: Requesting URI or Parsing Store failed",
        { error, uri }
      );
      return null;
    }
  };

/**
 * Checks e.g. https://sme.solid.aifb.kit.edu/access-inbox/ to be existent and returns true or false.
 *
 * @param uri subject or URI of a container, sample: "https://sme.solid.aifb.kit.edu/"
 * @param name sample: "access-inbox"
 */
export const uriExists = async (uri: string, session: Session) => {
  const store = await requestStore(uri, session);
  return store !== null;
};

/**
 * retrieves the first object-value of the given URI & keyName.
 * If there is no value to retrieve, it returns an empty string and creates a warning console message.
 *
 * @param uri identifier or just a Container URL, sample "https://sme.solid.aifb.kit.edu/shapetrees/d34a5437-fb1c-42dc-9338-79ab9f9ac849"
 * @param keyName predicate or keyName, sample "http://www.w3.org/ns/posix/stat#mtime "
 * @param store store where to retrieve the information from.
 * @returns either the string value or an empty string
 */
export const getFirstObjectValue = (
  uri: string,
  keyName: string,
  store: ParsedN3 | null
): string => {
  const firstValue = __getObjectValues(uri, keyName, store).at(0);
  if (!firstValue) {
    console.warn(
      "useOrganisationStore [WARN]: getFirstObjectValue failed to retrieve value for",
      uri,
      keyName
    );
    return "";
  }
  return firstValue;
};

/**
 * Adds a shapetree definition to the given DataRegistration URI.
 * @param registrationUri data registration URI that should define the new shapeTree
 * @param registeredByUri the registeredBy URI (memberOf URI to /card#me)
 * @param shapeUri URI of the shape that should be used
 * @param shapeTreeUri URI of the shapeTree definition that should be used
 * @param session a valid session instance
 */
export const applyShapeTree = async (
  registrationUri: string,
  registeredByUri: string,
  shapeUri: string,
  shapeTreeUri: string,
  session: Session,
) => {
  const registrationStore = await requestStore(registrationUri, session);
  
  if (!registrationStore) {
    throw new Error("UnexpectedRegistrationURI: Not found or invalid");
  }

  if (!(await uriExists(shapeUri, session))) {
    const response = await axios({ url: 'shapes/pdfBinary.shape', method: "get" });
    await putResource(shapeUri, response.data, session);
  }
  if (!(await uriExists(shapeTreeUri, session))) {
    const response = await axios({ url: 'shapes/pdfBinary.tree', method: "get" });
    await putResource(shapeTreeUri, response.data, session);
  }

  const hasShapeTreeMetaData = getFirstObjectValue(registrationUri, INTEROP("registeredShapeTree"), registrationStore);

  if (!hasShapeTreeMetaData) {
    // TODO Change DataRegistration Meta Data to use ShapeTree accordingly.
    // Patch DataRegistration
    const nowIsoDate = new Date().toISOString();
    const patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.
@prefix xsd:<${XSD()}>.

_:rename a solid:InsertDeletePatch;
    solid:inserts {
        <${registrationUri}> <${INTEROP("registeredShapeTree")}> <${shapeTreeUri}> .
        <${registrationUri}> <${INTEROP("registeredBy")}> <${registeredByUri}> .
        <${registrationUri}> <${INTEROP("registeredWith")}> <#blank> .
        <${registrationUri}> <${INTEROP("registeredAt")}> "${nowIsoDate}"^^xsd:dateTime .
        <${registrationUri}> <${INTEROP("updatedAt")}> "${nowIsoDate}"^^xsd:dateTime .
    } .`;
        await session.authFetch({
          url: registrationUri + '.meta',
          method: "PATCH",
          headers: {
            "Content-Type": "text/n3",
          },
          data: patchBody
        });
  }
};

/**
 * creates a new data-registry if it does not exist already.
 * @param organisationStorageUri 
 * @param registryName
 * @param registrationName
 * @param session 
 * @returns 
 */
export const createDataRegistry = async (organisationStorageUri: string, registryName: string, registrationName: string | undefined, session: Session) => {
    const { rdf: registryRdf, uri: registryUri } = await __createDataRegistryRdf(organisationStorageUri, registryName, registrationName);

    if (!(await uriExists(registryUri, session))) {

        // 1) Create a simple Container

        const response = await session.authFetch({
          url: registryUri,
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle",
            
            // NOTE this somehow does not really work, because the server cannot identify it as a container.
            // "Link": `<${INTEROP("DataRegistry")}>; rel="type"`,

            // NOTE This will cause the solid-server to IGNORE the whole RDF
            "Link": `<${LDP("BasicContainer")}>; rel="type"`,

            // "Slug": registryName,
          },
          data: registryRdf,
        });

        if (registryUri !== response.headers['location']) {
          throw new Error(`createDataRegistry [WARN]: URIs do not match: ${registryUri}, ${response.headers['location']}`);
        }

        // 2) Patch type in ".meta" of the container to be DataRegistry, too.
        const patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.

_:rename a solid:InsertDeletePatch;
    solid:inserts {
        <${registryUri}> <${DCT("title")}> "${registryName}" .
        <${registryUri}> <${RDF("type")}> <${INTEROP("DataRegistry")}> .
    } .`;
        await session.authFetch({
          url: registryUri + '.meta',
          method: "PATCH",
          headers: {
            "Content-Type": "text/n3",
          },
          data: patchBody
        });

        return {
          rdf: registryRdf, uri: response.headers['location'], data: response.data
        }
      } else {
        return {
          rdf: registryRdf, uri: registryUri, data: null
        };
      }
};

/**
 * @param profileRegistryUri
 * @param registryName
 * @param session
 */
export const addProfileRegistryData = async(profileRegistryUri:string, registryName:string, session:Session)=> {
  const patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.

_:rename a solid:InsertDeletePatch;
    solid:inserts {
      <#set>  <${INTEROP("hasDataRegistry")}> </${registryName}/> .
    } .`;
  await session.authFetch({
    url:  profileRegistryUri,
    method: "PATCH",
    headers: {
      "Content-Type": "text/n3",
    },
    data: patchBody
  });
}
/**
 * @param profileRegistryUri
 * @param dataRegistryUri
 * @param session
 */
const __deleteProfileRegistryData = async(profileRegistryUri:string, dataRegistryUri: string, session:Session)=> {
  const patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.

_:rename a solid:InsertDeletePatch;
    solid:deletes {
      <#set>  <${INTEROP("hasDataRegistry")}> <${dataRegistryUri}> .
    } .`;
  await session.authFetch({
    url:  profileRegistryUri,
    method: "PATCH",
    headers: {
      "Content-Type": "text/n3",
    },
    data: patchBody
  });
}

/**
 * @param registryUri
 * @param dataRegistrationUri
 * @param session
 */
const __deleteDataRegistryData = async(registryUri: string, dataRegistrationUri: string, session:Session)=> {
  const patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.

_:rename a solid:InsertDeletePatch;
    solid:deletes {
      <${registryUri}> <${INTEROP("hasDataRegistration")}> <${dataRegistrationUri}> .
    } .`;
  await session.authFetch({
    url:  `${registryUri}.meta`,
    method: "PATCH",
    headers: {
      "Content-Type": "text/n3",
    },
    data: patchBody
  });
}

/**
 * Fetches the children of a single registry, registration or registry set.
 *
 * @param uri
 * @param session
 */
export const getRegistryResource = async (uri:string, session:Session): Promise<string[]> => {
  let store = await requestStore(uri,session);
  if (store === null) {
    // Fallback for binary files like PDFs
    store = await requestStore(`${uri}.meta`,session);
  }
  const types: string[] = __getObjectValues(null,RDF("type"),store);
  let urls: string[] = [];

  if( types.includes(INTEROP("RegistrySet") )){
    urls = __getObjectValues(null, INTEROP("hasDataRegistry"),store);
  }
  else if( types.includes(INTEROP("DataRegistry") )){
    urls = __getObjectValues(null, INTEROP("hasDataRegistration"),store);
  }
  else if( types.includes(INTEROP("DataRegistration") )){
    urls = __getObjectValues(null, LDP("contains"),store);
  }

  return urls;
};

export const deleteRegistryResource = async (profileRegistryUri: string, uri: string, session: Session): Promise<void> => {
  let store = await requestStore(uri, session);
  if (store === null) {
    // Fallback for binary files like PDFs
    store = await requestStore(`${uri}.meta`,session);
  }
  if (store === null) {
    // Fallback to remove meta data only without knowing the type
    await __deleteProfileRegistryData(profileRegistryUri, uri, session).catch(() => null);
    const registryUrl = `${uri.split("/").slice(0, -2).join("/")}/`
    await __deleteDataRegistryData(registryUrl, uri, session).catch(() => null);
    return;
  }

  const types: string[] = __getObjectValues(null,RDF("type"), store);

  if(types.includes(INTEROP("DataRegistry") )){
    await __deleteProfileRegistryData(profileRegistryUri, uri, session).catch(() => null);
  }

  if( types.includes(INTEROP("DataRegistration") )){
    // remove trailing Slash /
    // remove Data Registration name from URL
    // From: "https://sme.solid.aifb.kit.edu/user12/user12Data/"
    // To  : "https://sme.solid.aifb.kit.edu/user12/"
    const registryUrl = `${uri.split("/").slice(0, -2).join("/")}/`
    await __deleteDataRegistryData(registryUrl, uri, session).catch(() => null);
  }

  await session.authFetch({url: uri, method: 'DELETE'});
};

const __getResource = async(uri:string, session:Session)=> {
  const headers = {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
  return await getResource(uri, session, headers).then(({ data }) => data);
}
/**
 * Verifies if the given URI is a DataRegistry by checking the entity's type.
 * @param registryUri 
 * @param session 
 * @returns 
 */
export const verifyDataRegistry = async (registryUri: string, session: Session) => {
  const parsedN3 = await requestStore(registryUri, session);
    if (parsedN3) {
      const storeTypes = parsedN3.store.getObjects(null, RDF("type"), null).map(({id}) => id);
      const hasDataRegistry = storeTypes.some(id => id.includes(INTEROP("DataRegistry")));
      return hasDataRegistry;
    }
    return false;
}

export const createShapeTreeContainerData = async (containerURI: string, shapeName: string, session:Session) =>{
  // 1) Create Basic Container
  const { rdf: shapeTreeRdf, uri: shapeTreeUri } = await __createShapeTreeRdf(containerURI, shapeName);

  if (!(await uriExists(shapeTreeUri, session))) {

    // 1) Create Basic Container
    const response = await session.authFetch({
      url: shapeTreeUri,
      method: "PUT",
      headers: {
        "Content-Type": "text/turtle",

        // NOTE this somehow does not really work, because the server cannot identify it as a container.
        // "Link": `<${INTEROP("DataRegistration")}>; rel="type"`,

        // NOTE This will cause the solid-server to IGNORE the whole RDF
        "Link": `<${LDP("BasicContainer")}>; rel="type"`,

        // "Slug": registrationName,
      },
      data: shapeTreeRdf,
    });
  }
}
export const getShapeFilesUri = async (uri: string, session: Session) => {
  console.log("=>getShapeFiles", uri);
    const store = await requestStore(uri, session);
    console.log("=>store", store);
    if (store === null) {
        return [];
    }
    return __getObjectValues(null, LDP("contains"), store).filter(shape => shape.endsWith(".shape") ?? shape );
}

export const compareShapeContent = async (shapeUris:string[],localShapeContent:string,session: Session) =>{
  shapeUris.map(async(uri)=>{
    const remoteShapeContent:string = await getShapeContent(uri,session);
    try{
      // Compare remote shape file with the local shape file
      const isFound = shapeFileFound(remoteShapeContent,localShapeContent);
      console.log('Shape File found: ',isFound);
      if(isFound)
      {
        // shape file found
        console.log(uri);
      }
    }
    catch (err){
      console.log(err);
    }

  })
}

const isSchemaCountEqual = (remoteSchema:Schema,localSchema:Schema) => {
  // count the number of schema in shape file of remote and local shape file
  return remoteSchema.shapes?.length ===  localSchema.shapes?.length
}
const isSchemaContentSame = (remoteSchema:Schema,localSchema:Schema) => {
  // check if the content of the schema are same in the both files
    console.log(remoteSchema);
    console.log(localSchema);
    localSchema.shapes?.map((shape:ShapeDecl) => {
     const localShapeName = shape.id;
     const remoteShapeContent = remoteSchema.shapes?.find(schema => schema.id === localShapeName);
     const localShapeExp = shape.shapeExpr as any;
     const localShapeExpressions = localShapeExp.expression.expressions;

      const remoteShapeExp = remoteShapeContent?.shapeExpr as any;
      const remoteShapeExpressions = remoteShapeExp.expression.expressions;

      return localShapeExpressions.map((localExp:any) => remoteShapeExpressions.find((remoteExp:any) => remoteExp.predicate === localExp.predicate )).length === localShapeExpressions?.length;

     //console.log(remoteShapeContent);
    })
  return true;
}
const isSchemaNameSame = (remoteSchema:Schema,localSchema:Schema) => {
  // check if the schema name are same in both files
  return localSchema.shapes?.map((shape:ShapeDecl) => remoteSchema.shapes?.find(remoteShape => remoteShape.id ===shape.id)).length === localSchema.shapes?.length;
}
const shapeFileFound = (remoteShapeContent:string,localShapeContent:string) => {
  // check if the shape file is found by comparing the shape file
  const remoteSchema:Schema = ShExParser.construct().parse(remoteShapeContent);
  const localSchema:Schema = ShExParser.construct().parse(localShapeContent);

  // Check total schema are same in both files
  if(isSchemaCountEqual(remoteSchema,localSchema)){
    if(isSchemaNameSame(remoteSchema,localSchema))
    {
      if(isSchemaContentSame(remoteSchema,localSchema)){
        return true
      }
    }
  }
  else{
    return false;
  }
}

export const getShapeContent = async (uri:string,session: Session): Promise<string> =>{
  // Get the shape content from the shaptrees container
  const headers = {
    Accept: "text/turtle,application/*,image/*,application/octet-stream",
    /*    'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'*/
  };
  return new Promise((resolve, reject) => {
    session.authFetch({
      url: uri,
      method: "GET",
      headers,
    }).then(response => {
      resolve(response.data);
    });
  });
}

/**
 * creates a new data-registration if it does not exist already.
 * @param registryUri 
 * @param registrationName 
 * @param session 
 * @returns 
 */
export const createDataRegistration = async (registryUri: string, registrationName: string, session: Session) => {
  const { rdf: registrationRdf, uri: registrationUri } = await __createDataRegistrationRdf(registryUri, registrationName);

    if (!(await uriExists(registrationUri, session))) {
      
      // 1) Create Basic Container
      const response = await session.authFetch({
        url: registrationUri,
        method: "PUT",
        headers: {
          "Content-Type": "text/turtle",
            
          // NOTE this somehow does not really work, because the server cannot identify it as a container.
          // "Link": `<${INTEROP("DataRegistration")}>; rel="type"`,

          // NOTE This will cause the solid-server to IGNORE the whole RDF
          "Link": `<${LDP("BasicContainer")}>; rel="type"`,

          // "Slug": registrationName,
        },
        data: registrationRdf,
      });

      if (registrationUri !== response.headers['location']) {
        throw new Error(`createDataRegistration [WARN]: URIs do not match: ${registrationUri}, ${response.headers['location']}`);
      }

      // 2) Patch type in ".meta" of the container to be DataRegistry, too.
      let patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.

_:rename a solid:InsertDeletePatch;
  solid:inserts {
      <${registrationUri}> <${DCT("title")}> "${registrationName}" .
      <${registrationUri}> <${RDF("type")}> <${INTEROP("DataRegistration")}> .
  } .`;
      await session.authFetch({
        url: registrationUri + '.meta',
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        data: patchBody
      });
      
      // 3) Patch registry for "hasDataRegistration" predicate
      patchBody = `
@prefix solid:<http://www.w3.org/ns/solid/terms#>.
@prefix interop:<${INTEROP()}>.

_:rename a solid:InsertDeletePatch;
  solid:inserts {
      <${registryUri}> <${INTEROP("hasDataRegistration")}> <${registrationName}/> .
  } .`;
   
      await session.authFetch({
        url: registryUri + '.meta',
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        data: patchBody
      });

      return {
        rdf: registrationUri, uri: response.headers['location'], data: response.data
      }
    } else {
      return {
        rdf: registrationUri, uri: registryUri, data: null
      }
    }
}

export const updateRegistryACLPermission = async(uri:string, registryName:string, session:Session) => {
  const aclURI = uri + '.acl';
  const patchBody = `@prefix : <#>.
      @prefix acl: <http://www.w3.org/ns/auth/acl#>.
      @prefix foaf: <http://xmlns.com/foaf/0.1/>.
      @prefix ${registryName}: <./>.
      @prefix c: </profile/card#>.
  
      :ControlReadWrite
          a acl:Authorization;
          acl:accessTo ${registryName}:;
          acl:agent c:me, <mailto:info@sme.com>;
          acl:default ${registryName}:;
          acl:mode acl:Control, acl:Read, acl:Write.
      :Read
          a acl:Authorization;
          acl:accessTo ${registryName}:;
          acl:agentClass foaf:Agent;
          acl:default ${registryName}:;
          acl:mode acl:Read.
      `
;
      await session.authFetch({
        url: aclURI,
        method: "PUT",
        headers: {
          "Content-type": "text/n3",
        },
        data: patchBody
      });
}
export const updateShapeTreeContainerACLPermission = async(uri:string, shapeTreeName:string, session:Session) => {
  const aclURI = uri + '.acl';
  const patchBody = `
    @prefix : <#>.
    @prefix acl: <http://www.w3.org/ns/auth/acl#>.
    @prefix foaf: <http://xmlns.com/foaf/0.1/>.
    @prefix ${shapeTreeName}: <./>.
    @prefix c: </profile/card#>.
    
    :ControlReadWriteDefault
      a acl:Authorization;
      acl:default ${shapeTreeName}:;
      acl:accessTo ${shapeTreeName}:;
      acl:agent c:me, <mailto:info@sme.com>;
      acl:mode acl:Control, acl:Read, acl:Write.
    
    :ReadWriteDefault
      a acl:Authorization;
      acl:accessTo ${shapeTreeName}:;
      acl:agentClass foaf:Agent;
      acl:default ${shapeTreeName}:;
      acl:mode acl:Read, acl:Write.
      `
  ;
  await session.authFetch({
    url: aclURI,
    method: "PUT",
    headers: {
      "Content-type": "text/n3",
    },
    data: patchBody
  });
}
export const updateRegistrationACLPermission = async(uri:string, registrationName:string, session:Session) => {
  const aclURI = uri + '.acl';
  const patchBody = `@prefix : <#>.
    @prefix acl: <http://www.w3.org/ns/auth/acl#>.
    @prefix foaf: <http://xmlns.com/foaf/0.1/>.
    @prefix ${registrationName}: <./>.
    @prefix c: </profile/card#>.
    
    :ControlReadWrite
        a acl:Authorization;
        acl:accessTo ${registrationName}:;
        acl:agent c:me, <mailto:info@sme.com>;
        acl:mode acl:Control, acl:Read, acl:Write.
    :ControlReadWriteDefault
        a acl:Authorization;
        acl:agent c:me, <mailto:info@sme.com>;
        acl:default ${registrationName}:;
        acl:mode acl:Control, acl:Read, acl:Write.
    :Read
        a acl:Authorization;
        acl:accessTo ${registrationName}:;
        acl:agentClass foaf:Agent;
        acl:mode acl:Read.
      `
  ;
  await session.authFetch({
    url: aclURI,
    method: "PUT",
    headers: {
      "Content-type": "text/n3",
    },
    data: patchBody
  });
}

/**
 * Verifies if the given URI is a DataRegistry by checking the entity's type.
 * @param registrationUri 
 * @param session 
 * @returns 
 */
export const verifyDataRegistration = async (registrationUri: string, session: Session) => {
  const parsedN3 = await requestStore(registrationUri, session);
    if (parsedN3) {
      const storeTypes = parsedN3.store.getObjects(null, RDF("type"), null).map(({id}) => id);
      const hasDataRegistration = storeTypes.some(id => id.includes(INTEROP("DataRegistration")));
      return hasDataRegistration;
    }
    return false;
}

/**
 * creates an namend data-instance (instead of using a UUID) and returns the full URI for it.
 * @param registrationUri 
 * @param dataInstanceName 
 * @param body 
 * @param mimeType 
 * @param session 
 * @returns 
 */
export const createNamedDataInstance = async (registrationUri: string, dataInstanceName: string, body: any, mimeType: string, session: Session) => {
  const uri = `${registrationUri}/${dataInstanceName}`;
  const response = await session.authFetch({
    url: uri,
    method: "PUT",
    headers: {
      "Content-type": mimeType,
    },
    data: body,
  });

  return uri;
};

/**
 * create a datainstance for the given data-registration uri and return the location of the created entry.
 * @param registrationUri 
 * @param body 
 * @param mimeType 
 * @param session 
 * @returns 
 */
export const createDataInstance = async (registrationUri: string, body: any, mimeType: string, session: Session) => {
  const response = await session.authFetch({
    url: registrationUri,
    method: "POST",
    headers: {
      "Content-type": mimeType,
    },
    data: body,
  });

  return response.headers["location"];
};
const __createShapeTreeRdf = async(storageUri: string, shapeTreeName: string): Promise<{ rdf: string, uri: string }> =>{

return new Promise((resolve, reject) => {
  const uri = `${storageUri}${shapeTreeName}/`;
  const now = new Date();
  const nowUtcString = now.toISOString();
  const nowTimestampString = Math.floor(now.getTime() / 1000);

  const writer = new Writer({
    format: "text/turtle",
    prefixes: {
      interop: INTEROP(),
      ldp: LDP(),
      dc: DCT(),
      xsd: XSD(),
    },
  });

  writer.addQuads(
      [
        // define own types
        quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(LDP("Container")),
            defaultGraph()
        ),
        quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(LDP("BasicContainer")),
            defaultGraph()
        ),
        quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(LDP("Resource")),
            defaultGraph()
        ),
        quad(
            namedNode(uri),
            namedNode(DCT("modified")),
            literal(nowUtcString/*, "xsd:dateTime"*/),
            defaultGraph()
        ),
        quad(
            namedNode(uri),
            namedNode("http://www.w3.org/ns/posix/stat#mtime"),
            literal(nowTimestampString),
            defaultGraph()
        ),
      ]
  );
  writer.end((error, resultRdf) => {
    if (error) {
      reject(error);
    } else {
      resolve({ rdf: resultRdf.replace(new RegExp(uri, "g"), ""), uri });
    }
  });
});
}
  /**
   * Create RDF for a new Data Registry
   * @param storageUri
   * @param dataRegistryName
   * @param dataRegistrationName
   * @returns
   */
const __createDataRegistryRdf = async (
    storageUri: string,
    dataRegistryName: string,
    dataRegistrationName?: string
  ): Promise<{ uri: string; rdf: string }> => {
    return new Promise((resolve, reject) => {
      const uri = `${storageUri}${dataRegistryName}/`;
      const now = new Date();
      const nowUtcString = now.toISOString();
      const nowTimestampString = Math.floor(now.getTime() / 1000);

      const writer = new Writer({
        format: "text/turtle",
        prefixes: {
          interop: INTEROP(),
          ldp: LDP(),
          dc: DCT(),
          xsd: XSD(),
        },
      });

      /*
       * These are quads that should be set actually, but the server won't use this RDF when
       * the Headers contain a "Link" with a different type than "DataRegistry"
       */
      writer.addQuads(
        [
          // define own types
          quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(INTEROP("DataRegistry")),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(LDP("Container")),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(LDP("BasicContainer")),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode(RDF("type")),
            namedNode(LDP("Resource")),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode(DCT("modified")),
            literal(nowUtcString/*, "xsd:dateTime"*/),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode("http://www.w3.org/ns/posix/stat#mtime"),
            literal(nowTimestampString),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode(DCT("title")),
            literal(dataRegistryName),
            defaultGraph()
          ),
        ]
      );

      if (dataRegistrationName) {
        writer.addQuads([
          // define relations
          quad(
            namedNode(uri),
            namedNode(INTEROP("hasDataRegistration")),
            namedNode(dataRegistrationName),
            defaultGraph()
          ),
          quad(
            namedNode(uri),
            namedNode(LDP("contains")),
            namedNode(dataRegistrationName),
            defaultGraph()
          ),
          // define data-registration
          quad(
            namedNode(dataRegistrationName),
            namedNode(RDF("type")),
            namedNode(INTEROP("DataRegistration")),
            defaultGraph()
          ),
          quad(
            namedNode(dataRegistrationName),
            namedNode(RDF("type")),
            namedNode(LDP("Container")),
            defaultGraph()
          ),
          quad(
            namedNode(dataRegistrationName),
            namedNode(RDF("type")),
            namedNode(LDP("BasicContainer")),
            defaultGraph()
          ),
          quad(
            namedNode(dataRegistrationName),
            namedNode(RDF("type")),
            namedNode(LDP("Resource")),
            defaultGraph()
          ),
          quad(
            namedNode(dataRegistrationName),
            namedNode(DCT("modified")),
            literal(nowUtcString/*, "xsd:dateTime"*/),
            defaultGraph()
          ),
          quad(
            namedNode(dataRegistrationName),
            namedNode("http://www.w3.org/ns/posix/stat#mtime"),
            literal(nowTimestampString),
            defaultGraph()
          ),
          quad(
            namedNode(dataRegistrationName),
            namedNode(DCT("title")),
            literal(dataRegistryName),
            defaultGraph()
          ),
        ]);
      }
      
      writer.end((error, resultRdf) => {
        if (error) {
          reject(error);
        } else {
          resolve({ rdf: resultRdf.replace(new RegExp(uri, "g"), ""), uri });
        }
      });
    });
  };


  /**
   * Create RDF for a new Data Registry
   * @param storageUri
   * @param dataRegistryName
   * @returns
   */
  const __createDataRegistrationRdf = async (
    dataRegistryUri: string,
    dataRegistrationName: string
  ): Promise<{ uri: string; rdf: string }> => {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        format: "text/turtle",
        prefixes: {
          interop: INTEROP(),
          ldp: LDP(),
        },
      });
      const uri = `${dataRegistryUri}${dataRegistrationName}/`;

      writer.addQuads([
        quad(
          namedNode(uri),
          namedNode(RDF("type")),
          namedNode(INTEROP("DataRegistration")),
          defaultGraph()
        ),
        quad(
          namedNode(uri),
          namedNode(RDF("type")),
          namedNode(LDP("Container")),
          defaultGraph()
        ),
        quad(
          namedNode(uri),
          namedNode(RDF("type")),
          namedNode(LDP("BasicContainer")),
          defaultGraph()
        ),
        quad(
          namedNode(uri),
          namedNode(RDF("type")),
          namedNode(LDP("Resource")),
          defaultGraph()
        ),
        quad(
          namedNode(uri),
          namedNode(DCT("title")),
          literal(dataRegistrationName),
          defaultGraph()
        ),
      ]);

      /** *
      writer.addQuad(
        namedNode(uri),
        namedNode(INTEROP("registeredShapeTree")),
        blankNode(),
        defaultGraph()
      );
      /** */

      writer.end((error, resultRdf) => {
        if (error) {
          reject(error);
        } else {
          resolve({ rdf: resultRdf.replace(new RegExp(uri, "g"), ""), uri });
        }
      });
    });
  };

  /**
   * Logs the contents of a store including their subjects and predicates.
   * @param store the store that should be logged to console.
   * @param name the store's name.
   */
  const __logStore = (parsedN3: ParsedN3 | null, name?: string): void => {
    if (parsedN3) {
      // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getGraphs`, parsedN3.getGraphs(null, null, null));
      // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getPredicates`, parsedN3.getPredicates(null, null, null));
      // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getQuads`, parsedN3.getQuads(null, null, null, null));
      // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getObjects`, parsedN3.getObjects(null, null, null));
      // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getSubjects`, parsedN3.getSubjects(null, null, null));

      const mappedObject = parsedN3.store
        .getSubjects(null, null, null)
        .reduce((obj, currentSubject) => {
          const { value: subjectValue } = currentSubject;
          obj[subjectValue] = parsedN3.store
            .getPredicates(subjectValue, null, null)
            .reduce((acc, current) => {
              const { value: predicateValue } = current;
              acc[predicateValue] = __getObjectValues(
                subjectValue,
                predicateValue,
                parsedN3
              ).map((value) => __mapValue(predicateValue, value));
              return acc;
            }, {} as Record<string, unknown>);
          return obj;
        }, {} as Record<string, Record<string, unknown>>);

      console.debug(
        `useOrganisationStore.__logStore [DEBUG]: ${name}.getObjects`,
        mappedObject
      );
    }
  };

  /**
   * @param uri identifier or just a Container URL, sample "https://sme.solid.aifb.kit.edu/shapetrees/d34a5437-fb1c-42dc-9338-79ab9f9ac849"
   * @param keyName (optional) predicate or keyName, sample RDF("type")
   * @param parsedN3 parsedN3 where to retrieve the information from. Can be `null`, but then the result is also `null`.
   * @returns sample `[ "http://www.w3.org/ns/ldp#Resource", "http://www.w3.org/ns/iana/media-types/application/pdf#Resource" ]`
   */
  const __getObjectValues = (
    uri: string | null = null,
    keyName: string | null = null,
    parsedN3: ParsedN3 | null = null
  ): string[] => {
    if (!parsedN3) {
      return [];
    }

    return parsedN3.store
      .getObjects(uri, keyName ?? null, null)
      .map((a) => a.value);
  };

  /**
   * maps object values to their predicate defined type, like Date or Number.
   * @param predicate predicate value that defines the type
   * @param value the raw string value that should be converted/mapped.
   * @returns
   */
  const __mapValue = (predicate: string, value: string): unknown => {
    switch (predicate) {
      case "http://purl.org/dc/terms/modified":
        return new Date(value); // value is ISO String
      case "http://www.w3.org/ns/posix/stat#mtime":
        return new Date(Number(`${value}000`)); // value is Timestamp in seconds
      case "http://www.w3.org/ns/posix/stat#size":
        return Number(`${value}`); // value is number
      default:
        return value;
    }
  };
