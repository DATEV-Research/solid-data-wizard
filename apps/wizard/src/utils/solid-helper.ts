import { Session } from '@datev-research/mandat-shared-solid-oidc';
import { getResource, INTEROP, LDP, ParsedN3, parseToN3 } from "@datev-research/mandat-shared-solid-requests";
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
  const checkUri = `${uri}/`;
  const store = await requestStore(
    checkUri.replace(new RegExp("//", "g"), "/"), session
  );
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
 * creates a new data-registry if it does not exist already.
 * @param organisationStorageUri 
 * @param registryName 
 * @param session 
 * @returns 
 */
export const createDataRegistry = async (organisationStorageUri: string, registryName: string, session: Session) => {
    const { rdf: registryRdf, uri: registryUri } = await __createDataRegistryRdf(organisationStorageUri, registryName);

    if (!(await uriExists(registryUri, session))) {
        const response = await session.authFetch({
          url: registryUri,
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle",
          },
          data: registryRdf,
        });

        return {
          rdf: registryRdf, uri: registryUri, data: response.data
        }
      } else {
        return {
          rdf: registryRdf, uri: registryUri, data: null
        };
      }
};

/**
 * creates a new data-registration if it does not exist already.
 * @param registryUri 
 * @param registryName 
 * @param session 
 * @returns 
 */
export const createDataRegistration = async (registryUri: string, registryName: string, session: Session) => {
  const { rdf: registrationRdf, uri: registrationUri } = await __createDataRegistrationRdf(registryUri, registryName);

    if (!(await uriExists(registrationUri, session))) {
      const response = await session.authFetch({
        url: registrationUri,
        method: "PUT",
        headers: {
          "Content-Type": "text/turtle",
          // Link: `<${LDP("Container")}>; rel="type", <${LDP("BasicContainer")}>; rel="type", <${LDP("Resource")}>; rel="type", <${LDP("DataRegistration")}>; rel="type"`,
        },
        data: registrationRdf,
      });
      return {
        rdf: registrationUri, uri: registryUri, data: response.data
      }
    } else {
      return {
        rdf: registrationUri, uri: registryUri, data: null
      }
    }
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
  const uri = `${registrationUri}${dataInstanceName}`;
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
   * @returns
   */
const __createDataRegistryRdf = async (
    storageUri: string,
    dataRegistryName: string
  ): Promise<{ uri: string; rdf: string }> => {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        format: "text/turtle",
        prefixes: {
          interop: INTEROP(),
          ldp: LDP(),
        },
      });
      const uri = `${storageUri}${dataRegistryName}/`;

      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("DataRegistry")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("Container")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("BasicContainer")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("Resource")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode(INTEROP("hasDataRegistration")),
        blankNode(),
        defaultGraph()
      );

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

      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("DataRegistration")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("Container")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("BasicContainer")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        namedNode(INTEROP("Resource")),
        defaultGraph()
      );
      writer.addQuad(
        namedNode(uri),
        namedNode(INTEROP("registeredShapeTree")),
        blankNode(),
        defaultGraph()
      );

      writer.end((error, resultRdf) => {
        if (error) {
          reject(error);
        } else {
          resolve({ rdf: resultRdf.replace(new RegExp(uri, "g"), ""), uri });
        }
        console.debug("useOrganisationStore [DEBUG]: CREATE RDF:", resultRdf);
        // putResource(newRessourceUri, resultRdf, session);
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
   * @param keyName (optional) predicate or keyName, sample "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
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
