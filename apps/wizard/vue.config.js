const {defineConfig} = require('@vue/cli-service')
const {vueBaseConfig} = process.env.npm_package_config_monorepo ? require("../../vue.base-config") : {};


module.exports = defineConfig({
    ...vueBaseConfig,
    outputDir: process.env.npm_package_config_monorepo ? '../../dist/wizard' : './dist',
    devServer: {
        port: process.env.npm_package_config_port ?? 8080
    },
});
