<script setup lang="ts">
import {computedAsync} from "@vueuse/core";
import {computed, ref, watch} from "vue";
import HljsHighlighter from "@/components/hljsHighlighter.vue";

const TEXT_TURTLE ="text/turtle";
const APPLICATION_PDF ="application/pdf";

const props = defineProps<{content?: Blob , type?: string}>();

const isLoadingTextContent = ref<boolean>(false);
const contentText = computedAsync(() => props.content?.text(), '', { evaluating: isLoadingTextContent });
const isImageType = computed(() => props.type?.startsWith('image/'))

watch(() => props.content, () => {
  if ((isImageType.value || props.type === APPLICATION_PDF) && props.content instanceof Blob) {
    contentUrl.value = URL.createObjectURL(props.content);
  }
});
const contentUrl = ref<string>('');
</script>

<template>
  <div class="w-full h-full" v-if="content">
    <hljs-highlighter v-if="type === TEXT_TURTLE" :content="contentText" />
    <object v-if="type === APPLICATION_PDF" :data="contentUrl" :type="type"
            style="width: 100%; height: 100%;" class="mt-3"></object>
    <img v-if="isImageType" :src="contentUrl"  alt="preview" class="mt-3 w-full" />
  </div>

</template>

<style scoped>
img{
  max-width:50rem;
  max-height:50rem;
}
</style>
