<template>
  <DacklHeaderBar app-name="Wizard" :app-logo="appLogo" :isLoggedIn="isLoggedIn" :webId="session.webId" />

  <div v-if="isLoggedIn && session.rdp" class="mt-6 flex flex-column gap-3 py-0 px-3">
    <Button label="Show" @click="visible = true" />
    <Button label="Delete" @click="deleteSelectedNodes" :disabled="!hasSelection" />
    <Dialog v-model:visible="visible">
      <CreateDialog @registryCreated="closeDialog" />
    </Dialog>
    <PodTree :loading="loading" :nodes="podNodes" @update:selected-keys="updateSelectedKeys" ></PodTree>
  </div>
  <UnauthenticatedCard v-else />
  
  <Toast
    position="bottom-right"
    :breakpoints="{ '420px': { width: '100%', right: '0', left: '0' } }"
  />
</template>

<script lang="ts" setup>
import CreateDialog from "@/components/CreateDialog.vue";
import PodTree from "@/components/PodTree.vue";
import {DacklHeaderBar, UnauthenticatedCard} from "@datev-research/mandat-shared-components";
import {useIsLoggedIn, useSolidSession} from "@datev-research/mandat-shared-composables";
import Toast from "primevue/toast";
import {TreeSelectionKeys} from "primevue/tree";
import {TreeNode} from "primevue/treenode";
import {useToast} from "primevue/usetoast";
import {computed, onMounted, ref} from "vue";
import {useOrganisationStore} from "./composables/useOrganisationStore";

const appLogo = require('@/assets/logo.svg');

const { isLoggedIn } = useIsLoggedIn();
const { session, restoreSession } = useSolidSession();

const {  getFullRegistry, deleteRegistry } = useOrganisationStore();

const podNodes = ref<TreeNode[]>([]);
const loading = ref<boolean>(true);
const selectedNodes = ref<TreeSelectionKeys>({});
const hasSelection = computed(() => Object.keys(selectedNodes.value).length > 0);
const visible = ref(false);

const toast = useToast();

onMounted(() => {
  restoreSession().then(() => {
    updatePodTree();
  });
});

function closeDialog(){
  visible.value = false;
  updatePodTree();
}
async function updatePodTree() {
  loading.value = true;
  podNodes.value = await getFullRegistry();
  loading.value = false;
}

function updateSelectedKeys(selectionKeys:TreeSelectionKeys){
  selectedNodes.value = selectionKeys;
  console.log(selectionKeys);
}

async function deleteSelectedNodes(){
  loading.value = true;
  const nodesUrisToBeDeleted: string[] =
      Object.entries(selectedNodes.value).filter(([, value])=>value.checked).map(([key])=>
      key);
  // const podTree = podNodes.value;

  nodesUrisToBeDeleted.sort((a, b) => {
    const aSlashes = a.match(/\//)?.length ?? 0;
    const bSlashes = b.match(/\//)?.length ?? 0;
    const slashesDiff = bSlashes - aSlashes;
    if (slashesDiff === 0) {
      return a.localeCompare(b);
    }
    return slashesDiff;
  }).reverse();

  console.log("nodesUrisToBeDeleted", nodesUrisToBeDeleted);

  if (!confirm(`Are you sure you want to delete ${nodesUrisToBeDeleted.length} entries?`)) {
    return;
  }

  try {
    for (const uriToDelete of nodesUrisToBeDeleted) {
      await deleteRegistry(uriToDelete);
    }
    toast.add({
      severity: "success",
      summary: `${nodesUrisToBeDeleted.length} Entries deleted successfully!`,
      life: 5000,
    });
  } catch (err: unknown) {
    toast.add({
      severity: "error",
      summary: "Deletion failed!",
      life: 5000,
    });
    console.error("[deleteSelectedNodes] Failed due to error: ", err);
  }

  loading.value = false;
  await updatePodTree();
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
