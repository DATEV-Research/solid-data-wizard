<script setup lang="ts">

import {useOrganisationStore} from "@/composables/useOrganisationStore";
import {validateInput} from "@/utils/validateInput";
import {DacklTextInput} from "@datev-research/mandat-shared-components";
import {useToast} from "primevue/usetoast";
import {computed, ref, watchEffect} from "vue";
import {getFileExtension} from "@/utils/fileExtension";
import {TTL_EXTENSION} from "@/constants/extensions";
import {isValidTurtle, turtleToShape} from "@/utils/turtleToShapeTree";
import EditShapeContent from "@/components/editShapeContent.vue";
import {fileSizeExceeded} from "@/utils/fileSize";
import {validateFileName} from "@/utils/validateFileName";
import {registrationDuplicateState} from "@/enums/registrationDuplicateStatus";
import {renameFile} from "@/utils/renameFile";


const N3 = require('n3');

const { createRegistry, createRegistration,updateACLPermission, registryExists, registrationExists, createShape, createShapeTree, documentExists, uploadFile, updateProfileRegistry,allShapeFiles, createShapeTreeContainer,applyShapeTreeData, shapeTreeContainerExists,getRegistryAndShape,resourceExists  } = useOrganisationStore();

const SHAPE_TREE_CONTAINER_URI = `https://sme.solid.aifb.kit.edu/shapetrees`;

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
const fileNotSelected = computed<boolean>(() => dirty.value && (!fileInput.value || fileInput.value.files?.length === 0));
const isInvalid = computed<boolean>(() => invalidRegistry.value || invalidRegistration.value  || fileNotSelected.value);
const duplicateRegistrationState = ref<string>(registrationDuplicateState.start);

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
const foundRegistryAndShapeData = ref([]);
const selectedRegistryAndShapeData = ref([]);

