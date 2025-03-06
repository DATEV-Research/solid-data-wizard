<script setup lang="ts">

import {useOrganisationStore} from "@/composables/useOrganisationStore";
import {validateInput} from "@/utils/validateInput";
import {DacklTextInput} from "@datev-research/mandat-shared-components";
import {computedAsync} from "@vueuse/core";
import {useToast} from "primevue/usetoast";
import {computed, ref} from "vue";
import {getFileExtension} from "@/utils/fileExtension";
import {TTL_EXTENSION} from "@/constants/extensions";
import {isValidTurtle, turtleToShape} from "@/utils/turtleToShapeTree";
import EditShapeContent from "@/components/editShapeContent.vue";
import {fileSizeExceeded} from "@/utils/fileSize";


const N3 = require('n3');

const SHAPE_TREE_CONTAINER_URI = "https://sme.solid.aifb.kit.edu/shapetrees/"

const { createRegistry, createRegistration,updateACLPermission, registryExists, createShape, createShapeTree, registrationExists, uploadFile, updateProfileRegistry, createShapeTreeContainer, shapeTreeContainerExists } = useOrganisationStore();

const emit = defineEmits<{
  (e: "registryCreated", value: boolean): void;
  (e: "closeDialog", value: boolean): void;
}>();

// re-use Solid session
const registryName = ref<string>('');
const registrationName = ref<string>('');
const fileInput = ref<HTMLInputElement | null>(null); // use `useTemplateRef()` in vue 3.5+
const shapeFileInput = ref<HTMLInputElement | null>(null); // use `useTemplateRef()` in vue 3.5+

const invalidRegistry = computed<boolean>(() => !validateInput(registryName.value));
const invalidRegistration = computed<boolean>(() => !validateInput(registrationName.value));
const registrationNameExists = computedAsync<boolean>(() => {
  if (!registryName.value || !registrationName.value) { return Promise.resolve(false); }
  return registrationExists(registryName.value,
          registrationName.value);
}, false, { lazy: false, shallow: true });
const fileNotSelected = computed<boolean>(() => dirty.value && (!fileInput.value || fileInput.value.files?.length === 0));
const isInvalid = computed<boolean>(() => invalidRegistry.value || invalidRegistration.value || registrationNameExists.value || fileNotSelected.value);
/**
 * Dirty is true when the Button Submit was clicked at least once.
 */
const dirty = ref<boolean>(false);
const loading = ref<boolean>(false);

const ttlUpload = ref<boolean>(false);

const shapeContent = ref('');

const uploadShapeFile = ref<boolean>(false);
const toggleShapeContent = ref<boolean>(false);
const isSubmitDisabled = ref<boolean>(true);

const toast = useToast();
function resetErrorMessage() {
  dirty.value = false;
}
function closeDialog(){

  emit('closeDialog', true);
  toast.add({ severity: 'info', summary: 'No changes', detail: 'No entries were created.', life: 3000 });
}
function resetData(){
  registryName.value = '';
  registrationName.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  if (shapeFileInput.value) {
    shapeFileInput.value.value = '';
  }
  ttlUpload.value = false;
  resetErrorMessage();
}

async function addRegistrationName(): Promise<void>{
  resetErrorMessage();
  dirty.value = true;

  if (isInvalid.value) {
    return;
  }
  if(ttlUpload.value){
    await createShapeTreeFile();
  }
  const registry = registryName.value;
  const registration = registrationName.value;
  const input = fileInput.value;

  if (!(await registryExists(registry))) {
    await createRegistry(registry);
    await updateProfileRegistry(registry);
  }
  const shapeTree = "shapetrees";
  if (!(await shapeTreeContainerExists(shapeTree))) {
    await createShapeTreeContainer(shapeTree);
  }
  await createRegistration(registry, registration);

  if (input && input.files && input.files.length) {
    loading.value = true;
    try{
      await Promise.all(
          Array.from(input.files)
              .map(file => uploadFile(file, registry, registration)));

      toast.add({
        severity: "success",
        summary: "File successfully uploaded!",
        life: 5000,
      });
      await updateACLPermission(registry, registration);
      resetData();
      emit('registryCreated', true);
    }
    catch(err){
      toast.add({
        severity: "error",
        summary: "File is not uploaded",
        life: 5000,
      });
      emit('registryCreated', false);
    }

  }
  loading.value = false;
}

