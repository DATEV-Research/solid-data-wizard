<template>
  <DacklHeaderBar app-name="Wizard" :app-logo="appLogo" :isLoggedIn="isLoggedIn" :webId="session.webId" />

  <div v-if="isLoggedIn && session.rdp" class="mt-6 flex flex-column gap-3 py-0 px-3">
    <Button label="Show" @click="visible = true" />
    <Button label="Delete" @click="deleteSelectedNodes" :disabled="!hasSelection" />
    <Dialog v-model:visible="visible">
      <CreateDialog />
    </Dialog>
    <PodTree :nodes="podNodes" @update:selected-keys="updateSelectedKeys" @node-expand="onNodeExpand" ></PodTree>
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
import Toast from "primevue/toast";
import {useOrganisationStore} from "./composables/useOrganisationStore";
import {computed, ref} from "vue";
import PodTree from "@/components/PodTree.vue";
import {TreeSelectionKeys} from "primevue/tree";
import {TreeNode} from "primevue/treenode";
import CreateDialog from "@/components/CreateDialog.vue";

const appLogo = require('@/assets/logo.svg');

const { isLoggedIn } = useIsLoggedIn();
const { session, restoreSession } = useSolidSession();

const {  getProfileRegistry, getRegistry } = useOrganisationStore();

getProfileRegistry().then(result=> podNodes.value = result);
// re-use Solid session
restoreSession();

const podNodes = ref<TreeNode[]>([]);
const selectedNodes = ref<TreeSelectionKeys>({});
const hasSelection = computed(()=>Object.keys(selectedNodes.value).length > 0);

const visible = ref(false);


function updateSelectedKeys(selectionKeys:TreeSelectionKeys){
  selectedNodes.value = selectionKeys;
  console.log(selectionKeys);
}
function onNodeExpand(treeNode:TreeNode){
  console.log(treeNode);
  getRegistry(treeNode.key).then(result=> treeNode.children = result);
}

function deleteSelectedNodes(){
  const nodes = Object.entries(selectedNodes.value).filter(([key, value])=>value.checked).map(([key, value])=> key);
  console.log("delete",nodes );

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
