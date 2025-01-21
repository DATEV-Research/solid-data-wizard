<template>
  <DacklHeaderBar app-name="Wizard" :app-logo="appLogo" :isLoggedIn="isLoggedIn" :webId="session.webId" />

  <div v-if="isLoggedIn && session.rdp" class="mt-4">
    TODO Wizard 
    WEBID: {{ session.webId }}
    memberOf: {{ memberOf }}
    
  </div>
  <UnauthenticatedCard v-else />
  
  <Toast
    position="bottom-right"
    :breakpoints="{ '420px': { width: '100%', right: '0', left: '0' } }"
  />

  <ConfirmDialog />
</template>

<script lang="ts" setup>
import {DacklHeaderBar, UnauthenticatedCard} from "@datev-research/mandat-shared-components";
import {useIsLoggedIn, useSolidProfile, useSolidSession} from "@datev-research/mandat-shared-composables";
import { getResource, parseToN3, SPACE } from "@datev-research/mandat-shared-solid-requests";
import { NamedNode } from "n3";
import Toast from "primevue/toast";
import {ref, watch} from "vue";

const appLogo = require('@/assets/logo.svg');

const isOpen = ref(false);
const { isLoggedIn } = useIsLoggedIn();
const { session, restoreSession } = useSolidSession();
const { memberOf } = useSolidProfile()


// re-use Solid session
await restoreSession();

const organisationPod = (await getResource(memberOf.value, session).then(resp => resp.data));
console.log("organisationPod", organisationPod)
const organisationStore = (await parseToN3(organisationPod, memberOf.value)).store;
console.log("got organisationStore");
const organisationStorage = organisationStore.getObjects(
  memberOf.value, new NamedNode(SPACE("storage")), null
).at(0)?.value;
console.log("organisationStorage: ",  `${organisationStorage}documents`);
const dataRegistryUri = `${organisationStorage}documents`;
const exists = (await getResource(dataRegistryUri, session).then(resp => resp.data).catch(_err => null))

console.log("does it exist?", !!exists)
</script>

<style>
html {
  width: 100vw;
  height: 100vh;
  overscroll-behavior-y: contain;
}

body {
  overscroll-behavior-y: contain;
  margin: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: var(--surface-b);
  font-family: var(--font-family);
  font-weight: 400;
  color: var(--text-color);
}

/* Track */
::-webkit-scrollbar-track {
  border: none;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: var(--primary-color);
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: cadetblue;
}
</style>
