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
  addProfileRegistryData,
  getRegistryResource,
  deleteRegistryResource,
  updateRegistryACLPermission,
  updateRegistrationACLPermission,
  updateShapeTreeContainerACLPermission, createShapeTreeContainerData
} from "@/utils/solid-helper";
import {
  useIsLoggedIn,
  useSolidProfile,
  useSolidSession,
} from "@datev-research/mandat-shared-composables";
import {
  ParsedN3, putResource,
  SPACE,
} from "@datev-research/mandat-shared-solid-requests";
import {TreeNode} from "primevue/treenode";
import { computed, ref, watch } from "vue";
import {getFileExtension} from "@/utils/fileExtension";
import {TTL_EXTENSION} from "@/constants/extensions";

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
const SOLID_PROFILE_REGISTRY_URI = "https://sme.solid.aifb.kit.edu/profile/registry";

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

  const getRegistryLabel = (uri: string): string => {
    return `${uri.split("/").at(-2)}`;
  }
  const getRegistrationLabel = (uri: string): string => {
    return `${uri.split("/").at(-2)}`;
  }
  const getDataInstanceLabel = (uri: string): string => {
    return `${uri.split("/").at(-1)}`;
  }

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
    createShape: async (uri:string, contentShape:string, headers: Record<string, string>)=>{
      await putResource(uri,contentShape,session, headers);
    },
    createShapeTree:async (uri:string, contentShapeTree:string, headers: Record<string, string>)=>{
      await putResource(uri,contentShapeTree,session, headers);
    },
    updateProfileRegistry: async (registryName: string) => {
      await addProfileRegistryData(`${SOLID_PROFILE_REGISTRY_URI}`,registryName, session);
    },
    shapeTreeContainerExists: (shapeTreeName: string) => uriExists(`${organisationStorageUri.value}${shapeTreeName}/`, session),
    createShapeTreeContainer: async (shapeTree:string) => {
      await createShapeTreeContainerData(`${organisationStorageUri.value}`, shapeTree, session);
      await updateShapeTreeContainerACLPermission(`${organisationStorageUri.value}${shapeTree}/`,shapeTree, session);
    },
    createRegistration: async (registryName: string, registrationName: string) => {
      const { rdf: registrationRdf, uri: registrationUri } = await createDataRegistration(`${organisationStorageUri.value}${registryName}/`, registrationName, session);
      if (!(await verifyDataRegistration(registrationUri, session))) {
        throw new Error("UnexpectedError: registration Type is not set correctly, after creating it.");
      }
      await applyShapeTree(
          registrationUri,
          memberOf.value,
          SOLD_PDF_BINARY_SHAPE_URI,
          SOLD_PDF_BINARY_SHAPETREE_URI,
          session,
      );
    },
    updateACLPermission: async (registryName: string, registrationName:string) => {
      await updateRegistryACLPermission(`${organisationStorageUri.value}${registryName}/`,registryName, session);
      await updateRegistrationACLPermission(`${organisationStorageUri.value}${registryName}/${registrationName}/`,registrationName, session);
    },
    uploadFile: (file: File, registryName: string, registrationName: string) => {
      let mimeType = file.type;
      if(getFileExtension(file.name) === TTL_EXTENSION){
        mimeType = "text/turtle";
      }
      createNamedDataInstance(
          `${organisationStorageUri.value}${registryName}/${registrationName}`,
          file.name,
          file,
          mimeType,
          session
      )
    },
    deleteRegistry: async (registryUri: string) => {
      await deleteRegistryResource(SOLID_PROFILE_REGISTRY_URI, registryUri, session);
    },
    getFullRegistry: async ()=> {
      const registries = await getRegistryResource(SOLID_PROFILE_REGISTRY_URI, session);
      const registrations = await Promise.all(registries.map(registrationUri => getRegistryResource(registrationUri, session)));
      const dataInstances = await Promise.all(registrations.map(dataInstances => Promise.all(dataInstances.map(dataInstanceUri => getRegistryResource(dataInstanceUri, session)))));

      const treeNode: TreeNode[] = registries.map((registryUri, registryIndex) => {
        return {
          key: registryUri,
          data: { x : Math.random() },
          label: getRegistryLabel(registryUri),
          type: 'DataRegistry',
          children: registrations[registryIndex].map((registrationUri, registrationIndex) => {
            return {
              key: registrationUri,
              data: { x : Math.random() },
              label: getRegistrationLabel(registrationUri),
              type: 'DataRegistration',
              children: dataInstances[registryIndex][registrationIndex].map(uri => {
                return {
                  key: uri,
                  data: { x : Math.random() },
                  label: getDataInstanceLabel(uri),
                  type: 'DataInstance',
                  leaf: true,
                }
              })
            }
          })
        }
      });

      return treeNode;
    },
  };
};
