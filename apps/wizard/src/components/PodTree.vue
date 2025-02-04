<script setup lang="ts">
import {ref} from "vue";
import {TreeNode} from "primevue/treenode";
import {TreeSelectionKeys} from "primevue/tree";

const props = defineProps<{nodes:TreeNode[]}>();
const emits = defineEmits<{
  (e: "update:selectedKeys", value: TreeSelectionKeys): void;
}>();

const selectedKey = ref<TreeSelectionKeys>();

</script>

<template>
  <Tree v-model:selectionKeys="selectedKey" @update:selection-keys="emits('update:selectedKeys',selectedKey)" :value="nodes" class="w-full md:w-30rem"
        selectionMode="checkbox" :metaKeySelection="checked" ></Tree>
</template>

<style scoped>

</style>