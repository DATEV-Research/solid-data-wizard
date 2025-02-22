import {setupApp} from "@datev-research/mandat-shared-utils";
import {createApp} from "vue";
import App from "./App.vue";

import "primeflex/primeflex.css";
import "@datev-research/mandat-shared-theme/theme.css";
import "primeicons/primeicons.css";
import Tree from "primevue/tree";

const app = createApp(App);

setupApp(app);
app.component('Tree', Tree);
app.mount("#app");