watchEffect(async () => {
  if(shapeContent.value && ttlUpload.value){
    foundRegistryAndShapeData.value = await getRegistryAndShape(shapeContent.value);
    //foundRegistryAndShapeData.value = [];
    console.log('found =>',foundRegistryAndShapeData.value);
    if(foundRegistryAndShapeData.value.length > 0){
      duplicateRegistrationState.value = registrationDuplicateState.Duplicate;
    }
    else{
      duplicateRegistrationState.value = registrationDuplicateState.NotFound;
    }
  }
});
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
async function addExistingRegistrationName(){
  if(selectedRegistryAndShapeData.value.registryName){
    registryName.value = selectedRegistryAndShapeData.value.registryName;
    registrationName.value = selectedRegistryAndShapeData.value.registrationName;
    await addRegistrationName(false);
  }
  else{
    toast.add({
      severity: "error",
      summary: "Please select a Data Registration",
      life: 5000,
    });
  }
}
async function addRegistrationName(createNewRegistration:boolean): Promise<void>{
  resetErrorMessage();
  dirty.value = true;

  const shapeTree = "shapetrees";
  const registry = registryName.value;
  const registration = registrationName.value;
  const isRegistryExists = await registryExists(registry);
  const isRegistrationExists = await registrationExists(registry, registration);
  let input:File = fileInput.value.files?.[0];

  if(createNewRegistration && isRegistrationExists){
      toast.add({
        severity: "error",
        summary: `'${registration}' already exists with the same`,
        life: 5000,
      });
      return;
  }

  // Create ShapeTree Container if it does not exist
  if (!(await shapeTreeContainerExists(shapeTree))) {
    await createShapeTreeContainer(shapeTree);
  }
  if (isInvalid.value) {
    return;
  }

  // Check if registry exists, if not create the registry and update the profile
  if (!(isRegistryExists)) {
    await createRegistry(registry);
    await updateProfileRegistry(registry);
  }

  // Check if the document exists in the registration, if yes rename the file
  if(await documentExists(registry, registration,input.name))
  {
    const fileName = await newFileName(`${registry}/${registration}`,input.name);
    input = await renameFile(input,fileName);
  }

  // Create new registration if the user wants to create a new registration
  if(createNewRegistration){
    const registrationUri = await createRegistration(registry, registration);
    if(ttlUpload.value && foundRegistryAndShapeData.value.length ===0){
      await createShapeTreeFile(registrationUri);
    }
    else{
      const shapeURI = foundRegistryAndShapeData.value[0].shapeURI;
      const shapeTreeURI = foundRegistryAndShapeData.value[0].shapeTreeURI;
      await applyShapeTreeData(registrationUri,shapeURI,shapeTreeURI);
    }
  }


  if (input) {
    loading.value = true;
    try{
      // Upload the file to the registration
      await uploadFile(input, registry, registration);
      // Update the ACL permission of the registration
      await updateACLPermission(registry, registration);
      // Show success message
      toast.add({
        severity: "success",
        summary: "File successfully uploaded!",
        life: 5000,
      });

      resetData();
      emit('registryCreated', true);
    }
    catch(err){
      // Show error message File is not uploaded
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
async function renameFileName(input:File, registry, registration){
  let documentExistFlag = true;
  let newFileName = '';
  let counter = 0;

  while(documentExistFlag){
    newFileName = input.name.replace(/\.[^/.]+$/, "") + `_${counter}` + input.name.match(/\.[^/.]+$/);
    //documentExistFlag = await documentExists(registry, registration,newFileName);
    const uri = `${registry}/${registration}/${newFileName}`;
    documentExistFlag = await resourceExists(uri);
    counter++;
  }

  return renameFile(input,newFileName);
}


async function onFileSelect(event: Event) {
  const file = event.target.files[0];
  duplicateRegistrationState.value = registrationDuplicateState.start;
  foundRegistryAndShapeData.value  = [];
  if (file) if (!validateFileName(file.name)) {

    toast.add({
      severity: "error",
      summary: "Invalid file name. Allowed characters: a-Z_0-9_.-()",
      life: 5000,
    });
  } else if (fileSizeExceeded(file.size)) {
    const fileName = file.name;
    isSubmitDisabled.value = false;
    if (getFileExtension(fileName) === TTL_EXTENSION) {
      ttlUpload.value = true;
      if (!shapeFileInput.value?.files.length) {
        createShapeContent(file);
      }
    } else {
      hideTTLDiv();
    }
  } else {
    hideTTLDiv();
    toast.add({
      severity: "error",
      summary: "File size exceed 2 MB limit",
      life: 5000,
    });
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
      const isValidTurtleContent = isValidTurtle(content);
      if(isValidTurtleContent.success){
        isSubmitDisabled.value = false;
        duplicateRegistrationState.value = registrationDuplicateState.Checking;
        shapeContent.value= await turtleToShape(content);
      }
      else{
        isSubmitDisabled.value = true;
        shapeContent.value = '';
        duplicateRegistrationState.value = registrationDuplicateState.start;
        toast.add({
          severity: "error",
          summary: isValidTurtleContent.message,
          life: 5000,
        });
      }
    }
  };
  reader.readAsText(file);
}
/*
* On shape file is selected
* */
function onShapeFileSelect(){
  const file = shapeFileInput.value?.files?.[0];
  shapeContent.value='';
  duplicateRegistrationState.value = registrationDuplicateState.start;
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      shapeContent.value = e.target.result.toString();
      duplicateRegistrationState.value = registrationDuplicateState.Checking;
    }
    reader.readAsText(file);
  }
}
/*
* Create ShapeTree file takes registration URI as input and creates a shape,shapeTree and apply shape tree data to the registration in pod
* */
async function createShapeTreeFile(registrationUri:string){
  const extractedShapeName = shapeContent.value.match(/<#(.*?)>/)?.[1];
  let shapeName = `${extractedShapeName}.shape`;
  let shapeTreeName = `${extractedShapeName}.tree`;


  let shapeUri = `${SHAPE_TREE_CONTAINER_URI}/${shapeName}`;
  let shapeTreeUri = `${SHAPE_TREE_CONTAINER_URI}/${shapeTreeName}`;
  const {shapeURIs, shapeTreeURIs} = await allShapeFiles('shapetrees','');

  console.log("shapeURI Includes", shapeURIs.includes(shapeUri), shapeUri);
  if(shapeURIs.includes(shapeUri) && foundRegistryAndShapeData.value.length === 0){
    shapeName = await newFileName(SHAPE_TREE_CONTAINER_URI, shapeName, shapeURIs);
    shapeUri = `${SHAPE_TREE_CONTAINER_URI}/${shapeName}`;
    console.log('newShapeFileName => ', shapeName);
  }
  if(shapeTreeURIs.includes(shapeTreeUri) && foundRegistryAndShapeData.value.length === 0){
    shapeTreeName = await newFileName(SHAPE_TREE_CONTAINER_URI,shapeTreeName, shapeTreeURIs);
    shapeTreeUri = `${SHAPE_TREE_CONTAINER_URI}/${shapeTreeName}`;
    console.log('newShapeFileName => ', shapeTreeName);
  }

  console.log('shapeFiles => ', shapeURIs);
  console.log('shapeTreeFiles => ', shapeTreeURIs);

  const shapeTreeContent = `@prefix st: <http://www.w3.org/ns/shapetrees#> .

<#${shapeTreeName}> a st:ShapeTree ;
  st:expectsType	st:Resource ;
  st:shape      	<${SHAPE_TREE_CONTAINER_URI}/${shapeName}#${shapeName}> .`

  let headers = {};
  headers["Content-type"] ='application/octet-stream';



console.log('shapeUri =>* ',shapeUri);
console.log('shapeTreeUri =>* ',shapeTreeUri);

  await createShape(shapeUri, shapeContent.value, headers);
  await createShapeTree(shapeTreeUri, shapeTreeContent, headers);

  await applyShapeTreeData(registrationUri,shapeUri,shapeTreeUri);
}

function toggleShapeContentView(){
  toggleShapeContent.value = !toggleShapeContent.value;
}
async function newFileName(uri:string,fileName:string, arrayData?:string[]){
  let documentExistFlag = true;
  let newFileName = '';
  let counter = 0;

  while(documentExistFlag){
    newFileName = fileName.replace(/\.[^/.]+$/, "") + `${counter}` + fileName.match(/\.[^/.]+$/);
    const newUri = `${uri}/${newFileName}`;
    if(arrayData){
      documentExistFlag = arrayData.includes(newUri);
    }
    else{
      documentExistFlag = await resourceExists(newUri);
    }
    counter++;
  }
  return newFileName;
}

</script>

<template>
        <div class="grid pt-0 pb-3">
          <!-- Select a document to upload -->
          <div class="grid col-6">
            <div class=" col-12">Please select the document to upload</div>
            <div class="col-12"><input ref="fileInput" type="file" @change="onFileSelect" /></div>
            <div class="col-12" v-if ="dirty && fileNotSelected">
              <span class="text-red-500">No file selected.</span>
            </div>
          </div>
          <!-- Upload Shape file -->
          <div class="grid col-6" v-if="ttlUpload">
           <div class="col-12"><Checkbox v-model="uploadShapeFile" :binary="true"/>
            <label> Upload shape file</label></div>
            <div class="col-12" v-if="uploadShapeFile" ><input ref="shapeFileInput" type="file" @change="onShapeFileSelect" accept=".shape"/></div>
            <div class="col-12" v-else @click="toggleShapeContentView"><a> View Created shape file</a></div>
          </div>
          <!-- Shape content data -->
          <div class="col-12" v-show="toggleShapeContent">
            <transition name="fade">
              <div v-show="!uploadShapeFile" >
                <edit-shape-content :content="shapeContent" @close-preview="toggleShapeContentView" />
              </div>
            </transition>
          </div>
          <!-- Enter Registry Name -->
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
          <!-- Enter Registration name -->
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
          </div>

          <!-- Show the duplicate data registration -->
          <div class="grid col-12">
            <div class="col-12" v-if="duplicateRegistrationState === registrationDuplicateState.Checking">Please wait. Checking for Data Registration duplicate..</div>
            <div class="col-12" v-if="duplicateRegistrationState === registrationDuplicateState.NotFound">No duplicates found <i class="info-icon pi pi-check" style="color: green; font-size: 1.5rem"></i>
            </div>
            <div class="col-6" v-if="duplicateRegistrationState === registrationDuplicateState.Duplicate"><i class="info-icon pi pi-exclamation-triangle" style="font-size: 1rem"></i>A Data Registration with the same Shape was found!</div>
            <div class="col-6" v-if="duplicateRegistrationState === registrationDuplicateState.Duplicate">
              <div class="pr-3">
                <Dropdown v-model="selectedRegistryAndShapeData" :options="foundRegistryAndShapeData" optionLabel="registrationUri" placeholder="Select a Data Registration" class="w-full" />
              </div>
            </div>
          </div>

          <!-- Action buttons to create registration-->
          <div class="grid col-12 text-right pr-5" >
            <div class="w-full m-auto" v-if="foundRegistryAndShapeData.length ===0">
              <Button class="mr-2" severity="secondary" @click="closeDialog"
              >Cancel</Button>
              <Button class="ml-2" :severity="isSubmitDisabled ? 'secondary': 'primary'" :disabled ="isSubmitDisabled" label="Submit" @click="addRegistrationName(true)" :loading="loading"
              ></Button>
            </div>
            <div class="w-full m-auto" v-if="foundRegistryAndShapeData.length >0">
              <Button class="mr-2" severity="secondary" @click="closeDialog"
              >Cancel</Button>
              <Button class="ml-2" :severity="isSubmitDisabled ? 'secondary': 'primary'" :disabled ="isSubmitDisabled" label="Create New Registration and Submit" @click="addRegistrationName(true)" :loading="loading"
              ></Button>
              <Button class="ml-2" :severity="isSubmitDisabled ? 'secondary': 'primary'" :disabled ="isSubmitDisabled" label="Submit to existing Registration" @click="addExistingRegistrationName" :loading="loading"
              ></Button>
            </div>

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
