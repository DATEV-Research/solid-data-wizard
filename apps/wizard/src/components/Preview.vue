<script setup lang="ts">
import {computedAsync} from "@vueuse/core";
import hljs from "highlight.js/lib/core";
import {computed, onMounted, ref, watch} from "vue";
import hljsDefineTurtle from '../assets/highlightjs-turtle/turtle.js';
import 'highlight.js/styles/stackoverflow-light.css';
// type=> application/pdf

const TEXT_TURTLE ="text/turtle";
const APPLICATION_PDF ="application/pdf";

const props = defineProps<{content?: Blob , type?: string}>();

const isLoadingTextContent = ref<boolean>(false);
const contentText = computedAsync(() => props.content?.text(), '', { evaluating: isLoadingTextContent });
const isImageType = computed(() => props.type?.startsWith('image/'))
const codeBlock = ref<HTMLElement | null>(null);

onMounted(() => {
  hljs.registerLanguage('turtle', hljsDefineTurtle);
})

watch(() => props.content, () => {

  if (props.type === TEXT_TURTLE) {
    requestAnimationFrame(() => {
      if (codeBlock.value instanceof HTMLElement) {
        if (codeBlock.value.dataset.highlighted) {
          delete codeBlock.value.dataset.highlighted;
        }
        hljs.highlightElement(codeBlock.value);
      }
    });
  }

  if ((isImageType.value || props.type === APPLICATION_PDF) && props.content instanceof Blob) {
    contentUrl.value = URL.createObjectURL(props.content);
  }
});
const contentUrl = ref<string>('');
</script>

<template>
  <div class="w-full" v-if="content">
    <pre v-if="type === TEXT_TURTLE"><code ref="codeBlock" class="turtle border-round bg-gray-50">{{ contentText }}</code></pre>
    <object v-if="type === APPLICATION_PDF" :data="contentUrl" :type="type"
            style="width: 100%; height: 100%;"></object>
    <img v-if="isImageType" :src="contentUrl"  alt="preview"/>
  </div>

</template>

<style scoped>

</style>
