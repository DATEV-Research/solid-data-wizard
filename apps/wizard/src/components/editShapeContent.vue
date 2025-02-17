<script setup lang="ts">

import HljsHighlighter from "@/components/hljsHighlighter.vue";
import {ref, watch} from "vue";

const props = defineProps<{content?: string }>();
const fileContent = ref(props.content);
const isEdit = ref<boolean>(false);
const shapeText = ref<string>(fileContent.value);

watch(() => props.content, () => {
  requestAnimationFrame(() => {
    fileContent.value = props.content;
    shapeText.value = props.content;
  });

});

function toggleEdit(){
  isEdit.value = !isEdit.value;
}

function updateShape(){

  toggleEdit();
  fileContent.value = shapeText.value;

}
</script>
<template>
  <hljs-highlighter v-if="content && !isEdit" :content="fileContent" />
  <textarea v-model="shapeText" class="w-full h-20rem" v-else >

  </textarea>
  <Button class="mr-2" v-if="!isEdit" severity="primary" @click="toggleEdit">Edit Shape</Button>
  <div v-else >
    <Button class="mr-2" severity="primary" @click="updateShape">Update Shape</Button>
    <Button class="mr-2" severity="secondary" @click="toggleEdit">Cancel</Button>
  </div>

</template>