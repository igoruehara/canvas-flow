"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderConfigModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth-module");
const database_module_1 = require("../database/database.module");
const provider_config_controller_1 = require("./provider-config-controller");
const provider_config_service_1 = require("./provider-config-service");
const provider_config_connect_provider_1 = require("./provider-config-connect-provider");
let ProviderConfigModule = class ProviderConfigModule {
};
exports.ProviderConfigModule = ProviderConfigModule;
exports.ProviderConfigModule = ProviderConfigModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, auth_module_1.AuthModule],
        controllers: [provider_config_controller_1.ProviderConfigController],
        providers: [provider_config_service_1.ProviderConfigService, ...provider_config_connect_provider_1.connectProviders],
        exports: [provider_config_service_1.ProviderConfigService],
    })
], ProviderConfigModule);
//# sourceMappingURL=provider-config-module.js.map