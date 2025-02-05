<script setup lang="ts">

import {DacklTextInput} from "@datev-research/mandat-shared-components";
import {ref} from "vue";
import {validateInput} from "@/utils/validateInput";
import {useToast} from "primevue/usetoast";
import {useOrganisationStore} from "@/composables/useOrganisationStore";

const { createRegistry, createRegistration, registryExists, registrationExists, uploadFile, updateProfileRegistry } = useOrganisationStore();

const emit = defineEmits(['registryCreated']);

// re-use Solid session
const registryName = ref<string>('');
const registrationName = ref<string>('');
const invalidRegistration = ref<boolean>(false);
const invalidRegistry = ref<boolean>(false);
const registrationNameExists = ref<boolean>(false);
const fileNotSelected = ref<boolean>(false);
const fileInput = ref<HTMLInputElement | null>(null);

const toast = useToast();

function resetErrorMessage(){
  invalidRegistry.value=false;
  invalidRegistration.value=false;
  registrationNameExists.value=false;
}
function resetData(){
  registryName.value = '';
  registrationName.value = '';
  fileInput.value.value = '';
  resetErrorMessage();
}
async function addRegistrationName(): Promise<void>{
  resetErrorMessage();
  const registry = registryName.value;
  const registration = registrationName.value;
  const isRegistrationExists = await registrationExists(registry,registration);
  const input = (fileInput.value as HTMLInputElement);

  if(!validateInput(registry)){
    invalidRegistry.value=true;
  }
  else if(!validateInput(registration)){
    invalidRegistration.value=true;
  }
  else if (!input){
    fileNotSelected.value = true;
  }
  else if (isRegistrationExists){
    registrationNameExists.value=true;
  }
  else {
    if (!(await registryExists(registry))) { await createRegistry(registry);await updateProfileRegistry(registry); }
    await createRegistration(registry, registration);

    if (input.files && input.files.length) {
      try{
        await Promise.all(
            Array.from(input.files)
                .map(file => uploadFile(file, registry, registration)));

        toast.add({
          severity: "success",
          summary: "File successfully uploaded!",
          life: 5000,
        });
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
  }

}

function fileSelected(event: Event){
  const file = (event.target as HTMLInputElement);
  fileInput.value = file;
  if(file){
    fileNotSelected.value = false;
  }
  else{
    fileNotSelected.value = true;
  }
}
</script>

<template>
      <div >
        <div class="grid pt-0">
          <div class="col-12">
            <h1>Solid Data Wizard</h1>
          </div>
          <div class="col-12">
            <DacklTextInput type="string" :disabled="false" class="w-full md:w-auto mt-2" label="Enter Registry Name" v-model="registryName"/>
            <span v-show="invalidRegistry" class="text-red-500 mt-2">Ungültige Eingabe</span>
          </div>
          <div class="col-12">
            <DacklTextInput type="string" :disabled="false"  class="w-full md:w-auto mt-2" label="Add Registration Name" v-model="registrationName"/>
            <span v-show="invalidRegistration" class="text-red-500">Ungültige Eingabe</span>
            <span v-show="registrationNameExists" class="text-red-500">Registration name already exists</span>
          </div>
          <div class="col-12">
            <input type="file" @change="fileSelected" />
          </div>
          <div class="col-12">
            <span v-show="fileNotSelected" class="text-red-500">No file selected</span>
          </div>

          <div class="col-12 ">
            <Button class="mr-2" severity="secondary" @click="resetData"
            >Cancel</Button>
            <Button class="ml-2" @click="addRegistrationName"
            >Submit</Button>
          </div>

        </div>
      </div>
</template>

<style scoped>

</style>