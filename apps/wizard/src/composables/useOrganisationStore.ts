import { useIsLoggedIn, useSolidProfile, useSolidSession } from "@datev-research/mandat-shared-composables";
import { getResource, parseToN3, SPACE } from "@datev-research/mandat-shared-solid-requests";
import { NamedNode, Store } from "n3";
import { ref, watch } from "vue";

export const useOrganisationStore = () => {
    const { isLoggedIn } = useIsLoggedIn();
    const { memberOf } = useSolidProfile();
    const { session } = useSolidSession();

    const organisationStore = ref<Store | null>(null);

    /**
     * internal initialisation of the `organisationStore`.
     */
    const __initiate = async () => {
        organisationStore.value = await __requestStore(memberOf.value);
        const organisationStorageUri = __getFirstObjectValue(memberOf.value, SPACE("storage"), organisationStore.value);
        
        console.debug("useOrganisationStore [DEBUG]: Got storage URI", organisationStorageUri);


        __requestStore(`${organisationStorageUri}shapetrees/`).then(store => __logStore(store, 'shapetrees'));
        __requestStore(`${organisationStorageUri}shapetrees/b445a3a7-883c-45b4-aa74-c9ae0b254fe0.meta`).then(store => __logStore(store, 'shapetree meta'));
        // __requestStore(`${organisationStorageUri}inbox/`).then(store => __logStore(store, 'inbox'));
        // __requestStore(`${organisationStorageUri}memberships/`).then(store => __logStore(store, 'memberships'));
        // __requestStore(`${organisationStorageUri}shapetrees/`).then(store => __logStore(store, 'shapetrees'));
        // __requestStore(`${organisationStorageUri}wallet/`).then(store => __logStore(store, 'wallet'));
        // __requestStore(`${organisationStorageUri}does-not-exist/`).then(store => __logStore(store, 'does-not-exist'));
        const doesExist = await __exists(organisationStorageUri, 'unknown');
        console.debug("useOrganisationStore [DEBUG]: Store unknown exists?", doesExist);
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
    const __getFirstObjectValue = (uri: string, keyName: string, store: Store | null): string => {
        const firstValue = __getObjectValues(uri, keyName, store).at(0);
        if (!firstValue) {
            console.warn("useOrganisationStore [WARN]: __getFirstObjectValue failed to retrieve value for", uri, keyName);
            return "";
        }
        return firstValue;
    }

    /**
     * Checks e.g. https://sme.solid.aifb.kit.edu/access-inbox/ to be existent and returns true or false.
     *
     * @param uri subject or URI of a container, sample: "https://sme.solid.aifb.kit.edu/"
     * @param name sample: "access-inbox"
     */
    const __exists = async (uri: string, name: string) => {
        const store = await __requestStore(`${uri}${name}/`);
        return store !== null;
    };

    /**
     * Logs the contents of a store including their subjects and predicates.
     * @param store the store that should be logged to console.
     * @param name the store's name.
     */
    const __logStore = (store: Store | null, name?: string): void => {
        if (store) {
            // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getGraphs`, store.getGraphs(null, null, null));
            // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getPredicates`, store.getPredicates(null, null, null));
            // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getQuads`, store.getQuads(null, null, null, null));
            // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getObjects`, store.getObjects(null, null, null));
            // console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getSubjects`, store.getSubjects(null, null, null));

            const mappedObject = store.getSubjects(null, null, null).reduce((obj, currentSubject) => {
                const { value: subjectValue } = currentSubject;
                obj[subjectValue] = store.getPredicates(subjectValue, null, null)
                .reduce((acc, current) => {
                    const {value: predicateValue} =  current;
                    acc[predicateValue] = __getObjectValues(subjectValue, predicateValue, store).map(value => __mapValue(predicateValue, value));
                    return acc;
                }, {} as Record<string, unknown>);;
                return obj;
            }, {} as Record<string, Record<string, unknown>>);

            console.debug(`useOrganisationStore.__logStore [DEBUG]: ${name}.getObjects`, mappedObject);
        }
    };

    /**
     * @param uri identifier or just a Container URL, sample "https://sme.solid.aifb.kit.edu/shapetrees/d34a5437-fb1c-42dc-9338-79ab9f9ac849"
     * @param keyName (optional) predicate or keyName, sample "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
     * @param store store where to retrieve the information from. Can be `null`, but then the result is also `null`.
     * @returns sample `[ "http://www.w3.org/ns/ldp#Resource", "http://www.w3.org/ns/iana/media-types/application/pdf#Resource" ]`
     */
    const __getObjectValues = (uri: string, keyName: string | null = null, store: Store | null = null): string[] => {
        if (!store){
            return [];
        }

        return store.getObjects(
            uri, keyName ?? null, null
            ).map(a => a.value);
    };

    /**
     * maps object values to their predicate defined type, like Date or Number.
     * @param predicate predicate value that defines the type
     * @param value the raw string value that should be converted/mapped.
     * @returns 
     */
    const __mapValue = (predicate: string, value: string): unknown => {
        switch (predicate) {
            case "http://purl.org/dc/terms/modified": return new Date(value); // value is ISO String
            case "http://www.w3.org/ns/posix/stat#mtime": return new Date(Number(`${value}000`)); // value is Timestamp in seconds
            case "http://www.w3.org/ns/posix/stat#size": return Number(`${value}`); // value is number
            default: return value;
        }
    };

    /**
     * requests and returns a store if found. Otherwise it returns `null`.
     * @param uri the identifier URL like "https://sme.solid.aifb.kit.edu/shapetrees/d34a5437-fb1c-42dc-9338-79ab9f9ac849"
     * @returns Store object if URI is valid, otherwise null.
     */
    const __requestStore = async (uri: string): Promise<Store | null> => {
        try {
            const rawRdf = (await getResource(uri, session).then(({data}) => data));
            return (await parseToN3(rawRdf, uri)).store;
        } catch (error: unknown) {
            console.error("useOrganisationStore [ERR]: Requesting URI or Parsing Store failed" , { error, uri });
            return null;
        }
    };

    /**
     * watch change of `memberOf` to initiate the organisationStore.
     * Changes to memberOf mean the user logged in or changed.
     */
    watch(memberOf, async () => {
        if (isLoggedIn.value){
            await __initiate();
        }
    }, { immediate: true });

    return {};
}