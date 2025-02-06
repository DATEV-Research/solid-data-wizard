<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import hljs from "highlight.js/lib/core";
import hljsDefineTurtle from '../assets/highlightjs-turtle/turtle.js';
import 'highlight.js/styles/stackoverflow-light.css';
// type=> application/pdf
const props = defineProps<{content:string , type:string}>();

const codeBlock = ref<HTMLElement | null>(null);
hljs.registerLanguage('turtle', hljsDefineTurtle);

watch(() => props.content, () => {
  requestAnimationFrame(()=>{
    if (codeBlock.value) {
      hljs.highlightElement(codeBlock.value);
    }
  })
});
</script>

<template>
  <div class="p-1" v-if="content">
    <pre><code ref="codeBlock" class="turtle border-round bg-gray-50">{{ content }}</code></pre>
  </div>

</template>

<style scoped>

</style>