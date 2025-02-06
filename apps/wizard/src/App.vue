<template>
  <DacklHeaderBar app-name="Wizard" :app-logo="appLogo" :isLoggedIn="isLoggedIn" :webId="session.webId" />

  <div v-if="isLoggedIn && session.rdp" class="mt-6 flex" style="height: calc(100% - 8rem);">
    <div class="w-30rem flex h-full flex-column sidenav">
      <Button class="" label="Create" @click="visible = true"/>
      <Button class="" label="Delete" @click="deleteSelectedNodes" :disabled="!hasSelection" :loading="loading"/>
      <PodTree :loading="loading"
               :nodes="podNodes"
               @update:selected-keys="updateSelectedKeys"
               @node-select="onNodeSelect"
               @node-unselect="onNodeSelect"></PodTree>

    </div>
    <main class="flex flex-grow-1 main">
      <h2>{{ name }}</h2>
      <Preview :content="previewData" :type="previewType" ></Preview>
      <ProgressSpinner v-if="!previewData"/>
    </main>

  </div>
  <UnauthenticatedCard v-else />

  <Dialog modal v-model:visible="visible" header="Create Registry" :style="{ width: '25rem' }">
    <CreateDialog @registryCreated="closeDialog" @closeDialog="visible = false" />
  </Dialog>
  <ConfirmDialog />
  <Toast
    position="bottom-right"
    :breakpoints="{ '420px': { width: '100%', right: '0', left: '0' } }"
  />
</template>

<script lang="ts" setup>
import CreateDialog from "@/components/CreateDialog.vue";
import PodTree from "@/components/PodTree.vue";
import Preview from "@/components/Preview.vue";
import ProgressSpinner from "primevue/progressspinner";
import {DacklHeaderBar, UnauthenticatedCard} from "@datev-research/mandat-shared-components";
import {useIsLoggedIn, useSolidSession} from "@datev-research/mandat-shared-composables";
import Toast from "primevue/toast";
import {TreeSelectionKeys} from "primevue/tree";
import {TreeNode} from "primevue/treenode";
import {useConfirm} from "primevue/useconfirm";
import {useToast} from "primevue/usetoast";
import {computed, onMounted, ref} from "vue";
import {useOrganisationStore} from "./composables/useOrganisationStore";
import {capitalizeFirstLetter} from "@/utils/capitalizeFirstLetter";

const appLogo = require('@/assets/logo.svg');
const confirm = useConfirm();

const { isLoggedIn } = useIsLoggedIn();
const { session, restoreSession } = useSolidSession();

const {  getFullRegistry, deleteRegistry } = useOrganisationStore();

const podNodes = ref<TreeNode[]>([]);
const loading = ref<boolean>(true);
const name = ref<string>('');
const selectedNodes = ref<TreeSelectionKeys>({});
const hasSelection = computed(() => Object.keys(selectedNodes.value).length > 0);
const visible = ref(false);
const previewData = ref<Blob | undefined>(undefined);
const previewType = ref('');

const toast = useToast();

onMounted(() => {
  restoreSession().then(() => {
    updatePodTree();
  });
});

function onNodeSelect(node: TreeNode){
  console.log(node);
  name.value = capitalizeFirstLetter(node.label ?? '');
  previewData.value = undefined;
  const headers = {
    Accept: "text/turtle,application/*,image/*",
/*    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0'*/
  };
  session.authFetch({
    url: node.key,
    method: "GET",
    headers,
    responseType: "blob"
  }).then(response => {
    previewData.value = response.data;
    previewType.value = String(response.headers["content-type"]).split(';')[0];
  });


}
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

  confirm.require({
    message: `Are you sure you want to delete ${nodesUrisToBeDeleted.length} entries?`,
    header: 'Deletion',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary',
    acceptClass: 'p-button-danger',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    accept: async () => {
      loading.value = true;

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

      selectedNodes.value = {};
      loading.value = false;
      await updatePodTree();
    },
    reject: () => {
      toast.add({ severity: 'info', summary: 'No changes', detail: 'No entries were deleted.', life: 3000 });
    }
  });
}

</script>

<style>
main{
  --p-progressspinner-color-1: yellow;
  --p-progressspinner-color-2: green;
  --p-progressspinner-color-3: red;
  --p-progressspinner-color-4: purple;
}
html {
  width: 100vw;
  height: 100vh;
  overscroll-behavior-y: contain;
}
@keyframes p-progress-spinner-dash {
  100% {
    stroke-dasharray: 89, 200;
  }
}
@keyframes p-progress-spinner-color {
  100%{
    stroke: rgb(25, 91, 120);
  }
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