function onFileSelect(event: Event) {
  const file = event.target.files[0];
  if (file) {
    if(fileSizeExceeded(file.size)){
      const fileName = file.name;
      isSubmitDisabled.value = false;
      if(getFileExtension(fileName) === TTL_EXTENSION) {
        ttlUpload.value = true;
        if (!shapeFileInput.value?.files.length) {
          createShapeContent(file);
        }
      }
      else{
        hideTTLDiv();
      }
    }
    else{
      hideTTLDiv();
      toast.add({
        severity: "error",
        summary: "File size exceed 2 MB limit",
        life: 5000,
      });
    }

  }
  else{
    hideTTLDiv();
  }
}
function hideTTLDiv(){
  ttlUpload.value = false;
  toggleShapeContent.value = false;
}
function createShapeContent(file:Blob){
  const reader = new FileReader();
  reader.onload = async function(event) {
    const content = event.target?.result.toString();

    if(content){
      if(isValidTurtle(content)){
        isSubmitDisabled.value = false;
        shapeContent.value= await turtleToShape(content);
      }
      else{
        isSubmitDisabled.value = true;
        shapeContent.value = '';
        toast.add({
          severity: "error",
          summary: "Invalid Turtle file",
          life: 5000,
        });
      }
    }
  };
  reader.readAsText(file);
}
function onShapeFileSelect(){
  const file = shapeFileInput.value?.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      shapeContent.value = e.target.result.toString();
    }
    reader.readAsText(file);
  }
}
async function createShapeTreeFile(){
  const shapeName = shapeContent.value.match(/<#(.*?)>/)?.[1];
  const shapeTreeName = shapeName + 'Tree';

  const shapeTreeContent = `@prefix st: <http://www.w3.org/ns/shapetrees#> .

<#${shapeTreeName}> a st:ShapeTree ;
  st:expectsType	st:Resource ;
  st:shape      	<${SHAPE_TREE_CONTAINER_URI}${shapeName}.shape#${shapeName}> .`

  let headers = {};
  headers["Content-type"] ='application/octet-stream'
  await createShape(`${SHAPE_TREE_CONTAINER_URI}${shapeName}.shape`,shapeContent.value,headers);
  await createShapeTree(`${SHAPE_TREE_CONTAINER_URI}${shapeName}.tree`,shapeTreeContent,headers);
}

function toggleShapeContentView(){
  toggleShapeContent.value = !toggleShapeContent.value;
}
</script>

<template>
        <div class="grid pt-0 pb-3">
          <div class="grid col-6">
            <div class=" col-12">Please select the document to upload</div>
            <div class="col-12"><input ref="fileInput" type="file" @change="onFileSelect" /></div>
            <div class="col-12" v-if ="dirty && fileNotSelected">
              <span class="text-red-500">No file selected.</span>
            </div>
          </div>
          <div class="grid col-6" v-if="ttlUpload">
           <div class="col-12"><Checkbox v-model="uploadShapeFile" :binary="true"/>
            <label> Upload shape file</label></div>
            <div class="col-12" v-if="uploadShapeFile" ><input ref="shapeFileInput" type="file" @change="onShapeFileSelect" accept=".shape"/></div>
            <div class="col-12" v-else @click="toggleShapeContentView"><a> View Created shape file</a></div>
          </div>
          <div class="col-12" v-show="toggleShapeContent">
            <transition name="fade">
              <div v-show="!uploadShapeFile" >
                <edit-shape-content :content="shapeContent" @close-preview="toggleShapeContentView" />
              </div>
            </transition>
          </div>
          <div class="col-12">
            <div class="flex">
              <div class="flex-grow-1">
            <DacklTextInput type="string" :disabled="false" class="md:w-auto mt-2 flex-1" label="Enter Registry Name" v-model="registryName"/>
              </div>
              <div class="flex-none m-auto">
                <i class="info-icon pi pi-info-circle" v-tooltip.bottom="'A Data Registry contains a collection of Data Registrations.'"></i>
              </div>
            </div>
            <span v-show="dirty && invalidRegistry" class="text-red-500 mt-2">Invalid DataRegistry name. Allowed characters: a-Z-0-9</span>
          </div>
          <div class="col-12">
            <div class="flex">
              <div class="flex-grow-1">
                <DacklTextInput type="string" :disabled="false" class="w-full md:w-auto mt-2" label="Enter Registration name" v-model="registrationName"/>
              </div>
              <div class="flex-none m-auto">
                <i class="info-icon pi pi-info-circle" v-tooltip.bottom="'A Data Registration provides a place to store data that conforms to a specific shape.'"></i>
              </div>
            </div>
            <span v-show="dirty && invalidRegistration" class="text-red-500 mt-2">Invalid DataRegistration name. Allowed characters: a-Z_0-9</span>
            <span v-show="dirty && registrationNameExists" class="text-red-500">DataRegistration Name already used.</span>
          </div>
          <div class="col-12 text-right">
            <Button class="mr-2" severity="secondary" @click="closeDialog"
            >Cancel</Button>
            <Button class="ml-2" :severity="isSubmitDisabled ? 'secondary': 'primary'" :disabled ="isSubmitDisabled" label="Submit" @click="addRegistrationName" :loading="loading"
            ></Button>
          </div>
        </div>
</template>

<style scoped>
.info-icon{
  padding:10px;

}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active in <2.1.8 */ {
  opacity: 0;
}
</style>
