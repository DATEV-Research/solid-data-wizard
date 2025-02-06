<script setup lang="ts">
import {computed, ref, watch} from "vue";
import hljs from "highlight.js/lib/core";
import hljsDefineTurtle from '../assets/highlightjs-turtle/turtle.js';
import 'highlight.js/styles/stackoverflow-light.css';
// type=> application/pdf

const TEXT_TURTLE ="text/turtle";
const APPLICATION_PDF ="application/pdf";

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
const contentUrl = computed(() => {
  if (props.type === APPLICATION_PDF) {
/*    const numbers = props.content.trim().split(/\s*,\s*!/g).map(x => x/1);
    const binstr = String.fromCharCode(...numbers);
    const b64str = btoa(binstr);
    return `data:${props.type};base64,${b64str}`;*/
    let blob = new Blob([props.content], {type: props.type});

    return URL.createObjectURL(blob);

  }
  return '';
});
</script>

<template>
  <div class="p-1" v-if="content">
    <pre v-if="type === TEXT_TURTLE"><code ref="codeBlock" class="turtle border-round bg-gray-50">{{ content }}</code></pre>
    <embed v-if="type === APPLICATION_PDF" :src="contentUrl" :type="type" width="2000" height="1000"/>
    <object v-if="type === APPLICATION_PDF" :data="contentUrl" :type="type" width="2000" height="1000"></object>
    <iframe v-if="type === APPLICATION_PDF" :src="contentUrl" :type="type" width="2000" height="1000"></iframe>
  </div>

</template>

<style scoped>

</style>