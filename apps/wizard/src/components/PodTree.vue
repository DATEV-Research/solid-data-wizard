<script setup lang="ts">
import {TreeSelectionKeys} from "primevue/tree";
import {TreeNode} from "primevue/treenode";
import {ref} from "vue";

defineProps<{ nodes: TreeNode[], loading?: boolean }>();
const emits = defineEmits<{
  (e: "update:selectedKeys", value: TreeSelectionKeys): void;
  (e: "node-expand", value: TreeNode): void;
  (e: "node-select", value: TreeNode): void;
  (e: "node-unselect", value: TreeNode): void;
}>();

const selectedKey = ref<TreeSelectionKeys>({});
</script>

<template>
  <Tree class="w-full h-full md:w-30rem"
        v-model:selectionKeys="selectedKey"
        :loading="loading"
        :filter="true" filterMode="lenient"
        :value="nodes"
        selectionMode="checkbox"
        @update:selection-keys="emits('update:selectedKeys', $event)"
        @node-select="emits('node-select', $event)"
        @node-unselect="emits('node-unselect', $event)"
        @node-expand="emits('node-expand', $event)"
        ></Tree>
</template>

<style scoped>

</style>
