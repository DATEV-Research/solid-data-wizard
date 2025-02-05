<script setup lang="ts">
import {ref} from "vue";
import {TreeNode} from "primevue/treenode";
import {TreeSelectionKeys} from "primevue/tree";

defineProps<{nodes:TreeNode[]}>();
const emits = defineEmits<{
  (e: "update:selectedKeys", value: TreeSelectionKeys): void;
  (e: "node-expand", value: TreeNode): void;
}>();

const selectedKey = ref<TreeSelectionKeys>({});

</script>

<template>
  <Tree v-model:selectionKeys="selectedKey" @update:selection-keys="emits('update:selectedKeys',selectedKey)" @node-expand="emits('node-expand', $event)" :value="nodes" class="w-full md:w-30rem"
        selectionMode="checkbox" ></Tree>
</template>

<style scoped>

</style>
