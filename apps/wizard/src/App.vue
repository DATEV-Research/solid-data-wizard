<template>
  <DacklHeaderBar app-name="Wizard" :app-logo="appLogo" :isLoggedIn="isLoggedIn" :webId="session.webId" />

  <div v-if="isLoggedIn && session.rdp" class="mt-6 flex flex-column gap-3 py-0 px-3">
    <Button label="Show" @click="visible = true" />
    <Button label="Delete" @click="deleteSelectedNodes" :disabled="!hasSelection" />
    <Dialog v-model:visible="visible">
      <CreateDialog />
    </Dialog>
    <PodTree :nodes="podNodes" @update:selected-keys="updateSelectedKeys" ></PodTree>
  </div>
  <UnauthenticatedCard v-else />
  
  <Toast
    position="bottom-right"
    :breakpoints="{ '420px': { width: '100%', right: '0', left: '0' } }"
  />
</template>

<script lang="ts" setup>
import {DacklHeaderBar, DacklTextInput, UnauthenticatedCard} from "@datev-research/mandat-shared-components";
import {useIsLoggedIn, useSolidSession} from "@datev-research/mandat-shared-composables";
import axios from "axios";
import Toast from "primevue/toast";
import {useOrganisationStore} from "./composables/useOrganisationStore";
import {computed, onMounted, ref} from "vue";
import PodTree from "@/components/PodTree.vue";
import {TreeSelectionKeys} from "primevue/tree";
import {TreeNode} from "primevue/treenode";
import CreateDialog from "@/components/CreateDialog.vue";

const appLogo = require('@/assets/logo.svg');

const { isLoggedIn } = useIsLoggedIn();
const { session, restoreSession } = useSolidSession();

const {  getFullRegistry } = useOrganisationStore();

const podNodes = ref<TreeNode[]>([]);
const selectedNodes = ref<TreeSelectionKeys>({});
const hasSelection = computed(() => Object.keys(selectedNodes.value).length > 0);
const visible = ref(false);

onMounted(() => {
  restoreSession().then(() => {
    updatePodTree();
  });
});

function updatePodTree() {
  getFullRegistry().then(result => podNodes.value = result);
}

function updateSelectedKeys(selectionKeys:TreeSelectionKeys){
  selectedNodes.value = selectionKeys;
  console.log(selectionKeys);
}

async function deleteSelectedNodes(){
  const nodesUrisToBeDeleted: string[] =
      Object.entries(selectedNodes.value).filter(([, value])=>value.checked).map(([key])=>
      key);
  // const podTree = podNodes.value;

  nodesUrisToBeDeleted.sort((a, b) => {
    const aSlashes = a.match(/\//)?.length ?? 0;
    const bSlashes = b.match(/\//)?.length ?? 0;
    return bSlashes - aSlashes;
  }).reverse();

  for (const uriToDelete of nodesUrisToBeDeleted) {
    // First: Remove the resource
    // await session.authFetch({url: uriToDelete, method: 'DELETE'});
  }

  // Second: Check for Profile/Registry to Update "hasDataRegistry"


  // Third: Check for DataRegistry to Update "hasDataRegistration"

  console.log("delete", nodesUrisToBeDeleted);

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
