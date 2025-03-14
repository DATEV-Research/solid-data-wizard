<script setup lang="ts">
import {computedAsync} from "@vueuse/core";
import hljs from "highlight.js/lib/core";
import {onMounted, ref, watch} from "vue";
import hljsDefineTurtle from '../assets/highlightjs-turtle/turtle.js';
import 'highlight.js/styles/stackoverflow-light.css';

const props = defineProps<{content?: string }>();

const isLoadingTextContent = ref<boolean>(false);
const contentText = computedAsync(() => props.content, '', { evaluating: isLoadingTextContent });
const codeBlock = ref<HTMLElement | null>(null);

onMounted(() => {
  hljs.registerLanguage('turtle', hljsDefineTurtle);
})

watch(() => props.content, () => {
    requestAnimationFrame(() => {
      if (codeBlock.value instanceof HTMLElement) {
        if (codeBlock.value.dataset.highlighted) {
          delete codeBlock.value.dataset.highlighted;
        }
        hljs.highlightElement(codeBlock.value);
      }
    });
});

</script>

<template>
  <div class="w-full h-full" v-if="content">
    <pre class="w-full"><code ref="codeBlock" class="turtle border-round bg-gray-50 overflow-auto">{{ contentText }}</code></pre>
  </div>

</template>

<style scoped>
img{
  max-width:50rem;
  max-height:50rem;
}
</style>