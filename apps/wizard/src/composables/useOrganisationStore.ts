import {
  addProfileRegistryData,
  applyShapeTree,
  compareShapeContent,
  createDataRegistration,
  createDataRegistry,
  createNamedDataInstance,
  createShapeTreeContainerData,
  deleteRegistryResource,
  getFirstObjectValue,
  getRegistryResource,
  getShapeContent,
  getShapeFilesUri,
  getShapeTreeResource,
  requestStore,
  updateRegistrationACLPermission,
  updateRegistryACLPermission,
  updateShapeTreeContainerACLPermission,
  uriExists,
  verifyDataRegistration,
  verifyDataRegistry
} from "@/utils/solid-helper";
import {useIsLoggedIn, useSolidProfile, useSolidSession,} from "@datev-research/mandat-shared-composables";
import {ParsedN3, putResource, SPACE,} from "@datev-research/mandat-shared-solid-requests";
import {TreeNode} from "primevue/treenode";
import {computed, Ref, ref, watch} from "vue";
import {getFileExtension} from "@/utils/fileExtension";
import {TTL_EXTENSION} from "@/constants/extensions";
import {parseShapeFile} from "@/utils/parseShapeTree";
import {ShapeRegistryInfo} from "@/types/shapeRegistryInfo";


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
  const checkSkipMatching = (checked:Ref<boolean>) => {
    if(checked.value){
      throw new Error("Skip Matching is enabled");
    }
  }
  const solidProfileRegistryURI = computed<string>(() => `${organisationStorageUri.value}profile/registry` );

  return {
     storageUri: organisationStorageUri,

    registryExists: (registryName: string) => uriExists(`${organisationStorageUri.value}${registryName}/`, session),
    registrationExists: (registryName: string, registrationName: string) => uriExists(`${organisationStorageUri.value}${registryName}/${registrationName}/`, session),
    documentExists: (registryName: string, registrationName: string, documentName:string) => uriExists(`${organisationStorageUri.value}${registryName}/${registrationName}/${documentName}`, session),
    resourceExists: (uri:string) => uriExists(`${organisationStorageUri.value}${uri}`, session),

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
      await addProfileRegistryData(solidProfileRegistryURI.value,registryName, session);
    },
    shapeTreeContainerExists: (shapeTreeName: string) => uriExists(`${organisationStorageUri.value}${shapeTreeName}/`, session),
    createShapeTreeContainer: async (shapeTree:string) => {
      await createShapeTreeContainerData(`${organisationStorageUri.value}`, shapeTree, session);
      await updateShapeTreeContainerACLPermission(`${organisationStorageUri.value}${shapeTree}/`,shapeTree, session);
    },
    allShapeFiles: async (shapeTree:string) => {
      // get all the shape files URI present in the shapetrees container
      return  await getShapeFilesUri(`${organisationStorageUri.value}${shapeTree}/`, session);
    },
    createRegistration: async (registryName: string, registrationName: string) => {
      const { rdf: registrationRdf, uri: registrationUri } = await createDataRegistration(`${organisationStorageUri.value}${registryName}/`, registrationName, session);
      if (!(await verifyDataRegistration(registrationUri, session))) {
        throw new Error("UnexpectedError: registration Type is not set correctly, after creating it.");
      }
      return registrationUri;
    },
    applyShapeTreeData: async (registrationUri: string, shapeTreeUri: string) => {
      await applyShapeTree(
          registrationUri,
          memberOf.value,
          shapeTreeUri,
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
      await deleteRegistryResource(solidProfileRegistryURI.value, registryUri, session);
    },
    getMatchedShapeRegistries: async(localShapeContent: string, skipMatching:Ref<boolean>) : Promise<ShapeRegistryInfo[]>  => {
      try{
        // Step 1 Get registries
        const registries = await getRegistryResource(solidProfileRegistryURI.value, session);

        checkSkipMatching(skipMatching);
        // Step 2 Get Registration URIs
        const registrationUrisArray = await Promise.all(registries.map( async(registryUri) => {
          const registrations = await getRegistryResource(registryUri, session);
          return registrations.map(registrationUri => ({registrationUri, registryUri}))

        }));

        checkSkipMatching(skipMatching);

        const registrationUris = registrationUrisArray.flat();
        //Step 3 Get Shape Tree Uris
        const shapeTreeUri = await Promise.all(registrationUris.map( async({registrationUri, registryUri}) => {
          const shapeTrees = await getShapeTreeResource(registrationUri, session);
          return shapeTrees.map(shapeTreeUri => ({registrationUri, shapeTreeUri, registryUri}));
        }));

        checkSkipMatching(skipMatching);

        const shapeTreeWithRegistrations = shapeTreeUri.flat();
        // Step 4 - Get the shape content and compare

        const shapeConteData = await Promise.all(
            shapeTreeWithRegistrations.map( async({registrationUri, shapeTreeUri, registryUri}) => {
              // get the shape content
                const shapeContent = await getShapeContent(shapeTreeUri, session);
                const shapeURIs = await parseShapeFile(shapeContent);
                // compare the shape content with the local shape content
                const shapeFilesURI = await compareShapeContent(shapeURIs,localShapeContent, session);

                const shapeURI = shapeFilesURI[0];
                const registrationName = getRegistryLabel(registrationUri);
                const registryName = getRegistryLabel(registryUri);

              return {"registrationUri": registrationUri,"registrationName":registrationName,"registryName":registryName, "registryUri":registryUri, "shapeURI": shapeURI, "shapeTreeURI":shapeTreeUri};
            })
        );
        // Step 5 filter out the shape content which is not null
        return shapeConteData.map((data) => data?.shapeURI !== undefined ? data : {}).filter((data) => Object.keys(data).length !== 0);
      }
      catch (e) {
        return [];
      }
    },
    getFullRegistry: async ()=> {
      const registries = await getRegistryResource(solidProfileRegistryURI.value, session);
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
