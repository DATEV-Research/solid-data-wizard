<template>
  <DacklHeaderBar app-name="Wizard" :app-logo="appLogo" :isLoggedIn="isLoggedIn" :webId="session.webId" />

  <div v-if="isLoggedIn && session.rdp" class="mt-4">
    TODO Wizard 
    WEBID: {{ session.webId }}
    memberOf: {{ memberOf }}
    <input type="file" @change="fileChanged" />
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
import Toast from "primevue/toast";
import { useOrganisationStore } from "./composables/useOrganisationStore";

const appLogo = require('@/assets/logo.svg');

const { isLoggedIn } = useIsLoggedIn();
const { session, restoreSession } = useSolidSession();
const { memberOf } = useSolidProfile()

const { registryExists, registrationExists, uploadFile } = useOrganisationStore();

// re-use Solid session
restoreSession();

async function fileChanged(event: Event): Promise<void> {
  const input = (event.target as HTMLInputElement);
  console.log('fileChanged', input.files);
  const registry = prompt("RegistryName") ?? 'my-default-registry';
  const registration = prompt("RegistrationName") ?? 'my-default-registration';

  if (input.files && input.files.length) {
    await Promise.all(Array.from(input.files)
    .map(file => uploadFile(file, registry, registration)));

    // toast-message
  }
}
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
