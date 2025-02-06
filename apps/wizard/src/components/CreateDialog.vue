<script setup lang="ts">

import {useOrganisationStore} from "@/composables/useOrganisationStore";
import {validateInput} from "@/utils/validateInput";
import {DacklTextInput} from "@datev-research/mandat-shared-components";
import {computedAsync} from "@vueuse/core";
import {useToast} from "primevue/usetoast";
import {computed, ref} from "vue";

const { createRegistry, createRegistration, registryExists, registrationExists, uploadFile, updateProfileRegistry } = useOrganisationStore();

const emit = defineEmits<{
  (e: "registryCreated", value: boolean): void;
}>();

// re-use Solid session
const registryName = ref<string>('');
const registrationName = ref<string>('');
const fileInput = ref<HTMLInputElement | null>(null); // use `useTemplateRef()` in vue 3.5+

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

const toast = useToast();

function resetErrorMessage() {
  dirty.value = false;
}

function resetData(){
  registryName.value = '';
  registrationName.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  resetErrorMessage();
}

async function addRegistrationName(): Promise<void>{
  resetErrorMessage();
  dirty.value = true;

  if (isInvalid.value) {
    return;
  }

  const registry = registryName.value;
  const registration = registrationName.value;
  const input = fileInput.value;

  if (!(await registryExists(registry))) {
    await createRegistry(registry);
    await updateProfileRegistry(registry);
  }

  await createRegistration(registry, registration);

  if (input && input.files && input.files.length) {
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
</script>

<template>
      <div >
        <div class="grid pt-0">
          <div class="col-12">
            <h1>Solid Data Wizard</h1>
          </div>
          <div class="col-12">
            <DacklTextInput type="string" :disabled="false" class="w-full md:w-auto mt-2" label="Enter Registry Name" v-model="registryName"/>
            <span v-show="dirty && invalidRegistry" class="text-red-500 mt-2">Invalid DataRegistry name. Allowed characters: a-Z-0-9</span>
          </div>
          <div class="col-12">
            <DacklTextInput type="string" :disabled="false" class="w-full md:w-auto mt-2" label="Add Registration Name" v-model="registrationName"/>
            <span v-show="dirty && invalidRegistration" class="text-red-500 mt-2">Invalid DataRegistration name. Allowed characters: a-Z_0-9</span>
            <span v-show="dirty && registrationNameExists" class="text-red-500">DataRegistration Name already used.</span>
          </div>
          <div class="col-12">
            <input ref="fileInput" type="file" />
          </div>
          <div class="col-12">
            <span v-show="dirty && fileNotSelected" class="text-red-500">No file selected.</span>
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
