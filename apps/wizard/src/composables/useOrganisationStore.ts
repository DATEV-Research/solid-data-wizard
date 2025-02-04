import {
  uriExists,
  requestStore,
  getFirstObjectValue,
  createNamedDataInstance,
  createDataRegistry,
  verifyDataRegistry,
  createDataRegistration,
  verifyDataRegistration,
  applyShapeTree,
  updateProfileRegistryData, getProfileRegistry
} from "@/utils/solid-helper";
import {
  useIsLoggedIn,
  useSolidProfile,
  useSolidSession,
} from "@datev-research/mandat-shared-composables";
import {
  ParsedN3,
  SPACE,
} from "@datev-research/mandat-shared-solid-requests";
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
 * - ☑️ add upload file button for the user
 * - ☑️ add upload mechanism using the data registry & data registration path.
 * - ☑️ test if it is using the right mime-types and so on.
 * - handle errors
 * - write tests
 */

const SOLD_PDF_BINARY_SHAPE_URI = "https://sme.solid.aifb.kit.edu/shapetrees/pdfBinary.shape"
const SOLD_PDF_BINARY_SHAPETREE_URI = "https://sme.solid.aifb.kit.edu/shapetrees/pdfBinary.tree"
const SOLD_PROFILE_REGISTRY_URI = "https://sme.solid.aifb.kit.edu/profile/registry";

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

    registryExists: (registryName: string) => uriExists(`${organisationStorageUri.value}${registryName}/`, session),
    registrationExists: (registryName: string, registrationName: string) => uriExists(`${organisationStorageUri.value}${registryName}/${registrationName}/`, session),

    createRegistry: async (registryName: string) => {
      const { rdf: registryRdf, uri: registryUri } = await createDataRegistry(organisationStorageUri.value, registryName, undefined, session);
      if (!(await verifyDataRegistry(registryUri, session))) {
        throw new Error("UnexpectedError: registry Type is not set correctly, after creating it.");
      }
    },
    updateProfileRegistry: async (registryName: string) => {
      await updateProfileRegistryData(`${SOLD_PROFILE_REGISTRY_URI}`,registryName, session);
    },
    createRegistration: async (registryName: string, registrationName: string) => {
      const { rdf: registrationRdf, uri: registrationUri } = await createDataRegistration(`${organisationStorageUri.value}${registryName}/`, registrationName, session);
      if (!(await verifyDataRegistration(registrationUri, session))) {
        throw new Error("UnexpectedError: registration Type is not set correctly, after creating it.");
      }
      applyShapeTree(
        registrationUri,
        memberOf.value,
        SOLD_PDF_BINARY_SHAPE_URI,
        SOLD_PDF_BINARY_SHAPETREE_URI,
        session,
      );
    },
    
    uploadFile: (file: File, registryName: string, registrationName: string) => createNamedDataInstance(
        `${organisationStorageUri.value}${registryName}/${registrationName}`,
        file.name,
        file,
        file.type,
        session
    ),
    getProfileRegistry:()=> getProfileRegistry(SOLD_PROFILE_REGISTRY_URI, session)

  };
};
