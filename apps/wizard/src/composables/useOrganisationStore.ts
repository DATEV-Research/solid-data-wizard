import { uriExists, requestStore, getFirstObjectValue, createNamedDataInstance } from "@/utils/solid-helper";
import {
  useIsLoggedIn,
  useSolidProfile,
  useSolidSession,
} from "@datev-research/mandat-shared-composables";
import {
  ParsedN3,
  SPACE,
} from "@datev-research/mandat-shared-solid-requests";
import { Writer, DataFactory, NamedNode } from "n3";
import { computed, ref, watch } from "vue";

/**
 * TODOs
 *
 * Base SME URI: https://sme.solid.aifb.kit.edu
 *
 * - validate given names using a regex
 * - ☑️ get data registry by URI and check if it exists, sample https://sme.solid.aifb.kit.edu/dataregistry
 *   - ☑️ if it exists, skip creating it
 *   - ☑️ if it does not exist: create data registry for given name using n3.Writer
 * - ☑️ get data registration by URI and check if it exists, sample https://sme.solid.aifb.kit.edu/dataregistry/dataregistrations
 *   - ☑️ if it exists: throw an error,
 *   - ☑️ if it does not exist: create data registration for given name using n3.Writer
 *
 * - add upload file button for the user
 * - add upload mechanism using the data registry & data registration path.
 * - test if it is using the right mime-types and so on.
 * - handle errors
 * - write tests
 */

/** Testing n3-writer *
const { namedNode, literal, quad } = DataFactory;
const writer = new Writer({
  format: "text/turtle",
  prefixes: { c: 'http://example.org/cartoons#' },
});
writer.addQuad(
  quad(
    namedNode('http://example.org/cartoons#Tom'),
    namedNode('http://example.org/cartoons#name'),
    literal('Tom')                                
  )
);
writer.end((error, result) => console.log(result));
/** */

export const useOrganisationStore = () => {
  const { isLoggedIn } = useIsLoggedIn();
  const { memberOf } = useSolidProfile();
  const { session } = useSolidSession();

  const organisationStore = ref<ParsedN3 | null>(null);
  const organisationStorageUri = computed<string>(() => getFirstObjectValue(
    memberOf.value,
    SPACE("storage"),
    organisationStore.value
  ));

  /**
   * internal initialisation of the `organisationStore`.
   */
  const __initiate = async () => {
    organisationStore.value = await requestStore(memberOf.value, session);

    /* Sample how to create registry, registration and data instances:
    const { uri: registryUri } = await createDataRegistry(organisationStorageUri, "myDataRegistry", session);
    const { uri: registrationUri } = await createDataRegistration(registryUri, 'anotherName', session);
    const result1 = await createNamedDataInstance(registrationUri, 'another-name', '["some-data"]', "application/json", session)
    const result2 = await createDataInstance(registrationUri, '["some-more-data"]', "application/json", session)
    console.log('DATA INSTANCES', result1, result2);
    /* */
  };

  /**
   * watch change of `memberOf` to initiate the organisationStore.
   * Changes to memberOf mean the user logged in or changed.
   */
  watch(
    memberOf,
    async () => {
      if (isLoggedIn.value) {
        await __initiate();
      }
    },
    { immediate: true }
  );

  return {
    // storageUri: organisationStorageUri,

    registryExists: (registryName: string) => uriExists(`${organisationStorageUri.value}${registryName}`, session),
    registrationExists: (registryName: string, registrationName: string) => uriExists(`${organisationStorageUri.value}${registryName}/${registrationName}`, session),
    
    uploadFile: (file: File, registryName: string, registrationName: string) => createNamedDataInstance(
        `${organisationStorageUri.value}${registryName}/${registrationName}`,
        file.name,
        file,
        file.type,
        session
    ),

  };
};
