# 📦 Azure Container Registry (ACR) 및 AcrPull 권한 연동

resource "azurerm_container_registry" "acr" {
  name                = "unbrdnacr"
  resource_group_name = local.rg_name
  location            = "Korea Central"
  sku                 = "Standard"
  admin_enabled       = true
}

# resource "azurerm_role_assignment" "aks_to_acr" {
#   principal_id                     = local.aks_identity
#   role_definition_name             = "AcrPull"
#   scope                            = azurerm_container_registry.acr.id
#   skip_service_principal_aad_check = true
# }
