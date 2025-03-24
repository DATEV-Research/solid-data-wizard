import {useOrganisationStore} from "@/composables/useOrganisationStore";

const {resourceExists  } = useOrganisationStore();
/*
export async function newFileName(uri:string,fileName:string, arrayData?:string[]){
    let documentExistFlag = true;
    let newFileName = '';
    let counter = 0;

    while(documentExistFlag){
        newFileName = fileName.replace(/\.[^/.]+$/, "") + `_${counter}` + fileName.match(/\.[^/.]+$/);
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
}*/
