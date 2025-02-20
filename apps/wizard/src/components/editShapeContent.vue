<script setup lang="ts">

import HljsHighlighter from "@/components/hljsHighlighter.vue";
import {ref, watch} from "vue";

const props = defineProps<{content?: string }>();
const fileContent = ref(props.content);
const isEdit = ref<boolean>(false);
const shapeText = ref<string>(fileContent.value);
const emit = defineEmits(['closePreview'])

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
function hidePreview(){
  emit('closePreview',true);
}
</script>
<template>
  <div style="background: #d3d3d3; padding:1rem; margin-top:1rem">
    <h2>Generated shape file</h2>
    <div v-show="content && !isEdit" >
      <hljs-highlighter :content="fileContent" />
    </div>
    <div v-if="content && isEdit" >
    <textarea v-model="shapeText" class="w-full h-20rem" ></textarea>
    </div>
    <Button class="mr-2" v-if="!isEdit" severity="secondary" @click="hidePreview">Cancel</Button>
    <Button class="mr-2" v-if="!isEdit" severity="primary" @click="toggleEdit">Edit Shape</Button>
    <div v-else >
      <Button class="mr-2" severity="primary" @click="updateShape">Update Shape</Button>
      <Button class="mr-2" severity="secondary" @click="toggleEdit">Cancel</Button>
    </div>

  </div>

</template>