import { Session } from '@datev-research/mandat-shared-solid-oidc';
import { DCT, getResource, INTEROP, LDP, ParsedN3, parseToN3, putResource, RDF, XSD } from "@datev-research/mandat-shared-solid-requests";
import axios from 'axios';
import { DataFactory, Writer } from "n3";

const { quad, blankNode, namedNode, literal, variable, defaultGraph } = DataFactory;

  /**
   * requests and returns a store if found. Otherwise it returns `null`.
   * @param uri the identifier URL like "https://sme.solid.aifb.kit.edu/shapetrees/d34a5437-fb1c-42dc-9338-79ab9f9ac849"
   * @returns Store object if URI is valid, otherwise null.
   */
  export const requestStore = async (uri: string, session: Session): Promise<ParsedN3 | null> => {
    try {
      const rawRdf = await getResource(uri, session).then(({ data }) => data);
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
    uri: string,
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
